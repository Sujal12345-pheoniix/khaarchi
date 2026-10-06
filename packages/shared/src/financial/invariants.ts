import { toCents, toMajor } from './math.js';

export interface SplitValidationInput {
  totalAmount: number;
  splits: { memberId: string; amount: number }[];
}

export interface InvariantValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates Financial Invariant 1:
 * SUM(expense splits) === expense total amount.
 */
export function validateExpenseSplits(input: SplitValidationInput): InvariantValidationResult {
  const totalCents = toCents(input.totalAmount);
  if (totalCents <= 0) {
    return { valid: false, error: 'Total amount must be greater than zero.' };
  }

  if (!input.splits || input.splits.length === 0) {
    return { valid: false, error: 'At least one participant split is required.' };
  }

  let sumSplitsCents = 0;
  const seenMembers = new Set<string>();

  for (const split of input.splits) {
    if (!split.memberId) {
      return { valid: false, error: 'Every split must specify a valid memberId.' };
    }
    if (seenMembers.has(split.memberId)) {
      return { valid: false, error: `Duplicate participant split found for member: ${split.memberId}` };
    }
    seenMembers.add(split.memberId);

    const splitCents = toCents(split.amount);
    if (splitCents <= 0) {
      return { valid: false, error: `Split amount for member ${split.memberId} must be positive.` };
    }
    sumSplitsCents += splitCents;
  }

  if (sumSplitsCents !== totalCents) {
    const diff = toMajor(Math.abs(totalCents - sumSplitsCents));
    return {
      valid: false,
      error: `Financial Invariant Violation: Sum of splits (${toMajor(sumSplitsCents)}) does not equal expense total (${toMajor(totalCents)}). Discrepancy: ${diff}`,
    };
  }

  return { valid: true };
}

/**
 * Validates Financial Invariant 5:
 * Across the entire home, the sum of all members' net balances must equal 0.
 */
export function validateZeroSumLedger(netBalances: { memberId: string; balance: number }[]): InvariantValidationResult {
  let netCentsSum = 0;

  for (const b of netBalances) {
    netCentsSum += toCents(b.balance);
  }

  if (netCentsSum !== 0) {
    return {
      valid: false,
      error: `Financial Invariant Violation: Net balances across home do not sum to zero. Net discrepancy: ${toMajor(netCentsSum)}`,
    };
  }

  return { valid: true };
}

/**
 * Validates Settlement Invariant:
 * Settlement amount cannot exceed the debtor's obligation to the creditor.
 */
export function validateSettlementAmount(
  settlementAmount: number,
  outstandingDebt: number
): InvariantValidationResult {
  const settleCents = toCents(settlementAmount);
  const debtCents = toCents(outstandingDebt);

  if (settleCents <= 0) {
    return { valid: false, error: 'Settlement amount must be greater than zero.' };
  }

  if (settleCents > debtCents) {
    return {
      valid: false,
      error: `Settlement of ${toMajor(settleCents)} exceeds the outstanding debt of ${toMajor(debtCents)}.`,
    };
  }

  return { valid: true };
}
