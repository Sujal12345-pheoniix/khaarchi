import {
  toCents,
  toMajor,
  roundFinancial,
  BillStatus,
} from '@homeexpense/shared';
import {
  SafeToSpendInput,
  SafeToSpendResult,
  SafeToSpendBillItem,
  SafeToSpendRecurringItem,
  CashflowWarning,
  SAFE_TO_SPEND_VERSION,
  ConfidenceLevel,
  CashflowStatus,
} from '../types/cashflow.types.js';

/**
 * Pure, deterministic mathematical calculator for Household Safe-to-Spend.
 * Follows formula:
 * SafeToSpend = AvailableCapacity + ExpectedInflow - PostedExpenses - UpcomingObligations - RecurringCommitments - ProtectedReserve
 *
 * Guarantees:
 * 1. Integer minor units arithmetic (paise/cents) to prevent floating-point drift.
 * 2. Strict double-counting defense for paid bills and already-posted recurring expenses.
 * 3. Preserves legitimate deficits (never clamps negative capacity to zero).
 * 4. Deterministic, side-effect free, 100% reproducible.
 */
export function calculateSafeToSpend(input: SafeToSpendInput): SafeToSpendResult {
  const {
    homeId,
    homeType,
    currency,
    referenceDate,
    periodStart,
    periodEnd,
    budget,
    protectedReserve,
    postedExpenses,
    bills,
    recurringExpenses,
    memberBalances,
    previousPeriodResult,
  } = input;

  const currencySymbol = currency === 'INR' ? '₹' : currency === 'EUR' ? '€' : '$';

  // 1. Calculate Period Day Horizons
  const oneDayMs = 1000 * 60 * 60 * 24;
  const totalDays = Math.max(
    1,
    Math.round((periodEnd.getTime() - periodStart.getTime()) / oneDayMs) + 1
  );
  const remainingMs = periodEnd.getTime() - referenceDate.getTime();
  const daysRemaining = Math.max(1, Math.ceil(remainingMs / oneDayMs));

  // 2. Available Capacity
  const hasBudget = Boolean(budget && budget.totalBudget > 0);
  const availableCapacityCents = hasBudget ? toCents(budget!.totalBudget) : 0;
  const availableCapacity = toMajor(availableCapacityCents);
  const capacitySource = hasBudget ? 'BUDGET_POOL' : 'UNAVAILABLE';

  // 3. Expected Inflow (V1 strictly 0, surfaced in assumptions)
  const expectedInflowCents = 0;
  const expectedInflow = 0;

  // 4. Posted Expenses in Current Evaluation Period
  let postedExpensesCents = 0;
  for (const exp of postedExpenses) {
    postedExpensesCents += toCents(exp.amount);
  }
  const postedExpensesInPeriod = toMajor(postedExpensesCents);
  const postedExpensesInPeriodCents = postedExpensesCents;

  // 5. Upcoming Obligations (Double-Counting Defense: Never count PAID bills)
  const upcomingBills: SafeToSpendBillItem[] = [];
  let upcomingObligationsCents = 0;

  for (const bill of bills) {
    if (bill.status === BillStatus.PAID) {
      // Defense: Paid bills are already settled or recorded in posted expenses
      continue;
    }

    const billDueDate = new Date(bill.dueDate);
    // Include if due before or during this evaluation cycle
    if (billDueDate.getTime() <= periodEnd.getTime()) {
      const billCents = toCents(bill.amount);
      upcomingObligationsCents += billCents;

      const isOverdue =
        bill.status === BillStatus.OVERDUE ||
        billDueDate.getTime() < referenceDate.getTime();

      upcomingBills.push({
        id: bill.id,
        title: bill.title,
        amount: toMajor(billCents),
        dueDate: billDueDate.toISOString(),
        status: isOverdue ? BillStatus.OVERDUE : bill.status,
        isOverdue,
      });
    }
  }
  const upcomingObligations = toMajor(upcomingObligationsCents);

  // 6. Future Recurring Commitments (Double-Counting Defense: Only future runs in cycle)
  const futureCommitments: SafeToSpendRecurringItem[] = [];
  let recurringCommitmentsCents = 0;

  for (const rec of recurringExpenses) {
    if (!rec.active) continue;

    const nextRun = new Date(rec.nextRunAt);
    // Only count if next occurrence is in the future relative to referenceDate and within current period
    if (
      nextRun.getTime() >= referenceDate.getTime() &&
      nextRun.getTime() <= periodEnd.getTime()
    ) {
      const recCents = toCents(rec.amount);
      recurringCommitmentsCents += recCents;

      futureCommitments.push({
        id: rec.id,
        description: rec.description,
        amount: toMajor(recCents),
        nextRunAt: nextRun.toISOString(),
        interval: rec.interval,
        category: rec.category,
      });
    }
  }
  const recurringCommitments = toMajor(recurringCommitmentsCents);

  // 7. Protected Reserve
  const isReserveConfigured = protectedReserve > 0;
  const protectedReserveCents = isReserveConfigured ? toCents(protectedReserve) : 0;
  const reserveMajor = toMajor(protectedReserveCents);

  // 8. Net Unsettled Debts (Bachelor Mode Context)
  let unsettledNetDebtsCents = 0;
  if (memberBalances && memberBalances.length > 0) {
    for (const mb of memberBalances) {
      if (mb.status === 'OWES' && mb.balance < 0) {
        unsettledNetDebtsCents += toCents(Math.abs(mb.balance));
      }
    }
  }
  const unsettledNetDebts = toMajor(unsettledNetDebtsCents);

  // 9. Core Safe-to-Spend Mathematical Deduction (in integer cents)
  let safeToSpendCents: number;
  let status: CashflowStatus;
  let confidence: ConfidenceLevel;
  let dataSufficiency: 'FULL' | 'PARTIAL' | 'INSUFFICIENT';

  if (hasBudget) {
    safeToSpendCents =
      availableCapacityCents +
      expectedInflowCents -
      postedExpensesCents -
      upcomingObligationsCents -
      recurringCommitmentsCents -
      protectedReserveCents;

    // Data sufficiency and confidence for budgeted household
    const hasCommitmentsData = bills.length > 0 || recurringExpenses.length > 0;
    if (hasCommitmentsData) {
      dataSufficiency = 'FULL';
      confidence = 'HIGH';
    } else {
      dataSufficiency = 'PARTIAL';
      confidence = 'MEDIUM';
    }

    if (safeToSpendCents < 0) {
      status = 'DEFICIT';
    } else if (safeToSpendCents === 0) {
      status = 'TIGHT';
    } else {
      const bufferRatio = safeToSpendCents / availableCapacityCents;
      if (safeToSpendCents < 200000 || bufferRatio < 0.1) {
        // Less than ₹2,000 or < 10% remaining
        status = 'TIGHT';
      } else if (bufferRatio < 0.25) {
        status = 'MODERATE';
      } else {
        status = 'HEALTHY';
      }
    }
  } else {
    // Unbudgeted Household
    const totalKnownCommitmentsCents =
      postedExpensesCents +
      upcomingObligationsCents +
      recurringCommitmentsCents +
      protectedReserveCents;

    if (totalKnownCommitmentsCents === 0 && postedExpenses.length === 0) {
      // Brand new home with zero data
      safeToSpendCents = 0;
      status = 'INSUFFICIENT_DATA';
      dataSufficiency = 'INSUFFICIENT';
      confidence = 'LOW';
    } else {
      // Home with activity but no capacity anchor
      safeToSpendCents = -totalKnownCommitmentsCents;
      status = 'INSUFFICIENT_DATA';
      dataSufficiency = 'PARTIAL';
      confidence = 'LOW';
    }
  }

  const safeToSpend = toMajor(safeToSpendCents);
  const dailySafeToSpend = toMajor(Math.round(safeToSpendCents / daysRemaining));

  // 10. Generate Deterministic Warnings
  const warnings: CashflowWarning[] = [];

  if (safeToSpendCents < 0 && hasBudget) {
    const deficitAmount = toMajor(Math.abs(safeToSpendCents));
    warnings.push({
      code: 'NEGATIVE_CAPACITY',
      severity: 'CRITICAL',
      message: `Known obligations and posted spending exceed available capacity by ${currencySymbol}${deficitAmount.toLocaleString()}. Household is in deficit.`,
      recommendation: 'Review discretionary spending and defer non-essential purchases until the next billing cycle.',
    });
  }

  const overdueCount = upcomingBills.filter((b) => b.isOverdue).length;
  if (overdueCount > 0) {
    const overdueTotal = upcomingBills
      .filter((b) => b.isOverdue)
      .reduce((sum, b) => sum + b.amount, 0);
    warnings.push({
      code: 'OVERDUE_BILLS',
      severity: 'HIGH',
      message: `${overdueCount} household bill(s) totaling ${currencySymbol}${overdueTotal.toLocaleString()} are past due.`,
      recommendation: 'Settle overdue bills immediately to avoid penalties or service interruptions.',
    });
  }

  if (hasBudget && availableCapacityCents > 0) {
    const fixedLoadCents = upcomingObligationsCents + recurringCommitmentsCents;
    const fixedRatio = fixedLoadCents / availableCapacityCents;
    if (fixedRatio > 0.7) {
      warnings.push({
        code: 'HIGH_OBLIGATION_BURDEN',
        severity: 'HIGH',
        message: `Fixed bills and recurring commitments consume ${(fixedRatio * 100).toFixed(0)}% of your monthly capacity.`,
        recommendation: 'Discretionary buffer is constrained. Prioritize vital utility and rent payments.',
      });
    }

    const spentRatio = postedExpensesCents / availableCapacityCents;
    if (spentRatio > 0.9 && daysRemaining > 3) {
      warnings.push({
        code: 'BUDGET_EXHAUSTED',
        severity: 'HIGH',
        message: `${(spentRatio * 100).toFixed(0)}% of the monthly budget is already spent with ${daysRemaining} days remaining.`,
        recommendation: 'Slow down non-essential household outlays for the rest of the month.',
      });
    }

    if (safeToSpendCents >= 0 && safeToSpendCents < 200000 && spentRatio <= 0.9) {
      warnings.push({
        code: 'TIGHT_CAPACITY',
        severity: 'LOW',
        message: `Safe-to-spend is tight with only ${currencySymbol}${safeToSpend.toLocaleString()} remaining until the end of the month.`,
      });
    }
  }

  if (!hasBudget) {
    warnings.push({
      code: 'MISSING_CAPACITY',
      severity: 'MEDIUM',
      message: 'Monthly household budget is not set. Safe-to-spend cannot be anchored with high confidence.',
      recommendation: 'Configure your monthly family budget in the Budget Envelopes tab to unlock accurate Safe-to-Spend.',
    });
  }

  // 11. Documented Assumptions
  const assumptions: string[] = [
    'No expected income was included because no authoritative income schedule is modeled in this household.',
  ];

  if (isReserveConfigured) {
    assumptions.push(
      `Protected emergency reserve of ${currencySymbol}${reserveMajor.toLocaleString()} is locked and deducted from spending capacity.`
    );
  } else {
    assumptions.push(
      `Protected reserve is not configured (evaluated as ${currencySymbol}0.00).`
    );
  }

  if (hasBudget) {
    assumptions.push(
      `Available capacity is anchored to the authoritative monthly household budget of ${currencySymbol}${availableCapacity.toLocaleString()}.`
    );
  } else {
    assumptions.push(
      'Household budget is unconfigured; capacity anchor is unavailable.'
    );
  }

  assumptions.push(
    `Future recurring expenses are bounded to the current evaluation cycle ending on ${periodEnd.toISOString().split('T')[0]}.`
  );

  // 12. Period Comparison (if prior period data is supplied)
  let comparison: SafeToSpendResult['comparison'] = undefined;
  if (previousPeriodResult && typeof previousPeriodResult.safeToSpend === 'number') {
    const prev = previousPeriodResult.safeToSpend;
    const diff = roundFinancial(safeToSpend - prev);
    const pct =
      prev !== 0
        ? roundFinancial((diff / Math.abs(prev)) * 100)
        : diff > 0
        ? 100
        : 0;

    comparison = {
      previousPeriodSafeToSpend: prev,
      changeAmount: diff,
      changePercentage: pct,
      trend: diff > 0 ? 'INCREASED' : diff < 0 ? 'DECREASED' : 'STABLE',
    };
  }

  return {
    homeId,
    currency,
    calculationVersion: SAFE_TO_SPEND_VERSION,
    homeType,
    period: {
      start: periodStart.toISOString(),
      end: periodEnd.toISOString(),
      daysRemaining,
      totalDays,
    },
    safeToSpend,
    safeToSpendCents,
    dailySafeToSpend,
    status,
    confidence,
    dataSufficiency,
    components: {
      availableCapacity,
      availableCapacityCents,
      capacitySource,
      expectedInflow,
      expectedInflowCents,
      postedExpensesInPeriod,
      postedExpensesInPeriodCents,
      postedExpensesCount: postedExpenses.length,
      upcomingObligations,
      upcomingObligationsCents,
      obligationsCount: upcomingBills.length,
      recurringCommitments,
      recurringCommitmentsCents,
      commitmentsCount: futureCommitments.length,
      protectedReserve: reserveMajor,
      protectedReserveCents,
      isReserveConfigured,
      unsettledNetDebts,
      unsettledNetDebtsCents,
    },
    obligations: upcomingBills,
    commitments: futureCommitments,
    warnings,
    assumptions,
    comparison,
    generatedAt: referenceDate.toISOString(),
  };
}
