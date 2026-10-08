import { InsightSeverity } from '@homeexpense/shared';

export interface HealthRuleDefinition {
  type: string;
  defaultSeverity: InsightSeverity;
  affectedDomain: string;
  descriptionTemplate: string;
}

export const HEALTH_RULES = {
  SPENDING_SPIKE: {
    type: 'SPENDING_SPIKE',
    defaultSeverity: InsightSeverity.WARNING,
    affectedDomain: 'SPENDING',
    thresholdPercent: 20.0, // > 20% above baseline
  },
  BUDGET_WARNING: {
    type: 'BUDGET_WARNING',
    defaultSeverity: InsightSeverity.WARNING,
    affectedDomain: 'BUDGET',
    thresholdPercent: 85.0, // >= 85% of budget used
  },
  BUDGET_EXCEEDED: {
    type: 'BUDGET_EXCEEDED',
    defaultSeverity: InsightSeverity.CRITICAL,
    affectedDomain: 'BUDGET',
    thresholdPercent: 100.0, // > 100% of budget used
  },
  OVERDUE_BILL: {
    type: 'OVERDUE_BILL',
    defaultSeverity: InsightSeverity.CRITICAL,
    affectedDomain: 'BILLS',
  },
  UPCOMING_BILL_DUE: {
    type: 'UPCOMING_BILL_DUE',
    defaultSeverity: InsightSeverity.INFO,
    affectedDomain: 'BILLS',
    thresholdDays: 5,
  },
  PROJECTED_OVERSPEND: {
    type: 'PROJECTED_OVERSPEND',
    defaultSeverity: InsightSeverity.WARNING,
    affectedDomain: 'BUDGET',
  },
  HIGH_RECURRING_LOAD: {
    type: 'HIGH_RECURRING_LOAD',
    defaultSeverity: InsightSeverity.WARNING,
    affectedDomain: 'RECURRING',
    thresholdPercent: 50.0, // >= 50% recurring commitments
  },
  HIGH_UNSETTLED_DEBT: {
    type: 'HIGH_UNSETTLED_DEBT',
    defaultSeverity: InsightSeverity.WARNING,
    affectedDomain: 'DEBTS',
    thresholdPercent: 30.0, // >= 30% of total spend
  },
};
