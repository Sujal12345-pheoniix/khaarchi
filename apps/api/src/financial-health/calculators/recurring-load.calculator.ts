import { RecurringInterval, HealthStatus, DataSufficiency, toCents, toMajor } from '@homeexpense/shared';
import { DimensionCalculationOutput } from '../types/financial-health.types.js';

export interface RecurringExpenseItemInput {
  id: string;
  amount: number;
  interval: RecurringInterval;
  active: boolean;
}

export interface RecurringLoadInput {
  recurringExpenses: RecurringExpenseItemInput[];
  comparableMonthlySpend: number; // e.g. baseline monthly average, total budget, or normalized spend
}

export function calculateRecurringLoad(input: RecurringLoadInput): DimensionCalculationOutput {
  const { recurringExpenses, comparableMonthlySpend } = input;

  const activeRecurring = (recurringExpenses || []).filter((r) => r.active);

  // If no recurring obligations exist:
  if (activeRecurring.length === 0) {
    return {
      key: 'RECURRING_LOAD',
      label: 'Recurring Load',
      score: 95,
      status: HealthStatus.EXCELLENT,
      sufficiency: DataSufficiency.FULL,
      explanation: 'No committed recurring expenses. High financial flexibility.',
      metrics: {
        monthlyRecurringCommittedAmount: 0,
        comparableMonthlySpend,
        recurringBurdenRatio: 0,
        activeRecurringCount: 0,
      },
    };
  }

  // Convert each active recurring expense into a monthly integer cents equivalent
  let totalMonthlyCents = 0;
  for (const item of activeRecurring) {
    const itemCents = toCents(item.amount);
    switch (item.interval) {
      case RecurringInterval.DAILY:
        totalMonthlyCents += itemCents * 30;
        break;
      case RecurringInterval.WEEKLY:
        totalMonthlyCents += Math.round(itemCents * (52 / 12));
        break;
      case RecurringInterval.MONTHLY:
        totalMonthlyCents += itemCents;
        break;
      case RecurringInterval.YEARLY:
        totalMonthlyCents += Math.round(itemCents / 12);
        break;
      default:
        totalMonthlyCents += itemCents;
        break;
    }
  }

  const monthlyCommitted = toMajor(totalMonthlyCents);
  const comparableCents = toCents(comparableMonthlySpend);

  // If comparable spend is zero or not established yet
  if (comparableCents <= 0) {
    return {
      key: 'RECURRING_LOAD',
      label: 'Recurring Load',
      score: 80,
      status: HealthStatus.HEALTHY,
      sufficiency: DataSufficiency.PARTIAL,
      explanation: `₹${monthlyCommitted.toLocaleString('en-IN')}/month in committed recurring expenses across ${activeRecurring.length} item${activeRecurring.length > 1 ? 's' : ''}. Spending baseline pending.`,
      metrics: {
        monthlyRecurringCommittedAmount: monthlyCommitted,
        comparableMonthlySpend: 0,
        recurringBurdenRatio: null,
        activeRecurringCount: activeRecurring.length,
      },
    };
  }

  // Burden ratio: monthly committed / comparable monthly spend
  const burdenRatio = totalMonthlyCents / comparableCents;
  const recurringBurdenPercentage = Number((burdenRatio * 100).toFixed(1));

  // Scoring logic:
  // <= 30%: Highly flexible budget -> 100 down to 90
  // 30% - 50%: Moderate recurring burden -> 90 down to 70
  // 50% - 70%: Heavy commitment burden -> 70 down to 40
  // > 70%: Inflexible commitment load -> 40 down to 15
  let rawScore = 100;
  if (burdenRatio <= 0.30) {
    const p = burdenRatio / 0.30;
    rawScore = 100 - p * 10; // 100 -> 90
  } else if (burdenRatio <= 0.50) {
    const p = (burdenRatio - 0.30) / 0.20;
    rawScore = 90 - p * 20; // 90 -> 70
  } else if (burdenRatio <= 0.70) {
    const p = (burdenRatio - 0.50) / 0.20;
    rawScore = 70 - p * 30; // 70 -> 40
  } else {
    const p = Math.min(1, (burdenRatio - 0.70) / 0.30);
    rawScore = Math.max(15, 40 - p * 25); // 40 -> 15
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  // Status mapping
  let status: HealthStatus = HealthStatus.HEALTHY;
  if (finalScore >= 90) status = HealthStatus.EXCELLENT;
  else if (finalScore >= 75) status = HealthStatus.HEALTHY;
  else if (finalScore >= 60) status = HealthStatus.WATCH;
  else if (finalScore >= 40) status = HealthStatus.AT_RISK;
  else status = HealthStatus.CRITICAL;

  let explanation: string;
  if (burdenRatio <= 0.30) {
    explanation = `High financial flexibility: recurring commitments represent ${recurringBurdenPercentage}% of monthly spend (₹${monthlyCommitted.toLocaleString('en-IN')}/mo).`;
  } else if (burdenRatio <= 0.50) {
    explanation = `Moderate recurring burden: recurring bills account for ${recurringBurdenPercentage}% of monthly spend (₹${monthlyCommitted.toLocaleString('en-IN')}/mo).`;
  } else {
    explanation = `Heavy commitment burden: ${recurringBurdenPercentage}% of monthly expenditure is locked into recurring obligations (₹${monthlyCommitted.toLocaleString('en-IN')}/mo).`;
  }

  return {
    key: 'RECURRING_LOAD',
    label: 'Recurring Load',
    score: finalScore,
    status,
    sufficiency: DataSufficiency.FULL,
    explanation,
    metrics: {
      monthlyRecurringCommittedAmount: monthlyCommitted,
      comparableMonthlySpend: toMajor(comparableCents),
      recurringBurdenRatio: recurringBurdenPercentage,
      activeRecurringCount: activeRecurring.length,
    },
  };
}
