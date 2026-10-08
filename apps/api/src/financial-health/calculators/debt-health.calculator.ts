import { HealthStatus, DataSufficiency, toCents, toMajor } from '@homeexpense/shared';
import { DimensionCalculationOutput } from '../types/financial-health.types.js';

export interface MemberBalanceItem {
  memberId: string;
  balance: number; // positive = owed, negative = owes, 0 = settled
  status: 'OWED' | 'OWES' | 'SETTLED';
}

export interface DebtHealthInput {
  memberBalances: MemberBalanceItem[];
  totalSpending: number;
  totalExpenseCount: number;
}

export function calculateDebtHealth(input: DebtHealthInput): DimensionCalculationOutput {
  const { memberBalances, totalSpending, totalExpenseCount } = input;

  // 1. If no expenses exist yet
  if (!memberBalances || memberBalances.length === 0 || totalExpenseCount === 0) {
    return {
      key: 'DEBT_HEALTH',
      label: 'Debt Health',
      score: 100,
      status: HealthStatus.EXCELLENT,
      sufficiency: DataSufficiency.FULL,
      explanation: 'No outstanding debts or unsettled balances in this household.',
      metrics: {
        totalUnsettledDebt: 0,
        totalHouseholdSpend: 0,
        unsettledDebtRatio: 0,
        debtorCount: 0,
        maxIndividualDebt: 0,
      },
    };
  }

  // 2. Calculate total unsettled debt across the household
  // In a zero-sum ledger, sum(positive) === -sum(negative).
  // Total unsettled debt in flight is sum(positive balances).
  let unsettledCents = 0;
  let debtorCount = 0;
  let maxDebtorCents = 0;

  for (const mb of memberBalances) {
    const cents = toCents(mb.balance);
    if (cents < 0) {
      debtorCount++;
      const absCents = Math.abs(cents);
      if (absCents > maxDebtorCents) {
        maxDebtorCents = absCents;
      }
    } else if (cents > 0) {
      unsettledCents += cents;
    }
  }

  const totalUnsettledDebt = toMajor(unsettledCents);
  const maxIndividualDebt = toMajor(maxDebtorCents);
  const totalSpendCents = toCents(totalSpending);
  const totalHouseholdSpend = toMajor(totalSpendCents);

  // If debts are completely settled: perfect score 100
  if (unsettledCents === 0) {
    return {
      key: 'DEBT_HEALTH',
      label: 'Debt Health',
      score: 100,
      status: HealthStatus.EXCELLENT,
      sufficiency: DataSufficiency.FULL,
      explanation: 'All member balances are fully settled with zero outstanding debt.',
      metrics: {
        totalUnsettledDebt: 0,
        totalHouseholdSpend,
        unsettledDebtRatio: 0,
        debtorCount: 0,
        maxIndividualDebt: 0,
      },
    };
  }

  // 3. Ratio of unsettled debt relative to total expenditure
  const debtRatio = totalSpendCents > 0 ? unsettledCents / totalSpendCents : 1.0;
  const unsettledDebtRatio = Number((debtRatio * 100).toFixed(1));

  // 4. Scoring logic
  // Unsettled debt ratio <= 15%: 100 down to 85 (low, healthy float)
  // 15% - 35%: 85 down to 65 (moderate debt accumulation)
  // 35% - 60%: 65 down to 40 (high debt concentration)
  // > 60%: 40 down to 15 (critical delayed settlements)
  let rawScore = 100;
  if (debtRatio <= 0.15) {
    const p = debtRatio / 0.15;
    rawScore = 100 - p * 15; // 100 -> 85
  } else if (debtRatio <= 0.35) {
    const p = (debtRatio - 0.15) / 0.20;
    rawScore = 85 - p * 20; // 85 -> 65
  } else if (debtRatio <= 0.60) {
    const p = (debtRatio - 0.35) / 0.25;
    rawScore = 65 - p * 25; // 65 -> 40
  } else {
    const p = Math.min(1, (debtRatio - 0.60) / 0.40);
    rawScore = Math.max(15, 40 - p * 25); // 40 -> 15
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  // 5. Status mapping
  let status: HealthStatus = HealthStatus.HEALTHY;
  if (finalScore >= 90) status = HealthStatus.EXCELLENT;
  else if (finalScore >= 75) status = HealthStatus.HEALTHY;
  else if (finalScore >= 60) status = HealthStatus.WATCH;
  else if (finalScore >= 40) status = HealthStatus.AT_RISK;
  else status = HealthStatus.CRITICAL;

  // 6. Explanation
  let explanation: string;
  if (finalScore >= 85) {
    explanation = `Low unsettled debt: ₹${totalUnsettledDebt.toLocaleString('en-IN')} outstanding across ${debtorCount} member${debtorCount > 1 ? 's' : ''} (${unsettledDebtRatio}% of total spend).`;
  } else if (finalScore >= 65) {
    explanation = `Moderate outstanding debt: ₹${totalUnsettledDebt.toLocaleString('en-IN')} pending settlement (${unsettledDebtRatio}% of total household spend).`;
  } else {
    explanation = `High debt concentration: ₹${totalUnsettledDebt.toLocaleString('en-IN')} unsettled (${unsettledDebtRatio}% of spend). Settle up recommended.`;
  }

  return {
    key: 'DEBT_HEALTH',
    label: 'Debt Health',
    score: finalScore,
    status,
    sufficiency: DataSufficiency.FULL,
    explanation,
    metrics: {
      totalUnsettledDebt,
      totalHouseholdSpend,
      unsettledDebtRatio,
      debtorCount,
      maxIndividualDebt,
    },
  };
}
