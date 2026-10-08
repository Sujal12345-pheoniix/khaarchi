import { InsightSeverity, ExpenseCategory } from '@homeexpense/shared';
import { HealthRuleResult, DimensionCalculationOutput } from '../types/financial-health.types.js';
import { HEALTH_RULES } from './rule-definitions.js';

export interface HealthRulesEngineInput {
  dimensionOutputs: DimensionCalculationOutput[];
  budget?: {
    totalBudget: number;
    categories: { category: ExpenseCategory; allocatedAmount: number }[];
  } | null;
  currentExpenses?: { amount: number; category: ExpenseCategory }[];
  bills?: { id: string; title: string; amount: number; dueDate: Date | string; status: string }[];
  daysInPeriod?: number;
  daysElapsed?: number;
}

export interface EvaluatedRulesResult {
  insights: HealthRuleResult[];
  strengths: { title: string; description: string }[];
  risks: { title: string; description: string; severity: InsightSeverity }[];
}

export function evaluateHealthRules(input: HealthRulesEngineInput): EvaluatedRulesResult {
  const { dimensionOutputs, budget, currentExpenses = [], bills = [], daysInPeriod = 30, daysElapsed = 15 } = input;
  const insights: HealthRuleResult[] = [];
  const strengths: { title: string; description: string }[] = [];
  const risks: { title: string; description: string; severity: InsightSeverity }[] = [];

  const dimMap = new Map<string, DimensionCalculationOutput>();
  for (const d of dimensionOutputs) {
    dimMap.set(d.key, d);
  }

  // ----------------------------------------------------
  // RULE 1: SPENDING_SPIKE
  // ----------------------------------------------------
  const stability = dimMap.get('SPENDING_STABILITY');
  if (stability?.metrics?.deviationPercentage != null) {
    const dev = stability.metrics.deviationPercentage;
    if (dev > HEALTH_RULES.SPENDING_SPIKE.thresholdPercent) {
      const insight: HealthRuleResult = {
        type: HEALTH_RULES.SPENDING_SPIKE.type,
        severity: dev > 40 ? InsightSeverity.CRITICAL : InsightSeverity.WARNING,
        title: 'Spending Surge Detected',
        description: `Projected monthly spend is ${dev}% above your baseline average of ₹${stability.metrics.baselineAverageSpend?.toLocaleString('en-IN')}.`,
        affectedDomain: HEALTH_RULES.SPENDING_SPIKE.affectedDomain,
        metricValue: dev,
        thresholdValue: HEALTH_RULES.SPENDING_SPIKE.thresholdPercent,
      };
      insights.push(insight);
      risks.push({
        title: insight.title,
        description: insight.description,
        severity: insight.severity,
      });
    } else if (dev <= 0 && stability.score && stability.score >= 90) {
      strengths.push({
        title: 'Disciplined Spending Pace',
        description: `Household spending is tracking ${Math.abs(dev)}% below your historical baseline.`,
      });
    }
  }

  // ----------------------------------------------------
  // RULE 2 & 3: BUDGET_WARNING & BUDGET_EXCEEDED & CATEGORY OVERRUNS
  // ----------------------------------------------------
  const budgetDim = dimMap.get('BUDGET_DISCIPLINE');
  if (budget && budget.totalBudget > 0 && budgetDim?.metrics?.utilizationPercentage != null) {
    const utilPct = budgetDim.metrics.utilizationPercentage;
    const totalSpent = budgetDim.metrics.totalSpent;
    const totalBudget = budgetDim.metrics.totalBudget;

    if (utilPct > HEALTH_RULES.BUDGET_EXCEEDED.thresholdPercent) {
      const overspend = (totalSpent - totalBudget).toFixed(2);
      const insight: HealthRuleResult = {
        type: HEALTH_RULES.BUDGET_EXCEEDED.type,
        severity: InsightSeverity.CRITICAL,
        title: 'Monthly Budget Exceeded',
        description: `Total household spending has exceeded the ₹${totalBudget.toLocaleString('en-IN')} budget by ₹${Number(overspend).toLocaleString('en-IN')} (${utilPct}% used).`,
        affectedDomain: HEALTH_RULES.BUDGET_EXCEEDED.affectedDomain,
        metricValue: utilPct,
        thresholdValue: HEALTH_RULES.BUDGET_EXCEEDED.thresholdPercent,
      };
      insights.push(insight);
      risks.push({
        title: insight.title,
        description: insight.description,
        severity: insight.severity,
      });
    } else if (utilPct >= HEALTH_RULES.BUDGET_WARNING.thresholdPercent) {
      const remaining = budgetDim.metrics.remainingBudget;
      const insight: HealthRuleResult = {
        type: HEALTH_RULES.BUDGET_WARNING.type,
        severity: InsightSeverity.WARNING,
        title: 'Budget Approaching Limit',
        description: `Household has utilized ${utilPct}% of its ₹${totalBudget.toLocaleString('en-IN')} budget (₹${remaining?.toLocaleString('en-IN')} remaining).`,
        affectedDomain: HEALTH_RULES.BUDGET_WARNING.affectedDomain,
        metricValue: utilPct,
        thresholdValue: HEALTH_RULES.BUDGET_WARNING.thresholdPercent,
      };
      insights.push(insight);
      risks.push({
        title: insight.title,
        description: insight.description,
        severity: insight.severity,
      });
    } else if (utilPct <= 75 && budgetDim.score && budgetDim.score >= 90) {
      strengths.push({
        title: 'Strong Budget Cushion',
        description: `${100 - utilPct}% of the monthly ₹${totalBudget.toLocaleString('en-IN')} budget remains unspent.`,
      });
    }

    // Specific category envelopes exceeding
    if (budget.categories && budget.categories.length > 0) {
      const catSpent: Record<string, number> = {};
      for (const e of currentExpenses) {
        catSpent[e.category] = (catSpent[e.category] || 0) + e.amount;
      }

      for (const cat of budget.categories) {
        const spent = catSpent[cat.category] || 0;
        const allocated = cat.allocatedAmount;
        if (allocated > 0) {
          const catUtil = Number(((spent / allocated) * 100).toFixed(1));
          if (catUtil > 100) {
            insights.push({
              type: 'CATEGORY_BUDGET_EXCEEDED',
              severity: InsightSeverity.WARNING,
              title: `${formatCategoryName(cat.category)} Envelope Exceeded`,
              description: `${formatCategoryName(cat.category)} spending is ₹${spent.toLocaleString('en-IN')} vs. ₹${allocated.toLocaleString('en-IN')} allocated (${catUtil}%).`,
              affectedDomain: 'BUDGET',
              metricValue: catUtil,
              thresholdValue: 100.0,
            });
          }
        }
      }
    }

    // RULE 5: PROJECTED_OVERSPEND (Deterministic burn-rate projection)
    if (daysElapsed > 3 && daysElapsed < daysInPeriod && utilPct <= 100) {
      const burnRatePerDay = totalSpent / daysElapsed;
      const projectedTotal = burnRatePerDay * daysInPeriod;
      if (projectedTotal > totalBudget * 1.05) {
        const projectedOver = Math.round(projectedTotal - totalBudget);
        insights.push({
          type: HEALTH_RULES.PROJECTED_OVERSPEND.type,
          severity: InsightSeverity.WARNING,
          title: 'Projected Budget Overrun',
          description: `At current spending velocity (₹${Math.round(burnRatePerDay).toLocaleString('en-IN')}/day), household is projected to exceed budget by ₹${projectedOver.toLocaleString('en-IN')}.`,
          affectedDomain: 'BUDGET',
          metricValue: Math.round(projectedTotal),
          thresholdValue: totalBudget,
        });
      }
    }
  }

  // ----------------------------------------------------
  // RULE 4: OVERDUE_BILL & UPCOMING_BILL_DUE
  // ----------------------------------------------------
  const billDim = dimMap.get('BILL_READINESS');
  if (billDim?.metrics) {
    const overdueCount = billDim.metrics.overdueCount || 0;
    const overdueAmount = billDim.metrics.overdueAmount || 0;
    if (overdueCount > 0) {
      const insight: HealthRuleResult = {
        type: HEALTH_RULES.OVERDUE_BILL.type,
        severity: InsightSeverity.CRITICAL,
        title: `${overdueCount} Overdue Bill${overdueCount > 1 ? 's' : ''}`,
        description: `${overdueCount} household obligation${overdueCount > 1 ? 's' : ''} totaling ₹${overdueAmount.toLocaleString('en-IN')} are past due date.`,
        affectedDomain: HEALTH_RULES.OVERDUE_BILL.affectedDomain,
        metricValue: overdueAmount,
      };
      insights.push(insight);
      risks.push({
        title: insight.title,
        description: insight.description,
        severity: insight.severity,
      });
    }

    const upcoming7Count = billDim.metrics.upcomingDue7DaysCount || 0;
    const upcoming7Amount = billDim.metrics.upcomingDue7DaysAmount || 0;
    if (upcoming7Count > 0 && overdueCount === 0) {
      insights.push({
        type: HEALTH_RULES.UPCOMING_BILL_DUE.type,
        severity: InsightSeverity.INFO,
        title: `${upcoming7Count} Bill${upcoming7Count > 1 ? 's' : ''} Due This Week`,
        description: `₹${upcoming7Amount.toLocaleString('en-IN')} in scheduled obligations due within the next 7 days.`,
        affectedDomain: 'BILLS',
        metricValue: upcoming7Amount,
      });
    }

    if (overdueCount === 0 && (billDim.metrics.totalBillsCount || 0) > 0) {
      strengths.push({
        title: 'Zero Overdue Bills',
        description: 'All recorded household bills and scheduled payments are completely current.',
      });
    }
  }

  // ----------------------------------------------------
  // RULE 6: HIGH_RECURRING_LOAD
  // ----------------------------------------------------
  const recurringDim = dimMap.get('RECURRING_LOAD');
  if (recurringDim?.metrics?.recurringBurdenRatio != null) {
    const burden = recurringDim.metrics.recurringBurdenRatio;
    const monthlyCommitted = recurringDim.metrics.monthlyRecurringCommittedAmount;
    if (burden >= HEALTH_RULES.HIGH_RECURRING_LOAD.thresholdPercent) {
      const insight: HealthRuleResult = {
        type: HEALTH_RULES.HIGH_RECURRING_LOAD.type,
        severity: InsightSeverity.WARNING,
        title: 'High Recurring Obligation Burden',
        description: `${burden}% of typical monthly spend is committed to recurring expenses (₹${monthlyCommitted.toLocaleString('en-IN')}/month).`,
        affectedDomain: HEALTH_RULES.HIGH_RECURRING_LOAD.affectedDomain,
        metricValue: burden,
        thresholdValue: HEALTH_RULES.HIGH_RECURRING_LOAD.thresholdPercent,
      };
      insights.push(insight);
      risks.push({
        title: insight.title,
        description: insight.description,
        severity: insight.severity,
      });
    } else if (burden <= 25 && recurringDim.score && recurringDim.score >= 90) {
      strengths.push({
        title: 'Lean Fixed Overhead',
        description: `Recurring obligations comprise only ${burden}% of monthly expenditure, maintaining strong financial agility.`,
      });
    }
  }

  // ----------------------------------------------------
  // RULE 7: DEBT_HEALTH
  // ----------------------------------------------------
  const debtDim = dimMap.get('DEBT_HEALTH');
  if (debtDim?.metrics) {
    const debtRatio = debtDim.metrics.unsettledDebtRatio || 0;
    const unsettledDebt = debtDim.metrics.totalUnsettledDebt || 0;
    if (debtRatio >= HEALTH_RULES.HIGH_UNSETTLED_DEBT.thresholdPercent) {
      const insight: HealthRuleResult = {
        type: HEALTH_RULES.HIGH_UNSETTLED_DEBT.type,
        severity: InsightSeverity.WARNING,
        title: 'Unsettled Balances Accumulating',
        description: `₹${unsettledDebt.toLocaleString('en-IN')} in unsettled member balances represents ${debtRatio}% of total household spending.`,
        affectedDomain: HEALTH_RULES.HIGH_UNSETTLED_DEBT.affectedDomain,
        metricValue: debtRatio,
        thresholdValue: HEALTH_RULES.HIGH_UNSETTLED_DEBT.thresholdPercent,
      };
      insights.push(insight);
      risks.push({
        title: insight.title,
        description: insight.description,
        severity: insight.severity,
      });
    } else if (unsettledDebt === 0 && (debtDim.metrics.totalHouseholdSpend || 0) > 0) {
      strengths.push({
        title: 'Fully Reconciled Ledger',
        description: 'All member balances are settled up with zero outstanding debts.',
      });
    }
  }

  return { insights, strengths, risks };
}

function formatCategoryName(category: string): string {
  return category
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
