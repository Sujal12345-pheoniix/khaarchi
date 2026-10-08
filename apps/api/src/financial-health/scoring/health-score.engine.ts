import { HealthStatus, DataSufficiency } from '@homeexpense/shared';
import {
  DimensionCalculationOutput,
  DimensionMetricResult,
  ScoringProfileConfig,
  HealthDimensionKey,
} from '../types/financial-health.types.js';
import { mapScoreToHealthStatus } from './health-status.mapper.js';

export interface HealthScoreEngineResult {
  score: number | null;
  status: HealthStatus;
  dataSufficiency: DataSufficiency;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  breakdown: DimensionMetricResult[];
}

export function evaluateHealthScore(
  dimensions: DimensionCalculationOutput[],
  profileConfig: ScoringProfileConfig
): HealthScoreEngineResult {
  // 1. Identify which dimensions are active with non-null scores
  const activeDimensions: { output: DimensionCalculationOutput; baseWeight: number }[] = [];
  const inactiveDimensions: { output: DimensionCalculationOutput; baseWeight: number }[] = [];

  for (const dim of dimensions) {
    const baseWeight = profileConfig.weights[dim.key] ?? 0;
    if (dim.score !== null && baseWeight > 0) {
      activeDimensions.push({ output: dim, baseWeight });
    } else {
      inactiveDimensions.push({ output: dim, baseWeight });
    }
  }

  // 2. Evaluate Sufficiency & Confidence
  // If no active dimensions or only 1 dimension available with insufficient activity
  if (activeDimensions.length < 2) {
    const breakdown: DimensionMetricResult[] = dimensions.map((dim) => {
      const baseWeight = profileConfig.weights[dim.key] ?? 0;
      return {
        key: dim.key,
        label: dim.label,
        score: dim.score,
        status: dim.status,
        sufficiency: dim.sufficiency,
        weight: baseWeight,
        weightedContribution: 0,
        explanation: dim.explanation,
        metrics: dim.metrics,
      };
    });

    return {
      score: null,
      status: HealthStatus.BUILDING_PROFILE,
      dataSufficiency: DataSufficiency.INSUFFICIENT,
      confidence: 'LOW',
      breakdown,
    };
  }

  // 3. Dynamic Weight Re-normalization for available dimensions
  const sumActiveWeights = activeDimensions.reduce((sum, item) => sum + item.baseWeight, 0);

  let weightedSum = 0;
  const breakdown: DimensionMetricResult[] = [];

  for (const active of activeDimensions) {
    // Re-normalize weight so that active weights sum deterministically to 1.000
    const normalizedWeight = Number((active.baseWeight / sumActiveWeights).toFixed(4));
    const contribution = Number(((active.output.score! * normalizedWeight)).toFixed(2));
    weightedSum += contribution;

    breakdown.push({
      key: active.output.key,
      label: active.output.label,
      score: active.output.score,
      status: active.output.status,
      sufficiency: active.output.sufficiency,
      weight: normalizedWeight,
      weightedContribution: contribution,
      explanation: active.output.explanation,
      metrics: active.output.metrics,
    });
  }

  for (const inactive of inactiveDimensions) {
    breakdown.push({
      key: inactive.output.key,
      label: inactive.output.label,
      score: inactive.output.score,
      status: inactive.output.status,
      sufficiency: inactive.output.sufficiency,
      weight: 0,
      weightedContribution: 0,
      explanation: inactive.output.explanation,
      metrics: inactive.output.metrics,
    });
  }

  // Preserve consistent order of dimensions
  const orderMap: Record<HealthDimensionKey, number> = {
    BUDGET_DISCIPLINE: 1,
    BILL_READINESS: 2,
    SPENDING_STABILITY: 3,
    DEBT_HEALTH: 4,
    RECURRING_LOAD: 5,
    CONTRIBUTION_BALANCE: 6,
  };
  breakdown.sort((a, b) => (orderMap[a.key] || 99) - (orderMap[b.key] || 99));

  // 4. Calculate Final Deterministic Score
  const finalScore = Math.max(0, Math.min(100, Math.round(weightedSum)));

  // 5. Determine Data Sufficiency
  // In Bachelor mode: 5 dimensions applicable (Contribution is 0%)
  // In Family mode: 6 dimensions applicable
  const totalApplicableCount = Object.values(profileConfig.weights).filter((w) => w > 0).length;
  let dataSufficiency: DataSufficiency;
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW';

  if (activeDimensions.length === totalApplicableCount) {
    dataSufficiency = DataSufficiency.FULL;
    confidence = 'HIGH';
  } else if (activeDimensions.length >= 3) {
    dataSufficiency = DataSufficiency.PARTIAL;
    confidence = 'MEDIUM';
  } else {
    dataSufficiency = DataSufficiency.PARTIAL;
    confidence = 'LOW';
  }

  const status = mapScoreToHealthStatus(finalScore, dataSufficiency);

  return {
    score: finalScore,
    status,
    dataSufficiency,
    confidence,
    breakdown,
  };
}
