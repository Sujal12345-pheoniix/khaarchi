import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExpensesService } from '../expenses/expenses.service.js';
import { BalancesService } from '../balances/balances.service.js';
import { SettlementsService } from '../settlements/settlements.service.js';
import { BadRequestException } from '@nestjs/common';
import { ExpenseCategory, SplitType } from '@homeexpense/shared';

describe('HomeExpense Backend Financial Engine', () => {
  let mockPrisma: any;
  let expensesService: ExpensesService;
  let balancesService: BalancesService;
  let settlementsService: SettlementsService;

  beforeEach(() => {
    mockPrisma = {
      $transaction: vi.fn(async (cb) => cb(mockPrisma)),
      homeMember: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      expense: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        aggregate: vi.fn(),
      },
      expenseSplit: {
        createMany: vi.fn(),
      },
      ledgerEntry: {
        create: vi.fn(),
        createMany: vi.fn(),
        findMany: vi.fn(),
      },
      settlement: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
    };

    expensesService = new ExpensesService(mockPrisma);
    balancesService = new BalancesService(mockPrisma);
    settlementsService = new SettlementsService(mockPrisma);
  });

  describe('ExpensesService — Atomic Financial Invariant Enforcement', () => {
    const homeId = '11111111-1111-1111-1111-111111111111';
    const actorUserId = '22222222-2222-2222-2222-222222222222';
    const payerMemberId = '33333333-3333-3333-3333-333333333333';
    const member2Id = '44444444-4444-4444-4444-444444444444';

    it('rejects expense creation when split amounts do not sum to the total expense amount', async () => {
      const invalidInput = {
        description: 'Dinner',
        amount: 100.0,
        category: ExpenseCategory.DINING_OUT,
        splitType: SplitType.EQUAL,
        date: new Date().toISOString(),
        payerMemberId,
        splits: [
          { memberId: payerMemberId, amount: 50.0 },
          { memberId: member2Id, amount: 49.0 }, // Sum is 99 != 100
        ],
      };

      await expect(
        expensesService.createExpense(homeId, actorUserId, invalidInput)
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects expense creation if payer does not belong to home', async () => {
      mockPrisma.homeMember.findFirst.mockResolvedValue(null);

      const input = {
        description: 'Groceries',
        amount: 50.0,
        category: ExpenseCategory.GROCERIES,
        splitType: SplitType.EQUAL,
        date: new Date().toISOString(),
        payerMemberId,
        splits: [
          { memberId: payerMemberId, amount: 25.0 },
          { memberId: member2Id, amount: 25.0 },
        ],
      };

      await expect(
        expensesService.createExpense(homeId, actorUserId, input)
      ).rejects.toThrow(/Payer member is not an active member/);
    });

    it('creates expense, splits, and ledger entries atomically when valid', async () => {
      mockPrisma.homeMember.findFirst.mockResolvedValue({ id: payerMemberId, homeId, isActive: true });
      mockPrisma.homeMember.findMany.mockResolvedValue([
        { id: payerMemberId },
        { id: member2Id },
      ]);
      mockPrisma.expense.create.mockResolvedValue({ id: 'exp-1' });
      mockPrisma.expense.findUnique.mockResolvedValue({ id: 'exp-1', description: 'Groceries' });

      const input = {
        description: 'Groceries',
        amount: 100.0,
        category: ExpenseCategory.GROCERIES,
        splitType: SplitType.EQUAL,
        date: new Date().toISOString(),
        payerMemberId,
        splits: [
          { memberId: payerMemberId, amount: 50.0 },
          { memberId: member2Id, amount: 50.0 },
        ],
      };

      const result = await expensesService.createExpense(homeId, actorUserId, input);

      expect(result).toBeDefined();
      expect(mockPrisma.expense.create).toHaveBeenCalled();
      expect(mockPrisma.expenseSplit.createMany).toHaveBeenCalled();
      expect(mockPrisma.ledgerEntry.createMany).toHaveBeenCalled();
      // Ledger entry created ONLY for non-payer (member2 owes payer)
      const ledgerCall = mockPrisma.ledgerEntry.createMany.mock.calls[0][0];
      expect(ledgerCall.data).toHaveLength(1);
      expect(ledgerCall.data[0].debtorMemberId).toBe(member2Id);
      expect(ledgerCall.data[0].creditorMemberId).toBe(payerMemberId);
    });
  });

  describe('BalancesService — Double-Entry Ledger Calculation', () => {
    it('correctly derives net balances and verifies zero-sum ledger', async () => {
      const homeId = 'home-1';
      const m1 = { id: 'm1', role: 'OWNER', isActive: true, user: { name: 'Alice' } };
      const m2 = { id: 'm2', role: 'MEMBER', isActive: true, user: { name: 'Bob' } };

      mockPrisma.homeMember.findMany.mockResolvedValue([m1, m2]);
      // Ledger: Bob (m2) owes Alice (m1) 50
      mockPrisma.ledgerEntry.findMany.mockResolvedValue([
        { debtorMemberId: 'm2', creditorMemberId: 'm1', amount: '50.00' },
      ]);
      mockPrisma.expense.aggregate.mockResolvedValue({
        _sum: { amount: '100.00' },
        _count: 1,
      });

      const balances = await balancesService.getHomeBalances(homeId);

      expect(balances.isReconciled).toBe(true);
      const alice = balances.memberBalances.find((b) => b.memberId === 'm1');
      const bob = balances.memberBalances.find((b) => b.memberId === 'm2');

      expect(alice?.balance).toBe(50.0);
      expect(alice?.status).toBe('OWED');
      expect(bob?.balance).toBe(-50.0);
      expect(bob?.status).toBe('OWES');
      expect(balances.pairwiseDebts).toHaveLength(1);
      expect(balances.pairwiseDebts[0]).toMatchObject({
        fromMemberId: 'm2',
        toMemberId: 'm1',
        amount: 50.0,
      });
    });
  });

  describe('SettlementsService — Invariant & Debt Bounds Checking', () => {
    const homeId = 'home-1';
    const actorUserId = 'user-1';
    const fromMemberId = 'm2'; // Bob (debtor)
    const toMemberId = 'm1'; // Alice (creditor)

    it('rejects settlement when payer and payee are identical', async () => {
      await expect(
        settlementsService.createSettlement(homeId, actorUserId, {
          fromMemberId,
          toMemberId: fromMemberId,
          amount: 50.0,
        })
      ).rejects.toThrow(/cannot be the same person/);
    });

    it('rejects settlement that exceeds the current outstanding debt obligation', async () => {
      mockPrisma.homeMember.findFirst
        .mockResolvedValueOnce({ id: fromMemberId, homeId, user: { name: 'Bob' } })
        .mockResolvedValueOnce({ id: toMemberId, homeId, user: { name: 'Alice' } });

      // Bob owes Alice 50
      mockPrisma.ledgerEntry.findMany.mockResolvedValue([
        { debtorMemberId: fromMemberId, creditorMemberId: toMemberId, amount: '50.00' },
      ]);

      // Bob attempts to settle 60 (exceeds 50)
      await expect(
        settlementsService.createSettlement(homeId, actorUserId, {
          fromMemberId,
          toMemberId,
          amount: 60.0,
        })
      ).rejects.toThrow(/exceeds the outstanding debt/);
    });

    it('records valid settlement and creates offsetting ledger entry', async () => {
      mockPrisma.homeMember.findFirst
        .mockResolvedValueOnce({ id: fromMemberId, homeId, user: { name: 'Bob' } })
        .mockResolvedValueOnce({ id: toMemberId, homeId, user: { name: 'Alice' } });

      mockPrisma.ledgerEntry.findMany.mockResolvedValue([
        { debtorMemberId: fromMemberId, creditorMemberId: toMemberId, amount: '50.00' },
      ]);
      mockPrisma.settlement.create.mockResolvedValue({ id: 'settle-1' });
      mockPrisma.settlement.findUnique.mockResolvedValue({ id: 'settle-1' });

      const result = await settlementsService.createSettlement(homeId, actorUserId, {
        fromMemberId,
        toMemberId,
        amount: 30.0,
      });

      expect(result).toBeDefined();
      expect(mockPrisma.settlement.create).toHaveBeenCalled();
      expect(mockPrisma.ledgerEntry.create).toHaveBeenCalled();
      // Counterbalancing ledger entry where debtor is Alice (toMember) and creditor is Bob (fromMember)
      const ledgerCall = mockPrisma.ledgerEntry.create.mock.calls[0][0];
      expect(ledgerCall.data.debtorMemberId).toBe(toMemberId);
      expect(ledgerCall.data.creditorMemberId).toBe(fromMemberId);
    });
  });
});
