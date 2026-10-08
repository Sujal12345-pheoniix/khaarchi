import { HomeType, HealthStatus, DataSufficiency, toCents, toMajor } from '@homeexpense/shared';
import { DimensionCalculationOutput } from '../types/financial-health.types.js';

export interface MemberContributionItem {
  memberId: string;
  name: string;
  amountPaid: number;
}

export interface ContributionBalanceInput {
  homeType: HomeType;
  memberContributions: MemberContributionItem[];
  totalSpend: number;
}

export function calculateContributionBalance(input: ContributionBalanceInput): DimensionCalculationOutput {
  const { homeType, memberContributions, totalSpend } = input;

  // 1. Bachelor mode: Contribution balance is not applicable
  if (homeType === HomeType.BACHELOR) {
    return {
      key: 'CONTRIBUTION_BALANCE',
      label: 'Contribution Balance',
      score: null,
      status: HealthStatus.BUILDING_PROFILE,
      sufficiency: DataSufficiency.INSUFFICIENT,
      explanation: 'Not applicable in Bachelor mode. Debt Health and settlement velocity govern shared flat equilibrium.',
      metrics: {
        isApplicable: false,
      },
    };
  }

  // 2. Family mode without sufficient members or spending
  if (!memberContributions || memberContributions.length <= 1 || totalSpend <= 0) {
    return {
      key: 'CONTRIBUTION_BALANCE',
      label: 'Contribution Balance',
      score: null,
      status: HealthStatus.BUILDING_PROFILE,
      sufficiency: DataSufficiency.INSUFFICIENT,
      explanation: 'Family contribution balance requires active expenditure across multiple household members.',
      metrics: {
        isApplicable: true,
        memberCount: memberContributions?.length || 0,
        totalSpend,
      },
    };
  }

  // 3. In Family mode with active members and spend:
  // Measure member share of household contributions
  const totalSpendCents = toCents(totalSpend);
  const memberCount = memberContributions.length;
  const expectedShareRatio = 1 / memberCount;

  let maxDeviation = 0;
  const memberBreakdown: Record<string, { name: string; amount: number; percentage: number }> = {};

  for (const m of memberContributions) {
    const paidCents = toCents(m.amountPaid);
    const actualShareRatio = totalSpendCents > 0 ? paidCents / totalSpendCents : 0;
    const deviation = Math.abs(actualShareRatio - expectedShareRatio);
    if (deviation > maxDeviation) {
      maxDeviation = deviation;
    }
    memberBreakdown[m.memberId] = {
      name: m.name,
      amount: toMajor(paidCents),
      percentage: Number((actualShareRatio * 100).toFixed(1)),
    };
  }

  // Scoring logic:
  // Balanced deviation <= 15%: 95 - 100
  // Moderate deviation 15% - 35%: 75 - 90
  // High deviation > 35%: 60 - 75
  let rawScore = 100;
  if (maxDeviation <= 0.15) {
    rawScore = 95;
  } else if (maxDeviation <= 0.35) {
    const p = (maxDeviation - 0.15) / 0.20;
    rawScore = 90 - p * 15; // 90 -> 75
  } else {
    const p = Math.min(1, (maxDeviation - 0.35) / 0.35);
    rawScore = Math.max(50, 75 - p * 25); // 75 -> 50
  }

  const finalScore = Math.round(rawScore);

  let status: HealthStatus = HealthStatus.HEALTHY;
  if (finalScore >= 90) status = HealthStatus.EXCELLENT;
  else if (finalScore >= 75) status = HealthStatus.HEALTHY;
  else if (finalScore >= 60) status = HealthStatus.WATCH;
  else status = HealthStatus.AT_RISK;

  let explanation: string;
  if (finalScore >= 90) {
    explanation = `Balanced financial contributions across ${memberCount} household members.`;
  } else if (finalScore >= 75) {
    explanation = `Moderate contribution spread between members in pooled family expenses.`;
  } else {
    explanation = `Single member carries disproportionate share of pooled household expenses.`;
  }

  return {
    key: 'CONTRIBUTION_BALANCE',
    label: 'Contribution Balance',
    score: finalScore,
    status,
    sufficiency: DataSufficiency.FULL,
    explanation,
    metrics: {
      isApplicable: true,
      memberCount,
      totalSpend: toMajor(totalSpendCents),
      maxDeviationPercentage: Number((maxDeviation * 100).toFixed(1)),
      memberBreakdown,
    },
  };
}
