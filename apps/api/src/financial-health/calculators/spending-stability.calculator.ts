import { HealthStatus, DataSufficiency, toCents, toMajor } from '@homeexpense/shared';
import { DimensionCalculationOutput } from '../types/financial-health.types.js';

export interface SpendingStabilityInput {
  currentPeriodSpend: number;
  daysInPeriod: number;
  daysElapsed: number;
  historicalMonthlySpends: number[]; // up to 3 prior completed months
}

export function calculateSpendingStability(input: SpendingStabilityInput): DimensionCalculationOutput {
  const { currentPeriodSpend, daysInPeriod, daysElapsed, historicalMonthlySpends } = input;
  const currentSpendCents = toCents(currentPeriodSpend);
  const currentSpend = toMajor(currentSpendCents);

  // 1. Check historical sufficiency
  if (!historicalMonthlySpends || historicalMonthlySpends.length === 0) {
    return {
      key: 'SPENDING_STABILITY',
      label: 'Spending Stability',
      score: null,
      status: HealthStatus.BUILDING_PROFILE,
      sufficiency: DataSufficiency.INSUFFICIENT,
      explanation: 'Insufficient historical data. Complete at least one monthly spending cycle to establish a spending baseline.',
      metrics: {
        currentSpend,
        normalizedProjectedSpend: currentSpend,
        baselineAverageSpend: null,
        deviationPercentage: null,
        historicalMonthsCount: 0,
      },
    };
  }

  // 2. Baseline calculation (integer cents)
  const sumBaselineCents = historicalMonthlySpends.reduce((acc, s) => acc + toCents(s), 0);
  const baselineCents = Math.round(sumBaselineCents / historicalMonthlySpends.length);
  const baselineAverageSpend = toMajor(baselineCents);

  // 3. Normalized spend projection for partial month
  // If baseline is 0 or extremely low
  if (baselineCents <= 0) {
    return {
      key: 'SPENDING_STABILITY',
      label: 'Spending Stability',
      score: 100,
      status: HealthStatus.EXCELLENT,
      sufficiency: DataSufficiency.PARTIAL,
      explanation: 'Zero historical baseline expenditures recorded.',
      metrics: {
        currentSpend,
        normalizedProjectedSpend: currentSpend,
        baselineAverageSpend: 0,
        deviationPercentage: 0,
        historicalMonthsCount: historicalMonthlySpends.length,
      },
    };
  }

  // Avoid division by zero: ensure at least 1 day elapsed
  const effectiveDaysElapsed = Math.max(1, Math.min(daysElapsed, daysInPeriod));
  const elapsedRatio = effectiveDaysElapsed / daysInPeriod;
  const normalizedProjectedCents = Math.round(currentSpendCents / elapsedRatio);
  const normalizedProjectedSpend = toMajor(normalizedProjectedCents);

  // 4. Percentage deviation against baseline
  // deviation = ((normalized - baseline) / baseline) * 100
  const deviation = ((normalizedProjectedCents - baselineCents) / baselineCents) * 100;
  const deviationPercentage = Number(deviation.toFixed(1));

  // 5. Scoring formula
  // Spend <= baseline: 100
  // Spend 0% - 15% above baseline: 100 down to 85 (healthy normal variance)
  // Spend 15% - 35% above baseline: 85 down to 65 (moderate deviation)
  // Spend 35% - 60% above baseline: 65 down to 40 (significant deviation)
  // Spend > 60% above baseline: 40 down to 10 (extreme spike)
  let rawScore = 100;
  if (deviation <= 0) {
    rawScore = 100;
  } else if (deviation <= 15) {
    const p = deviation / 15;
    rawScore = 100 - p * 15; // 100 -> 85
  } else if (deviation <= 35) {
    const p = (deviation - 15) / 20;
    rawScore = 85 - p * 20; // 85 -> 65
  } else if (deviation <= 60) {
    const p = (deviation - 35) / 25;
    rawScore = 65 - p * 25; // 65 -> 40
  } else {
    const p = Math.min(1, (deviation - 60) / 40);
    rawScore = Math.max(10, 40 - p * 30); // 40 -> 10
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  // 6. Status mapping
  let status: HealthStatus = HealthStatus.HEALTHY;
  if (finalScore >= 90) status = HealthStatus.EXCELLENT;
  else if (finalScore >= 75) status = HealthStatus.HEALTHY;
  else if (finalScore >= 60) status = HealthStatus.WATCH;
  else if (finalScore >= 40) status = HealthStatus.AT_RISK;
  else status = HealthStatus.CRITICAL;

  const sufficiency =
    historicalMonthlySpends.length >= 3 ? DataSufficiency.FULL : DataSufficiency.PARTIAL;

  // 7. Clear, measurable explanation
  let explanation: string;
  if (deviationPercentage <= 0) {
    explanation = `Spending is on track: projected ₹${normalizedProjectedSpend.toLocaleString('en-IN')} is ${Math.abs(deviationPercentage)}% below your ${historicalMonthlySpends.length}-month baseline (₹${baselineAverageSpend.toLocaleString('en-IN')}).`;
  } else if (deviationPercentage <= 15) {
    explanation = `Spending is stable: projected ₹${normalizedProjectedSpend.toLocaleString('en-IN')} is within ${deviationPercentage}% of your baseline average (₹${baselineAverageSpend.toLocaleString('en-IN')}).`;
  } else if (deviationPercentage <= 35) {
    explanation = `Moderate spending elevation: normalized monthly spend is ${deviationPercentage}% above baseline (₹${normalizedProjectedSpend.toLocaleString('en-IN')} vs. ₹${baselineAverageSpend.toLocaleString('en-IN')}).`;
  } else {
    explanation = `Significant spending spike detected: projected ₹${normalizedProjectedSpend.toLocaleString('en-IN')} is ${deviationPercentage}% higher than your baseline average of ₹${baselineAverageSpend.toLocaleString('en-IN')}.`;
  }

  return {
    key: 'SPENDING_STABILITY',
    label: 'Spending Stability',
    score: finalScore,
    status,
    sufficiency,
    explanation,
    metrics: {
      currentSpend,
      normalizedProjectedSpend,
      baselineAverageSpend,
      deviationPercentage,
      historicalMonthsCount: historicalMonthlySpends.length,
      daysInPeriod,
      daysElapsed,
    },
  };
}
