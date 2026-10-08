import { describe, it, expect } from 'vitest';
import { calculateSafeToSpend } from '../calculators/safe-to-spend.calculator.js';
import {
  HomeType,
  BillStatus,
  RecurringInterval,
  ExpenseCategory,
} from '@homeexpense/shared';
import { SafeToSpendInput } from '../types/cashflow.types.js';

describe('calculateSafeToSpend (Pure Domain Engine)', () => {
  const referenceDate = new Date('2026-10-15T12:00:00Z');
  const periodStart = new Date('2026-10-01T00:00:00Z');
  const periodEnd = new Date('2026-10-31T23:59:59Z');

  const baseInput: SafeToSpendInput = {
    homeId: 'home-test-1111',
    homeType: HomeType.FAMILY,
    currency: 'INR',
    referenceDate,
    periodStart,
    periodEnd,
    budget: { totalBudget: 50000 },
    protectedReserve: 5000,
    postedExpenses: [
      { id: 'e1', amount: 12000, category: 'GROCERIES', date: new Date('2026-10-05') },
    ],
    bills: [
      {
        id: 'b1',
        title: 'Electricity',
        amount: 3000,
        dueDate: new Date('2026-10-20'),
        status: BillStatus.UNPAID,
      },
    ],
    recurringExpenses: [
      {
        id: 'r1',
        description: 'Internet Fibernet',
        amount: 1000,
        nextRunAt: new Date('2026-10-22'),
        interval: RecurringInterval.MONTHLY,
        category: ExpenseCategory.UTILITIES,
        active: true,
      },
    ],
  };

  it('calculates positive Safe-to-Spend with integer precision and high confidence', () => {
    // 50,000 budget - 12,000 spent - 3,000 bill - 1,000 recurring - 5,000 reserve = 29,000
    const result = calculateSafeToSpend(baseInput);

    expect(result.safeToSpend).toBe(29000);
    expect(result.safeToSpendCents).toBe(2900000);
    expect(result.status).toBe('HEALTHY');
    expect(result.confidence).toBe('HIGH');
    expect(result.dataSufficiency).toBe('FULL');
    expect(result.components.availableCapacity).toBe(50000);
    expect(result.components.postedExpensesInPeriod).toBe(12000);
    expect(result.components.upcomingObligations).toBe(3000);
    expect(result.components.recurringCommitments).toBe(1000);
    expect(result.components.protectedReserve).toBe(5000);
    expect(result.dailySafeToSpend).toBeGreaterThan(0);
  });

  it('calculates zero capacity as TIGHT rather than failure', () => {
    const input: SafeToSpendInput = {
      ...baseInput,
      budget: { totalBudget: 21000 },
      // 21,000 budget - 12,000 spent - 3,000 bill - 1,000 recurring - 5,000 reserve = 0
    };

    const result = calculateSafeToSpend(input);

    expect(result.safeToSpend).toBe(0);
    expect(result.safeToSpendCents).toBe(0);
    expect(result.status).toBe('TIGHT');
  });

  it('preserves negative Safe-to-Spend (DEFICIT) and NEVER clamps to zero', () => {
    const input: SafeToSpendInput = {
      ...baseInput,
      budget: { totalBudget: 15000 },
      // 15,000 budget - 12,000 spent - 3,000 bill - 1,000 recurring - 5,000 reserve = -6,000
    };

    const result = calculateSafeToSpend(input);

    expect(result.safeToSpend).toBe(-6000);
    expect(result.safeToSpendCents).toBe(-600000);
    expect(result.status).toBe('DEFICIT');

    const critWarning = result.warnings.find((w) => w.code === 'NEGATIVE_CAPACITY');
    expect(critWarning).toBeDefined();
    expect(critWarning?.severity).toBe('CRITICAL');
  });

  describe('Double-Counting Defense', () => {
    it('NEVER deducts bills that are marked as PAID', () => {
      const inputWithPaidBill: SafeToSpendInput = {
        ...baseInput,
        bills: [
          {
            id: 'b1',
            title: 'Paid Water Bill',
            amount: 1500,
            dueDate: new Date('2026-10-10'),
            status: BillStatus.PAID,
          },
          {
            id: 'b2',
            title: 'Unpaid Electricity',
            amount: 2500,
            dueDate: new Date('2026-10-25'),
            status: BillStatus.UNPAID,
          },
        ],
      };

      const result = calculateSafeToSpend(inputWithPaidBill);

      expect(result.components.upcomingObligations).toBe(2500);
      expect(result.obligations.length).toBe(1);
      expect(result.obligations[0].id).toBe('b2');
    });

    it('NEVER deducts recurring expenses that ran in the past (already posted)', () => {
      const inputWithPastRecurring: SafeToSpendInput = {
        ...baseInput,
        recurringExpenses: [
          {
            id: 'r-past',
            description: 'Rent already paid on Oct 1st',
            amount: 20000,
            nextRunAt: new Date('2026-10-01'), // in the past relative to referenceDate 2026-10-15
            interval: RecurringInterval.MONTHLY,
            category: ExpenseCategory.RENT,
            active: true,
          },
          {
            id: 'r-future',
            description: 'Streaming Sub',
            amount: 500,
            nextRunAt: new Date('2026-10-25'), // future
            interval: RecurringInterval.MONTHLY,
            category: ExpenseCategory.ENTERTAINMENT,
            active: true,
          },
        ],
      };

      const result = calculateSafeToSpend(inputWithPastRecurring);

      expect(result.components.recurringCommitments).toBe(500);
      expect(result.commitments.length).toBe(1);
      expect(result.commitments[0].id).toBe('r-future');
    });

    it('ignores inactive recurring expenses', () => {
      const inputWithInactive: SafeToSpendInput = {
        ...baseInput,
        recurringExpenses: [
          {
            id: 'r-inactive',
            description: 'Cancelled Gym',
            amount: 2500,
            nextRunAt: new Date('2026-10-20'),
            interval: RecurringInterval.MONTHLY,
            category: ExpenseCategory.OTHER,
            active: false,
          },
        ],
      };

      const result = calculateSafeToSpend(inputWithInactive);
      expect(result.components.recurringCommitments).toBe(0);
      expect(result.commitments.length).toBe(0);
    });
  });

  describe('Unbudgeted & Missing Data Resilience', () => {
    it('returns INSUFFICIENT_DATA and LOW confidence for fresh unconfigured home', () => {
      const emptyHomeInput: SafeToSpendInput = {
        homeId: 'home-new',
        homeType: HomeType.FAMILY,
        currency: 'INR',
        referenceDate,
        periodStart,
        periodEnd,
        budget: null,
        protectedReserve: 0,
        postedExpenses: [],
        bills: [],
        recurringExpenses: [],
      };

      const result = calculateSafeToSpend(emptyHomeInput);

      expect(result.status).toBe('INSUFFICIENT_DATA');
      expect(result.confidence).toBe('LOW');
      expect(result.dataSufficiency).toBe('INSUFFICIENT');
      expect(result.components.capacitySource).toBe('UNAVAILABLE');
      expect(result.warnings.some((w) => w.code === 'MISSING_CAPACITY')).toBe(true);
    });

    it('reports PARTIAL sufficiency when bills exist without a budget anchor', () => {
      const inputWithoutBudget: SafeToSpendInput = {
        ...baseInput,
        budget: null,
      };

      const result = calculateSafeToSpend(inputWithoutBudget);

      expect(result.status).toBe('INSUFFICIENT_DATA');
      expect(result.confidence).toBe('LOW');
      expect(result.dataSufficiency).toBe('PARTIAL');
      expect(result.components.capacitySource).toBe('UNAVAILABLE');
    });
  });

  describe('Overdue Bills Detection', () => {
    it('detects overdue bills and generates OVERDUE_BILLS warning', () => {
      const inputWithOverdue: SafeToSpendInput = {
        ...baseInput,
        bills: [
          {
            id: 'b-overdue',
            title: 'Old Gas Bill',
            amount: 1200,
            dueDate: new Date('2026-10-08'), // before referenceDate Oct 15
            status: BillStatus.UNPAID,
          },
        ],
      };

      const result = calculateSafeToSpend(inputWithOverdue);

      const overdueItem = result.obligations.find((o) => o.id === 'b-overdue');
      expect(overdueItem?.isOverdue).toBe(true);
      expect(overdueItem?.status).toBe(BillStatus.OVERDUE);

      const overdueWarning = result.warnings.find((w) => w.code === 'OVERDUE_BILLS');
      expect(overdueWarning).toBeDefined();
      expect(overdueWarning?.severity).toBe('HIGH');
    });
  });

  describe('Mathematical Monotonicity Properties', () => {
    it('increasing obligations strictly reduces Safe-to-Spend', () => {
      const res1 = calculateSafeToSpend(baseInput);

      const inputWithExtraBill: SafeToSpendInput = {
        ...baseInput,
        bills: [
          ...baseInput.bills,
          {
            id: 'b-extra',
            title: 'Water',
            amount: 2000,
            dueDate: new Date('2026-10-25'),
            status: BillStatus.UNPAID,
          },
        ],
      };
      const res2 = calculateSafeToSpend(inputWithExtraBill);

      expect(res2.safeToSpend).toBe(res1.safeToSpend - 2000);
    });

    it('increasing protected reserve strictly reduces Safe-to-Spend', () => {
      const res1 = calculateSafeToSpend(baseInput);

      const inputWithHigherReserve: SafeToSpendInput = {
        ...baseInput,
        protectedReserve: baseInput.protectedReserve + 4000,
      };
      const res2 = calculateSafeToSpend(inputWithHigherReserve);

      expect(res2.safeToSpend).toBe(res1.safeToSpend - 4000);
    });
  });
});
