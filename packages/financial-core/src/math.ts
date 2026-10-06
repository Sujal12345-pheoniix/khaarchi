export const CENTS_PER_UNIT = 100;

export function toCents(amount: number): number {
  return Math.round(amount * CENTS_PER_UNIT);
}

export function toMajor(cents: number): number {
  return Number((cents / CENTS_PER_UNIT).toFixed(2));
}

export function roundFinancial(amount: number): number {
  return toMajor(toCents(amount));
}

export interface SplitResult {
  memberId: string;
  amount: number;
  cents: number;
}

export interface ParticipantPercentageInput {
  memberId: string;
  percentage: number;
}

export interface ParticipantShareInput {
  memberId: string;
  shares: number;
}

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
  if (Math.abs(totalPercentage - 100) > 0.01) {
    throw new Error(`Percentages must sum to 100%. Received: ${totalPercentage}%`);
  }

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

export function simplifyDebts(netBalances: { memberId: string; balance: number }[]): SimplifiedDebt[] {
  const debtors: { memberId: string; cents: number }[] = [];
  const creditors: { memberId: string; cents: number }[] = [];

  for (const b of netBalances) {
    const cents = toCents(b.balance);
    if (cents < 0) {
      debtors.push({ memberId: b.memberId, cents: -cents });
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
