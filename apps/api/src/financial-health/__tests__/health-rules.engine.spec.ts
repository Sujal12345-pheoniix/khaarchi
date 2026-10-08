import { describe, it, expect } from 'vitest';
import { evaluateHealthRules } from '../rules/health-rules.engine.js';
import { InsightSeverity, ExpenseCategory, HealthStatus, DataSufficiency } from '@homeexpense/shared';
import { DimensionCalculationOutput } from '../types/financial-health.types.js';

describe('Health Rules Engine', () => {
  it('triggers SPENDING_SPIKE when projected spend exceeds threshold', () => {
    const dimensions: DimensionCalculationOutput[] = [
      {
        key: 'SPENDING_STABILITY',
        label: 'Spending Stability',
        score: 60,
        status: HealthStatus.WATCH,
        sufficiency: DataSufficiency.FULL,
        explanation: '',
        metrics: {
          deviationPercentage: 28.5,
          baselineAverageSpend: 50000,
        },
      },
    ];

    const result = evaluateHealthRules({
      dimensionOutputs: dimensions,
    });

    const spike = result.insights.find((i) => i.type === 'SPENDING_SPIKE');
    expect(spike).toBeDefined();
    expect(spike?.severity).toBe(InsightSeverity.WARNING);
    expect(spike?.metricValue).toBe(28.5);
    expect(spike?.description).toContain('28.5% above your baseline average');
  });

  it('triggers BUDGET_EXCEEDED when budget utilization is over 100%', () => {
    const dimensions: DimensionCalculationOutput[] = [
      {
        key: 'BUDGET_DISCIPLINE',
        label: 'Budget Discipline',
        score: 30,
        status: HealthStatus.CRITICAL,
        sufficiency: DataSufficiency.FULL,
        explanation: '',
        metrics: {
          totalBudget: 40000,
          totalSpent: 46000,
          utilizationPercentage: 115.0,
          remainingBudget: 0,
        },
      },
    ];

    const result = evaluateHealthRules({
      dimensionOutputs: dimensions,
      budget: { totalBudget: 40000, categories: [] },
    });

    const exceeded = result.insights.find((i) => i.type === 'BUDGET_EXCEEDED');
    expect(exceeded).toBeDefined();
    expect(exceeded?.severity).toBe(InsightSeverity.CRITICAL);
    expect(exceeded?.description).toContain('exceeded the ₹40,000 budget by ₹6,000');
  });

  it('triggers OVERDUE_BILL with exact overdue amount and count', () => {
    const dimensions: DimensionCalculationOutput[] = [
      {
        key: 'BILL_READINESS',
        label: 'Bill Readiness',
        score: 30,
        status: HealthStatus.CRITICAL,
        sufficiency: DataSufficiency.FULL,
        explanation: '',
        metrics: {
          overdueCount: 2,
          overdueAmount: 4200,
        },
      },
    ];

    const result = evaluateHealthRules({
      dimensionOutputs: dimensions,
    });

    const overdue = result.insights.find((i) => i.type === 'OVERDUE_BILL');
    expect(overdue).toBeDefined();
    expect(overdue?.severity).toBe(InsightSeverity.CRITICAL);
    expect(overdue?.title).toBe('2 Overdue Bills');
    expect(overdue?.description).toContain('₹4,200 are past due date');
  });

  it('triggers HIGH_RECURRING_LOAD when recurring commitments reach 50%+', () => {
    const dimensions: DimensionCalculationOutput[] = [
      {
        key: 'RECURRING_LOAD',
        label: 'Recurring Load',
        score: 65,
        status: HealthStatus.WATCH,
        sufficiency: DataSufficiency.FULL,
        explanation: '',
        metrics: {
          recurringBurdenRatio: 54.0,
          monthlyRecurringCommittedAmount: 27000,
        },
      },
    ];

    const result = evaluateHealthRules({
      dimensionOutputs: dimensions,
    });

    const recurring = result.insights.find((i) => i.type === 'HIGH_RECURRING_LOAD');
    expect(recurring).toBeDefined();
    expect(recurring?.severity).toBe(InsightSeverity.WARNING);
    expect(recurring?.metricValue).toBe(54.0);
    expect(recurring?.description).toContain('54% of typical monthly spend');
  });
});
