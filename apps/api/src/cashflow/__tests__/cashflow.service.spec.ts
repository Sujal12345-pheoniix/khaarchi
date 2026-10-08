import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CashflowService } from '../cashflow.service.js';
import {
  HomeType,
  MemberRole,
  BillStatus,
  RecurringInterval,
  ExpenseCategory,
} from '@homeexpense/shared';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

describe('CashflowService', () => {
  let mockPrisma: any;
  let mockBalancesService: any;
  let service: CashflowService;

  const homeId = 'home-1111-2222-3333-4444';
  const ownerUserId = 'user-owner-1111';
  const memberUserId = 'user-member-2222';

  beforeEach(() => {
    mockPrisma = {
      home: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      expense: {
        findMany: vi.fn(),
      },
      budget: {
        findUnique: vi.fn(),
      },
      bill: {
        findMany: vi.fn(),
      },
      recurringExpense: {
        findMany: vi.fn(),
      },
      homeMember: {
        findUnique: vi.fn(),
      },
    };

    mockBalancesService = {
      getHomeBalances: vi.fn().mockResolvedValue({
        memberBalances: [
          { memberId: 'm1', balance: 500, status: 'OWED' },
          { memberId: 'm2', balance: -500, status: 'OWES' },
        ],
      }),
    };

    service = new CashflowService(mockPrisma, mockBalancesService);
  });

  describe('getSafeToSpend', () => {
    it('throws NotFoundException if household does not exist', async () => {
      mockPrisma.home.findUnique.mockResolvedValue(null);

      await expect(service.getSafeToSpend(homeId)).rejects.toThrow(
        NotFoundException
      );
    });

    it('evaluates Safe-to-Spend concurrently from PostgreSQL records and returns deterministic result', async () => {
      mockPrisma.home.findUnique.mockResolvedValue({
        id: homeId,
        name: 'Sharma Household',
        type: HomeType.FAMILY,
        currency: 'INR',
        protectedReserve: '5000',
      });

      mockPrisma.expense.findMany
        .mockResolvedValueOnce([
          { id: 'e1', amount: 15000, category: 'GROCERIES', date: new Date() },
        ])
        .mockResolvedValueOnce([]); // prev expenses

      mockPrisma.budget.findUnique
        .mockResolvedValueOnce({
          id: 'b1',
          totalBudget: '60000',
          categories: [
            { category: ExpenseCategory.GROCERIES, allocatedAmount: '25000' },
          ],
        })
        .mockResolvedValueOnce(null); // prev budget

      mockPrisma.bill.findMany.mockResolvedValue([
        {
          id: 'bill-1',
          title: 'Electricity Bill',
          amount: '4000',
          dueDate: new Date(Date.now() + 86400000 * 5),
          status: BillStatus.UNPAID,
        },
      ]);

      mockPrisma.recurringExpense.findMany.mockResolvedValue([
        {
          id: 'rec-1',
          description: 'Broadband',
          amount: '1200',
          nextRunAt: new Date(Date.now() + 86400000 * 3),
          interval: RecurringInterval.MONTHLY,
          category: ExpenseCategory.UTILITIES,
          active: true,
        },
      ]);

      const result = await service.getSafeToSpend(homeId);

      expect(result.homeId).toBe(homeId);
      expect(result.components.availableCapacity).toBe(60000);
      expect(result.components.postedExpensesInPeriod).toBe(15000);
      expect(result.components.upcomingObligations).toBe(4000);
      expect(result.components.recurringCommitments).toBe(1200);
      expect(result.components.protectedReserve).toBe(5000);

      // 60,000 - 15,000 - 4,000 - 1,200 - 5,000 = 34,800
      expect(result.safeToSpend).toBe(34800);
      expect(result.status).toBe('HEALTHY');
      expect(result.confidence).toBe('HIGH');
    });
  });

  describe('updateProtectedReserve (Owner RBAC)', () => {
    it('throws BadRequestException if reserve amount is negative', async () => {
      await expect(
        service.updateProtectedReserve(homeId, ownerUserId, -500)
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException if actor is not an active household member', async () => {
      mockPrisma.homeMember.findUnique.mockResolvedValue(null);

      await expect(
        service.updateProtectedReserve(homeId, 'intruder', 5000)
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException if actor is not an OWNER (e.g. regular MEMBER)', async () => {
      mockPrisma.homeMember.findUnique.mockResolvedValue({
        id: 'm-reg',
        homeId,
        userId: memberUserId,
        role: MemberRole.MEMBER,
        isActive: true,
      });

      await expect(
        service.updateProtectedReserve(homeId, memberUserId, 5000)
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows OWNER to update protected emergency reserve', async () => {
      mockPrisma.homeMember.findUnique.mockResolvedValue({
        id: 'm-owner',
        homeId,
        userId: ownerUserId,
        role: MemberRole.OWNER,
        isActive: true,
      });

      mockPrisma.home.update.mockResolvedValue({
        id: homeId,
        protectedReserve: '10000',
      });

      const res = await service.updateProtectedReserve(homeId, ownerUserId, 10000);

      expect(mockPrisma.home.update).toHaveBeenCalledWith({
        where: { id: homeId },
        data: { protectedReserve: 10000 },
      });
      expect(res.protectedReserve).toBe(10000);
    });
  });
});
