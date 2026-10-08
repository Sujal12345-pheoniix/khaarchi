import { TrendComparison, DimensionMetricResult, HealthDimensionKey } from '../types/financial-health.types.js';

export interface PreviousSnapshotData {
  score: number | null;
  dimensionScores: Record<string, { score: number | null; weightedContribution: number }>;
}

export function calculateScoreTrend(
  currentScore: number | null,
  currentBreakdown: DimensionMetricResult[],
  previousSnapshot: PreviousSnapshotData | null
): TrendComparison {
  if (currentScore === null || !previousSnapshot || previousSnapshot.score === null) {
    return {
      current: currentScore,
      previous: previousSnapshot?.score ?? null,
      change: null,
      direction: 'NOT_AVAILABLE',
      componentDeltas: [],
    };
  }

  const change = currentScore - previousSnapshot.score;
  let direction: 'UP' | 'DOWN' | 'UNCHANGED' = 'UNCHANGED';
  if (change > 0) direction = 'UP';
  else if (change < 0) direction = 'DOWN';

  const componentDeltas: {
    dimension: HealthDimensionKey;
    delta: number;
    label: string;
  }[] = [];

  for (const dim of currentBreakdown) {
    const prevDim = previousSnapshot.dimensionScores?.[dim.key];
    if (prevDim && prevDim.score != null && dim.score != null) {
      // Calculate delta in weighted contribution
      const rawDelta = dim.score - prevDim.score;
      if (rawDelta !== 0) {
        componentDeltas.push({
          dimension: dim.key,
          delta: rawDelta,
          label: formatDeltaLabel(dim.key, rawDelta),
        });
      }
    }
  }

  // Sort deltas by magnitude (largest positive/negative movers first)
  componentDeltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return {
    current: currentScore,
    previous: previousSnapshot.score,
    change,
    direction,
    componentDeltas,
  };
}

function formatDeltaLabel(key: HealthDimensionKey, delta: number): string {
  const sign = delta > 0 ? '+' : '';
  switch (key) {
    case 'BUDGET_DISCIPLINE':
      return delta > 0 ? `${sign}${delta} Budget discipline improved` : `${delta} Budget utilization increased`;
    case 'BILL_READINESS':
      return delta > 0 ? `${sign}${delta} Scheduled bills cleared` : `${delta} Overdue or upcoming bills pending`;
    case 'SPENDING_STABILITY':
      return delta > 0 ? `${sign}${delta} Spending stabilized closer to baseline` : `${delta} Spending elevated above baseline`;
    case 'DEBT_HEALTH':
      return delta > 0 ? `${sign}${delta} Member balances settled` : `${delta} Outstanding debts accumulated`;
    case 'RECURRING_LOAD':
      return delta > 0 ? `${sign}${delta} Recurring overhead decreased` : `${delta} Recurring commitments increased`;
    case 'CONTRIBUTION_BALANCE':
      return delta > 0 ? `${sign}${delta} Household contributions balanced` : `${delta} Contribution disparity increased`;
    default:
      return `${sign}${delta} ${key}`;
  }
}
