/**
 * HomeExpense Deterministic Financial Math Engine
 *
 * Core Principle: All financial calculations are executed in integer minor units (cents / paise)
 * to eliminate binary floating point drift (e.g., 0.1 + 0.2 = 0.30000000000000004).
 */

export const CENTS_PER_UNIT = 100;

/**
 * Converts a major currency unit (e.g. 10.50) to minor units (1050 cents).
 */
export function toCents(amount: number): number {
  return Math.round(amount * CENTS_PER_UNIT);
}

/**
 * Converts minor currency units (1050 cents) back to major units (10.50).
 */
export function toMajor(cents: number): number {
  return Number((cents / CENTS_PER_UNIT).toFixed(2));
}

/**
 * Deterministically rounds a major unit amount to 2 decimal places.
 */
export function roundFinancial(amount: number): number {
  return toMajor(toCents(amount));
}

export interface ParticipantShareInput {
  memberId: string;
  shares: number; // positive integer/decimal >= 1
}

export interface ParticipantPercentageInput {
  memberId: string;
  percentage: number; // e.g. 33.33
}

export interface SplitResult {
  memberId: string;
  amount: number; // in major currency (e.g. 33.34)
  cents: number;  // in minor currency (e.g. 3334)
}

/**
 * Computes deterministic EQUAL splits.
 * Evenly divides the total amount across all members.
 * Any remainder cents are deterministically assigned 1 cent each starting from the first participant.
 * Guarantees: SUM(splits) === total.
 */
export function calculateEqualSplits(totalAmount: number, memberIds: string[]): SplitResult[] {
  if (memberIds.length === 0) {
    throw new Error('Cannot split an expense with zero participants.');
  }

  const totalCents = toCents(totalAmount);
  if (totalCents <= 0) {
    throw new Error('Total expense amount must be greater than zero.');
  }

  const count = memberIds.length;
  const baseCents = Math.floor(totalCents / count);
  let remainder = totalCents % count;

  return memberIds.map((memberId) => {
    let allocatedCents = baseCents;
    if (remainder > 0) {
      allocatedCents += 1;
      remainder -= 1;
    }
    return {
      memberId,
      cents: allocatedCents,
      amount: toMajor(allocatedCents),
    };
  });
}

/**
 * Computes deterministic PERCENTAGE splits.
 * Validates that percentages sum to 100.00% (within 0.01 tolerance due to 2 decimals).
 * Allocates cents per percentage and adjusts residual cent drift to ensure exact total match.
 */
export function calculatePercentageSplits(
  totalAmount: number,
  participants: ParticipantPercentageInput[]
): SplitResult[] {
  if (participants.length === 0) {
    throw new Error('Participants list cannot be empty.');
  }

  const totalCents = toCents(totalAmount);
  if (totalCents <= 0) {
    throw new Error('Total expense amount must be greater than zero.');
  }

  const totalPercentage = participants.reduce((sum, p) => sum + p.percentage, 0);
  // Strictly enforce 100% (allowing tiny float tolerance up to 0.01%)
  if (Math.abs(totalPercentage - 100) > 0.01) {
    throw new Error(`Percentages must sum to 100%. Received: ${totalPercentage}%`);
  }

  // Calculate unadjusted cents and track fractional residuals
  const calculated = participants.map((p) => {
    const rawCents = (totalCents * p.percentage) / 100;
    const baseCents = Math.floor(rawCents);
    const residual = rawCents - baseCents;
    return {
      memberId: p.memberId,
      baseCents,
      residual,
    };
  });

  const sumBaseCents = calculated.reduce((sum, item) => sum + item.baseCents, 0);
  let remainingCents = totalCents - sumBaseCents;

  // Sort by highest residual to deterministically distribute remaining cents
  const sortedIndices = [...calculated.keys()].sort((a, b) => {
    const diff = calculated[b].residual - calculated[a].residual;
    return diff !== 0 ? diff : a - b;
  });

  for (const idx of sortedIndices) {
    if (remainingCents <= 0) break;
    calculated[idx].baseCents += 1;
    remainingCents -= 1;
  }

  return calculated.map((item) => ({
    memberId: item.memberId,
    cents: item.baseCents,
    amount: toMajor(item.baseCents),
  }));
}

/**
 * Computes deterministic SHARES splits.
 * Allocates amount proportional to the number of shares.
 */
export function calculateSharesSplits(
  totalAmount: number,
  participants: ParticipantShareInput[]
): SplitResult[] {
  if (participants.length === 0) {
    throw new Error('Participants list cannot be empty.');
  }

  const totalCents = toCents(totalAmount);
  if (totalCents <= 0) {
    throw new Error('Total expense amount must be greater than zero.');
  }

  const totalShares = participants.reduce((sum, p) => sum + p.shares, 0);
  if (totalShares <= 0) {
    throw new Error('Total shares must be greater than zero.');
  }

  const calculated = participants.map((p) => {
    const rawCents = (totalCents * p.shares) / totalShares;
    const baseCents = Math.floor(rawCents);
    const residual = rawCents - baseCents;
    return {
      memberId: p.memberId,
      baseCents,
      residual,
    };
  });

  const sumBaseCents = calculated.reduce((sum, item) => sum + item.baseCents, 0);
  let remainingCents = totalCents - sumBaseCents;

  const sortedIndices = [...calculated.keys()].sort((a, b) => {
    const diff = calculated[b].residual - calculated[a].residual;
    return diff !== 0 ? diff : a - b;
  });

  for (const idx of sortedIndices) {
    if (remainingCents <= 0) break;
    calculated[idx].baseCents += 1;
    remainingCents -= 1;
  }

  return calculated.map((item) => ({
    memberId: item.memberId,
    cents: item.baseCents,
    amount: toMajor(item.baseCents),
  }));
}

export interface SimplifiedDebt {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  cents: number;
}

/**
 * Minimizes settlement transactions across a home.
 * Given net balances for each member where SUM(net) === 0:
 * Outputs the minimum number of pairwise settlements required to resolve all debts.
 */
export function simplifyDebts(netBalances: { memberId: string; balance: number }[]): SimplifiedDebt[] {
  const debtors: { memberId: string; cents: number }[] = [];
  const creditors: { memberId: string; cents: number }[] = [];

  for (const b of netBalances) {
    const cents = toCents(b.balance);
    if (cents < 0) {
      debtors.push({ memberId: b.memberId, cents: -cents }); // store as positive debt
    } else if (cents > 0) {
      creditors.push({ memberId: b.memberId, cents });
    }
  }

  const settlements: SimplifiedDebt[] = [];
  let dIndex = 0;
  let cIndex = 0;

  while (dIndex < debtors.length && cIndex < creditors.length) {
    const debtor = debtors[dIndex];
    const creditor = creditors[cIndex];

    const settleCents = Math.min(debtor.cents, creditor.cents);
    if (settleCents > 0) {
      settlements.push({
        fromMemberId: debtor.memberId,
        toMemberId: creditor.memberId,
        cents: settleCents,
        amount: toMajor(settleCents),
      });

      debtor.cents -= settleCents;
      creditor.cents -= settleCents;
    }

    if (debtor.cents === 0) dIndex++;
    if (creditor.cents === 0) cIndex++;
  }

  return settlements;
}
