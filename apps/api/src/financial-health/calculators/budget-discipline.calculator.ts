import { ExpenseCategory, HealthStatus, DataSufficiency, toCents, toMajor } from '@homeexpense/shared';
import { DimensionCalculationOutput } from '../types/financial-health.types.js';

export interface BudgetCategoryInput {
  category: ExpenseCategory;
  allocatedAmount: number;
}

export interface BudgetInput {
  totalBudget: number;
  categories: BudgetCategoryInput[];
}

export interface ExpenseItemInput {
  amount: number;
  category: ExpenseCategory;
}

export interface BudgetDisciplineInput {
  budget: BudgetInput | null;
  currentExpenses: ExpenseItemInput[];
  daysInPeriod: number;
  daysElapsed: number;
}

export function calculateBudgetDiscipline(input: BudgetDisciplineInput): DimensionCalculationOutput {
  const { budget, currentExpenses, daysInPeriod, daysElapsed } = input;

  // 1. Missing budget handling
  if (!budget || budget.totalBudget <= 0) {
    const totalSpentCents = currentExpenses.reduce((sum, e) => sum + toCents(e.amount), 0);
    return {
      key: 'BUDGET_DISCIPLINE',
      label: 'Budget Discipline',
      score: null,
      status: HealthStatus.BUILDING_PROFILE,
      sufficiency: DataSufficiency.INSUFFICIENT,
      explanation: 'No monthly household budget defined. Set category envelopes to track budget discipline.',
      metrics: {
        totalBudget: null,
        totalSpent: toMajor(totalSpentCents),
        utilizationPercentage: null,
        remainingBudget: null,
        exceededCategoryCount: 0,
      },
    };
  }

  const totalBudgetCents = toCents(budget.totalBudget);
  const totalSpentCents = currentExpenses.reduce((sum, e) => sum + toCents(e.amount), 0);
  const totalSpent = toMajor(totalSpentCents);
  const totalBudget = toMajor(totalBudgetCents);

  const utilizationRatio = totalSpentCents / totalBudgetCents;
  const utilizationPercentage = Number((utilizationRatio * 100).toFixed(1));
  const remainingBudgetCents = Math.max(0, totalBudgetCents - totalSpentCents);
  const remainingBudget = toMajor(remainingBudgetCents);

  // 2. Category overrun tracking
  const categorySpentMap = new Map<ExpenseCategory, number>();
  for (const exp of currentExpenses) {
    const prev = categorySpentMap.get(exp.category) || 0;
    categorySpentMap.set(exp.category, prev + toCents(exp.amount));
  }

  let exceededCategoryCount = 0;
  const exceededCategories: { category: ExpenseCategory; allocated: number; spent: number }[] = [];

  for (const cat of budget.categories) {
    const allocatedCents = toCents(cat.allocatedAmount);
    const spentCents = categorySpentMap.get(cat.category) || 0;
    if (spentCents > allocatedCents && allocatedCents > 0) {
      exceededCategoryCount++;
      exceededCategories.push({
        category: cat.category,
        allocated: toMajor(allocatedCents),
        spent: toMajor(spentCents),
      });
    }
  }

  // 3. Score calculation
  // Base score from overall envelope utilization:
  // <= 80%: 100
  // 80% - 100%: 100 down to 70
  // 100% - 125%: 70 down to 20
  // > 125%: decay down to 0
  let rawScore = 100;
  if (utilizationRatio <= 0.80) {
    rawScore = 100;
  } else if (utilizationRatio <= 1.00) {
    const progress = (utilizationRatio - 0.80) / 0.20;
    rawScore = 100 - progress * 30; // 100 -> 70
  } else if (utilizationRatio <= 1.25) {
    const progress = (utilizationRatio - 1.00) / 0.25;
    rawScore = 70 - progress * 50; // 70 -> 20
  } else {
    const progress = Math.min(1, (utilizationRatio - 1.25) / 0.25);
    rawScore = Math.max(0, 20 - progress * 20); // 20 -> 0
  }

  // Deduct penalty for individual category overruns (-5 pts per overrun category, capped at -15)
  const categoryPenalty = Math.min(15, exceededCategoryCount * 5);
  const finalScore = Math.max(0, Math.min(100, Math.round(rawScore - categoryPenalty)));

  // 4. Status mapping
  let status: HealthStatus = HealthStatus.HEALTHY;
  if (finalScore >= 90) status = HealthStatus.EXCELLENT;
  else if (finalScore >= 75) status = HealthStatus.HEALTHY;
  else if (finalScore >= 60) status = HealthStatus.WATCH;
  else if (finalScore >= 40) status = HealthStatus.AT_RISK;
  else status = HealthStatus.CRITICAL;

  // 5. Explainable summary
  const daysLeft = Math.max(0, daysInPeriod - daysElapsed);
  let explanation: string;
  if (utilizationRatio > 1.0) {
    explanation = `Budget exceeded by ${(utilizationPercentage - 100).toFixed(1)}% (₹${totalSpent.toLocaleString('en-IN')} spent of ₹${totalBudget.toLocaleString('en-IN')} budget).`;
  } else if (utilizationRatio >= 0.80) {
    explanation = `${utilizationPercentage}% of monthly budget used (₹${totalSpent.toLocaleString('en-IN')} of ₹${totalBudget.toLocaleString('en-IN')}) with ${daysLeft} days remaining.`;
  } else {
    explanation = `Spending within budget (${utilizationPercentage}% used, ₹${remainingBudget.toLocaleString('en-IN')} remaining with ${daysLeft} days left).`;
  }

  if (exceededCategoryCount > 0) {
    explanation += ` ${exceededCategoryCount} category envelope${exceededCategoryCount > 1 ? 's' : ''} exceeded.`;
  }

  return {
    key: 'BUDGET_DISCIPLINE',
    label: 'Budget Discipline',
    score: finalScore,
    status,
    sufficiency: DataSufficiency.FULL,
    explanation,
    metrics: {
      totalBudget,
      totalSpent,
      utilizationPercentage,
      remainingBudget,
      exceededCategoryCount,
      exceededCategories,
      daysInPeriod,
      daysElapsed,
    },
  };
}
