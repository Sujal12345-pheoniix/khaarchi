import { describe, it, expect } from 'vitest';
import { ExpenseCategory, BillStatus, RecurringInterval, HealthStatus, DataSufficiency, HomeType } from '@homeexpense/shared';
import { calculateBudgetDiscipline } from '../calculators/budget-discipline.calculator.js';
import { calculateBillReadiness } from '../calculators/bill-readiness.calculator.js';
import { calculateSpendingStability } from '../calculators/spending-stability.calculator.js';
import { calculateDebtHealth } from '../calculators/debt-health.calculator.js';
import { calculateRecurringLoad } from '../calculators/recurring-load.calculator.js';
import { calculateContributionBalance } from '../calculators/contribution-balance.calculator.js';

describe('Financial Health Domain Calculators', () => {
  describe('Budget Discipline Calculator', () => {
    it('returns BUILDING_PROFILE when no budget is defined', () => {
      const result = calculateBudgetDiscipline({
        budget: null,
        currentExpenses: [{ amount: 500, category: ExpenseCategory.GROCERIES }],
        daysInPeriod: 30,
        daysElapsed: 15,
      });

      expect(result.score).toBeNull();
      expect(result.status).toBe(HealthStatus.BUILDING_PROFILE);
      expect(result.sufficiency).toBe(DataSufficiency.INSUFFICIENT);
      expect(result.metrics.totalSpent).toBe(500);
    });

    it('returns 100 for utilization <= 80% with no category overruns', () => {
      const result = calculateBudgetDiscipline({
        budget: {
          totalBudget: 10000,
          categories: [
            { category: ExpenseCategory.GROCERIES, allocatedAmount: 5000 },
            { category: ExpenseCategory.UTILITIES, allocatedAmount: 5000 },
          ],
        },
        currentExpenses: [
          { amount: 3000, category: ExpenseCategory.GROCERIES },
          { amount: 3500, category: ExpenseCategory.UTILITIES },
        ],
        daysInPeriod: 30,
        daysElapsed: 20,
      });

      expect(result.score).toBe(100);
      expect(result.status).toBe(HealthStatus.EXCELLENT);
      expect(result.metrics.utilizationPercentage).toBe(65.0);
      expect(result.metrics.remainingBudget).toBe(3500);
    });

    it('linearly penalizes budget utilization between 80% and 100%', () => {
      const result = calculateBudgetDiscipline({
        budget: {
          totalBudget: 10000,
          categories: [{ category: ExpenseCategory.GROCERIES, allocatedAmount: 10000 }],
        },
        currentExpenses: [{ amount: 9000, category: ExpenseCategory.GROCERIES }], // 90%
        daysInPeriod: 30,
        daysElapsed: 25,
      });

      // 90% is midway between 80% and 100%: 100 - (0.5 * 30) = 85
      expect(result.score).toBe(85);
      expect(result.status).toBe(HealthStatus.HEALTHY);
    });

    it('penalizes exceeded budget and category overruns', () => {
      const result = calculateBudgetDiscipline({
        budget: {
          totalBudget: 10000,
          categories: [
            { category: ExpenseCategory.GROCERIES, allocatedAmount: 4000 },
            { category: ExpenseCategory.DINING_OUT, allocatedAmount: 2000 },
          ],
        },
        currentExpenses: [
          { amount: 5500, category: ExpenseCategory.GROCERIES }, // exceeded
          { amount: 3000, category: ExpenseCategory.DINING_OUT }, // exceeded
          { amount: 2500, category: ExpenseCategory.ENTERTAINMENT },
        ], // Total = 11,000 (110% utilization)
        daysInPeriod: 30,
        daysElapsed: 25,
      });

      // 110% utilization: progress = (1.10 - 1.0) / 0.25 = 0.4 -> raw = 70 - 20 = 50
      // 2 category overruns (-10 pts) -> 40
      expect(result.score).toBe(40);
      expect(result.status).toBe(HealthStatus.AT_RISK);
      expect(result.metrics.exceededCategoryCount).toBe(2);
    });
  });

  describe('Bill Readiness Calculator', () => {
    const referenceDate = new Date('2026-10-15T12:00:00Z');

    it('returns 100 when there are no bills', () => {
      const result = calculateBillReadiness({ bills: [], referenceDate });
      expect(result.score).toBe(100);
      expect(result.status).toBe(HealthStatus.EXCELLENT);
    });

    it('heavily penalizes overdue bills', () => {
      const result = calculateBillReadiness({
        bills: [
          {
            id: 'b1',
            title: 'Electricity',
            amount: 2500,
            dueDate: new Date('2026-10-10T12:00:00Z'), // 5 days past due
            status: BillStatus.UNPAID,
          },
        ],
        referenceDate,
      });

      // 1 overdue bill: 100 - 35 = 65
      expect(result.score).toBe(65);
      expect(result.metrics.overdueCount).toBe(1);
      expect(result.metrics.overdueAmount).toBe(2500);
    });

    it('reaches 0 when 3 or more overdue bills exist', () => {
      const result = calculateBillReadiness({
        bills: [
          { id: 'b1', title: 'Rent', amount: 15000, dueDate: new Date('2026-10-01'), status: BillStatus.OVERDUE },
          { id: 'b2', title: 'WiFi', amount: 1000, dueDate: new Date('2026-10-05'), status: BillStatus.UNPAID },
          { id: 'b3', title: 'Water', amount: 500, dueDate: new Date('2026-10-08'), status: BillStatus.UNPAID },
        ],
        referenceDate,
      });

      expect(result.score).toBe(0);
      expect(result.status).toBe(HealthStatus.CRITICAL);
    });
  });

  describe('Spending Stability Calculator', () => {
    it('returns BUILDING_PROFILE when no historical months exist', () => {
      const result = calculateSpendingStability({
        currentPeriodSpend: 15000,
        daysInPeriod: 30,
        daysElapsed: 15,
        historicalMonthlySpends: [],
      });

      expect(result.score).toBeNull();
      expect(result.status).toBe(HealthStatus.BUILDING_PROFILE);
      expect(result.sufficiency).toBe(DataSufficiency.INSUFFICIENT);
    });

    it('normalizes partial month and scores stable spend within 10%', () => {
      // 15 days elapsed in 30 day month: 15,000 spend normalizes to 30,000 full month projection
      // Baseline average: 30,000
      // Deviation: 0% -> Score 100
      const result = calculateSpendingStability({
        currentPeriodSpend: 15000,
        daysInPeriod: 30,
        daysElapsed: 15,
        historicalMonthlySpends: [30000, 30000, 30000],
      });

      expect(result.score).toBe(100);
      expect(result.metrics.normalizedProjectedSpend).toBe(30000);
      expect(result.metrics.baselineAverageSpend).toBe(30000);
      expect(result.metrics.deviationPercentage).toBe(0);
    });

    it('penalizes significant spending spike above historical baseline', () => {
      // 15 days elapsed: 24,000 spend normalizes to 48,000
      // Baseline average: 32,000
      // Deviation: +50%
      const result = calculateSpendingStability({
        currentPeriodSpend: 24000,
        daysInPeriod: 30,
        daysElapsed: 15,
        historicalMonthlySpends: [32000, 32000],
      });

      // 50% deviation: p = (50 - 35) / 25 = 0.6 -> 65 - 0.6 * 25 = 50
      expect(result.score).toBe(50);
      expect(result.metrics.deviationPercentage).toBe(50);
      expect(result.status).toBe(HealthStatus.AT_RISK);
    });
  });

  describe('Debt Health Calculator', () => {
    it('returns 100 when all member balances are settled', () => {
      const result = calculateDebtHealth({
        memberBalances: [
          { memberId: 'm1', balance: 0, status: 'SETTLED' },
          { memberId: 'm2', balance: 0, status: 'SETTLED' },
        ],
        totalSpending: 25000,
        totalExpenseCount: 12,
      });

      expect(result.score).toBe(100);
      expect(result.status).toBe(HealthStatus.EXCELLENT);
      expect(result.metrics.totalUnsettledDebt).toBe(0);
    });

    it('scores low debt float (<= 15% of spending) in healthy 85-100 range', () => {
      const result = calculateDebtHealth({
        memberBalances: [
          { memberId: 'm1', balance: 1000, status: 'OWED' },
          { memberId: 'm2', balance: -1000, status: 'OWES' },
        ],
        totalSpending: 20000, // 1000 / 20000 = 5%
        totalExpenseCount: 10,
      });

      expect(result.score).toBeGreaterThanOrEqual(90);
      expect(result.metrics.totalUnsettledDebt).toBe(1000);
      expect(result.metrics.unsettledDebtRatio).toBe(5.0);
    });

    it('penalizes high unsettled debt (> 60% of spending)', () => {
      const result = calculateDebtHealth({
        memberBalances: [
          { memberId: 'm1', balance: 7000, status: 'OWED' },
          { memberId: 'm2', balance: -7000, status: 'OWES' },
        ],
        totalSpending: 10000, // 70% debt ratio
        totalExpenseCount: 3,
      });

      expect(result.score).toBeLessThanOrEqual(40);
      expect(result.status).toBe(HealthStatus.CRITICAL);
    });
  });

  describe('Recurring Load Calculator', () => {
    it('returns 95 when there are zero recurring commitments', () => {
      const result = calculateRecurringLoad({
        recurringExpenses: [],
        comparableMonthlySpend: 40000,
      });

      expect(result.score).toBe(95);
      expect(result.metrics.monthlyRecurringCommittedAmount).toBe(0);
    });

    it('converts weekly and yearly intervals to monthly equivalents and scores moderate load', () => {
      // Maid: 1000/week -> 1000 * (52 / 12) = 4333.33
      // WiFi: 12000/year -> 1000/month
      // Rent: 15000/month
      // Total monthly = 20,333.33
      // Comparable monthly spend: 50,000 -> burden = 40.67%
      const result = calculateRecurringLoad({
        recurringExpenses: [
          { id: 'r1', amount: 1000, interval: RecurringInterval.WEEKLY, active: true },
          { id: 'r2', amount: 12000, interval: RecurringInterval.YEARLY, active: true },
          { id: 'r3', amount: 15000, interval: RecurringInterval.MONTHLY, active: true },
          { id: 'r4', amount: 5000, interval: RecurringInterval.MONTHLY, active: false }, // inactive ignored
        ],
        comparableMonthlySpend: 50000,
      });

      expect(result.metrics.activeRecurringCount).toBe(3);
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.score).toBeLessThanOrEqual(85);
    });
  });

  describe('Contribution Balance Calculator', () => {
    it('marks N/A in Bachelor mode', () => {
      const result = calculateContributionBalance({
        homeType: HomeType.BACHELOR,
        memberContributions: [
          { memberId: 'm1', name: 'Alice', amountPaid: 5000 },
          { memberId: 'm2', name: 'Bob', amountPaid: 5000 },
        ],
        totalSpend: 10000,
      });

      expect(result.score).toBeNull();
      expect(result.sufficiency).toBe(DataSufficiency.INSUFFICIENT);
    });

    it('scores balanced contributions across family members', () => {
      const result = calculateContributionBalance({
        homeType: HomeType.FAMILY,
        memberContributions: [
          { memberId: 'm1', name: 'Father', amountPaid: 26000 },
          { memberId: 'm2', name: 'Mother', amountPaid: 24000 },
        ],
        totalSpend: 50000,
      });

      expect(result.score).toBe(95);
      expect(result.status).toBe(HealthStatus.EXCELLENT);
    });
  });
});
