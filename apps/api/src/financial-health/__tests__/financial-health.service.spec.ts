import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FinancialHealthService } from '../financial-health.service.js';
import { HomeType, HealthStatus, DataSufficiency } from '@homeexpense/shared';

describe('FinancialHealthService', () => {
  let mockPrisma: any;
  let mockBalancesService: any;
  let mockSnapshotService: any;
  let service: FinancialHealthService;

  const homeId = 'home-1111-2222-3333-4444';

  beforeEach(() => {
    mockPrisma = {
      home: {
        findUnique: vi.fn(),
      },
      expense: {
        findMany: vi.fn(),
        aggregate: vi.fn(),
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
    };

    mockBalancesService = {
      getHomeBalances: vi.fn(),
    };

    mockSnapshotService = {
      getLatestSnapshot: vi.fn().mockResolvedValue(null),
      recordSnapshot: vi.fn().mockResolvedValue(undefined),
    };

    service = new FinancialHealthService(
      mockPrisma,
      mockBalancesService,
      mockSnapshotService
    );
  });

  it('handles a brand new household gracefully with BUILDING_PROFILE (missing-data policy)', async () => {
    mockPrisma.home.findUnique.mockResolvedValue({
      id: homeId,
      name: 'Fresh Flat',
      type: HomeType.BACHELOR,
      members: [
        { id: 'm1', isActive: true, user: { id: 'u1', name: 'Newcomer' } },
      ],
    });

    mockPrisma.expense.findMany.mockResolvedValue([]);
    mockPrisma.expense.aggregate.mockResolvedValue({ _count: 0, _sum: { amount: null } });
    mockPrisma.budget.findUnique.mockResolvedValue(null);
    mockPrisma.bill.findMany.mockResolvedValue([]);
    mockPrisma.recurringExpense.findMany.mockResolvedValue([]);

    mockBalancesService.getHomeBalances.mockResolvedValue({
      homeId,
      totalSpending: 0,
      totalExpenseCount: 0,
      memberBalances: [{ memberId: 'm1', balance: 0, status: 'SETTLED' }],
      pairwiseDebts: [],
      suggestedSettlements: [],
      isReconciled: true,
    });

    const result = await service.evaluateHomeHealth(homeId);

    // Should NOT be CRITICAL with 0 score!
    expect(result.status).not.toBe(HealthStatus.CRITICAL);
    expect(result.profile).toBe(HomeType.BACHELOR);
    expect(result.scoringVersion).toBe('FINANCIAL_HEALTH_V1');
  });

  it('correctly evaluates a fully active household and records snapshot', async () => {
    mockPrisma.home.findUnique.mockResolvedValue({
      id: homeId,
      name: 'The Sharma Family',
      type: HomeType.FAMILY,
      members: [
        { id: 'm1', isActive: true, user: { id: 'u1', name: 'Aarav' } },
        { id: 'm2', isActive: true, user: { id: 'u2', name: 'Diya' } },
      ],
    });

    // Expenses: total 35,000
    mockPrisma.expense.findMany.mockResolvedValue([
      { id: 'e1', amount: 20000, category: 'GROCERIES', payerMemberId: 'm1', date: new Date() },
      { id: 'e2', amount: 15000, category: 'UTILITIES', payerMemberId: 'm2', date: new Date() },
    ]);

    // Historical spend: 3 prior months of 35,000
    mockPrisma.expense.aggregate.mockResolvedValue({
      _count: 5,
      _sum: { amount: 35000 },
    });

    // Budget: 50,000
    mockPrisma.budget.findUnique.mockResolvedValue({
      id: 'b1',
      totalBudget: 50000,
      month: 10,
      year: 2026,
      categories: [
        { category: 'GROCERIES', allocatedAmount: 25000 },
        { category: 'UTILITIES', allocatedAmount: 25000 },
      ],
    });

    // Bills: 0 overdue
    mockPrisma.bill.findMany.mockResolvedValue([
      { id: 'bill1', title: 'WiFi', amount: 1000, dueDate: new Date(Date.now() + 864000000), status: 'UNPAID' },
    ]);

    // Recurring: 5000
    mockPrisma.recurringExpense.findMany.mockResolvedValue([
      { id: 'r1', amount: 5000, interval: 'MONTHLY', active: true },
    ]);

    // Balances
    mockBalancesService.getHomeBalances.mockResolvedValue({
      homeId,
      totalSpending: 35000,
      totalExpenseCount: 2,
      memberBalances: [
        { memberId: 'm1', balance: 2500, status: 'OWED' },
        { memberId: 'm2', balance: -2500, status: 'OWES' },
      ],
      pairwiseDebts: [],
      suggestedSettlements: [],
      isReconciled: true,
    });

    const result = await service.evaluateHomeHealth(homeId);

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.status).toBe(HealthStatus.HEALTHY);
    expect(result.breakdown).toHaveLength(6);
    expect(mockSnapshotService.recordSnapshot).toHaveBeenCalledWith(homeId, result);
  });
});
