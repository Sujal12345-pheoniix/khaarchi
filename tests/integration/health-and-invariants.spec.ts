import { describe, it, expect } from 'vitest';
import {
  calculateEqualSplits,
  calculatePercentageSplits,
  simplifyDebts,
  roundFinancial,
} from '@homeexpense/financial-core';
import { validateApiEnv } from '@homeexpense/validation';

describe('HomeExpense Workspace Integration & Invariant Verification', () => {
  it('enforces deterministic 3-way split with zero float drift', () => {
    const splits = calculateEqualSplits(100.0, ['m1', 'm2', 'm3']);
    expect(splits).toHaveLength(3);
    expect(splits[0].amount).toBe(33.34);
    expect(splits[1].amount).toBe(33.33);
    expect(splits[2].amount).toBe(33.33);

    const sum = splits.reduce((acc, s) => acc + s.amount, 0);
    expect(roundFinancial(sum)).toBe(100.0);
  });

  it('validates percentage splits sum precisely to total', () => {
    const splits = calculatePercentageSplits(250.0, [
      { memberId: 'm1', percentage: 40 },
      { memberId: 'm2', percentage: 60 },
    ]);
    expect(splits[0].amount).toBe(100.0);
    expect(splits[1].amount).toBe(150.0);
    expect(splits[0].amount + splits[1].amount).toBe(250.0);
  });

  it('correctly reduces circular debt: A owes B $20, B owes C $20, C owes A $20 -> $0.00', () => {
    // Net balances: A: 0, B: 0, C: 0
    const netBalances = [
      { memberId: 'A', balance: 0 },
      { memberId: 'B', balance: 0 },
      { memberId: 'C', balance: 0 },
    ];
    const settlements = simplifyDebts(netBalances);
    expect(settlements).toHaveLength(0);
  });

  it('rejects invalid runtime environment configuration', () => {
    expect(() =>
      validateApiEnv({
        NODE_ENV: 'production',
        PORT: 4000,
        DATABASE_URL: 'invalid-url', // Invalid URL
        JWT_SECRET: 'short',        // Less than 32 chars
      })
    ).toThrow(/API Environment validation failed/);
  });
});
