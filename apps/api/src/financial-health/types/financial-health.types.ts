import {
  HomeType,
  ExpenseCategory,
  BillStatus,
  RecurringInterval,
  HealthStatus,
  InsightSeverity,
  DataSufficiency,
} from '@homeexpense/shared';

export type HealthDimensionKey =
  | 'BUDGET_DISCIPLINE'
  | 'BILL_READINESS'
  | 'SPENDING_STABILITY'
  | 'DEBT_HEALTH'
  | 'RECURRING_LOAD'
  | 'CONTRIBUTION_BALANCE';

export interface DimensionMetricResult {
  key: HealthDimensionKey;
  label: string;
  score: number | null; // 0 - 100, null if insufficient data
  status: HealthStatus;
  sufficiency: DataSufficiency;
  weight: number; // 0 - 1.0
  weightedContribution: number; // score * weight
  explanation: string;
  metrics: Record<string, any>;
}

export interface DimensionCalculationOutput {
  key: HealthDimensionKey;
  label: string;
  score: number | null;
  status: HealthStatus;
  sufficiency: DataSufficiency;
  explanation: string;
  metrics: Record<string, any>;
}

export interface ScoringProfileConfig {
  profile: HomeType;
  version: string;
  weights: Record<HealthDimensionKey, number>;
}

export interface TrendComparison {
  current: number | null;
  previous: number | null;
  change: number | null;
  direction: 'UP' | 'DOWN' | 'UNCHANGED' | 'NOT_AVAILABLE';
  componentDeltas: {
    dimension: HealthDimensionKey;
    delta: number;
    label: string;
  }[];
}

export interface HealthRuleResult {
  type: string;
  severity: InsightSeverity;
  title: string;
  description: string;
  affectedDomain: string;
  metricValue?: number;
  thresholdValue?: number;
  entityType?: string;
  entityId?: string;
}

export interface FinancialHealthEvaluationResult {
  score: number | null;
  status: HealthStatus;
  scoringVersion: string;
  profile: HomeType;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  dataSufficiency: DataSufficiency;
  period: {
    start: string;
    end: string;
  };
  trend: TrendComparison;
  breakdown: DimensionMetricResult[];
  strengths: { title: string; description: string }[];
  risks: { title: string; description: string; severity: InsightSeverity }[];
  insights: HealthRuleResult[];
}
