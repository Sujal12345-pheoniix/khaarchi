import { describe, it, expect } from 'vitest';
import {
  calculateEqualSplits,
  calculatePercentageSplits,
  calculateSharesSplits,
  simplifyDebts,
  toCents,
  toMajor,
  roundFinancial,
} from '../financial/math.js';
import {
  validateExpenseSplits,
  validateZeroSumLedger,
  validateSettlementAmount,
} from '../financial/invariants.js';

describe('Deterministic Financial Math Engine', () => {
  describe('Cents & Precision Utilities', () => {
    it('accurately converts major units to integer minor units without float error', () => {
      expect(toCents(10.55)).toBe(1055);
      expect(toCents(0.1 + 0.2)).toBe(30); // 0.30000000000000004 resolved to 30 cents
    });

    it('accurately converts cents back to major currency unit', () => {
      expect(toMajor(1055)).toBe(10.55);
      expect(toMajor(30)).toBe(0.3);
    });

    it('deterministically rounds currency', () => {
      expect(roundFinancial(100.333333)).toBe(100.33);
      expect(roundFinancial(100.336)).toBe(100.34);
    });
  });

  describe('calculateEqualSplits', () => {
    it('splits 100 into 3 parts with exact remainder distribution', () => {
      const splits = calculateEqualSplits(100, ['user-1', 'user-2', 'user-3']);
      expect(splits).toHaveLength(3);
      expect(splits[0].amount).toBe(33.34);
      expect(splits[1].amount).toBe(33.33);
      expect(splits[2].amount).toBe(33.33);

      const totalCalculated = splits.reduce((sum, s) => sum + s.amount, 0);
      expect(roundFinancial(totalCalculated)).toBe(100.0);
    });

    it('splits 50 evenly into 2 parts', () => {
      const splits = calculateEqualSplits(50, ['user-1', 'user-2']);
      expect(splits[0].amount).toBe(25.0);
      expect(splits[1].amount).toBe(25.0);
      expect(splits[0].amount + splits[1].amount).toBe(50.0);
    });

    it('throws error when no participants provided or amount is non-positive', () => {
      expect(() => calculateEqualSplits(100, [])).toThrow();
      expect(() => calculateEqualSplits(0, ['user-1'])).toThrow();
      expect(() => calculateEqualSplits(-50, ['user-1'])).toThrow();
    });
  });

  describe('calculatePercentageSplits', () => {
    it('splits 100 with 33.33%, 33.33%, 33.34% and reconciles to 100.00', () => {
      const participants = [
        { memberId: 'm1', percentage: 33.33 },
        { memberId: 'm2', percentage: 33.33 },
        { memberId: 'm3', percentage: 33.34 },
      ];
      const splits = calculatePercentageSplits(100, participants);
      const total = splits.reduce((sum, s) => sum + s.amount, 0);
      expect(roundFinancial(total)).toBe(100.0);
    });

    it('throws when percentages do not sum to 100%', () => {
      const participants = [
        { memberId: 'm1', percentage: 50 },
        { memberId: 'm2', percentage: 40 },
      ];
      expect(() => calculatePercentageSplits(100, participants)).toThrow(
        /Percentages must sum to 100%/
      );
    });
  });

  describe('calculateSharesSplits', () => {
    it('splits 100 into 1, 2, and 3 shares accurately summing to 100.00', () => {
      const participants = [
        { memberId: 'm1', shares: 1 },
        { memberId: 'm2', shares: 2 },
        { memberId: 'm3', shares: 3 },
      ];
      const splits = calculateSharesSplits(100, participants);
      const total = splits.reduce((sum, s) => sum + s.amount, 0);
      expect(roundFinancial(total)).toBe(100.0);
      expect(splits[0].amount).toBe(16.67);
      expect(splits[1].amount).toBe(33.33);
      expect(splits[2].amount).toBe(50.0);
    });
  });

  describe('Financial Invariants Validation', () => {
    it('validates that SUM(splits) === total amount', () => {
      const valid = validateExpenseSplits({
        totalAmount: 100,
        splits: [
          { memberId: 'm1', amount: 50 },
          { memberId: 'm2', amount: 50 },
        ],
      });
      expect(valid.valid).toBe(true);

      const invalid = validateExpenseSplits({
        totalAmount: 100,
        splits: [
          { memberId: 'm1', amount: 50 },
          { memberId: 'm2', amount: 49.99 },
        ],
      });
      expect(invalid.valid).toBe(false);
      expect(invalid.error).toMatch(/Financial Invariant Violation/);
    });

    it('rejects duplicate member splits', () => {
      const duplicate = validateExpenseSplits({
        totalAmount: 100,
        splits: [
          { memberId: 'm1', amount: 50 },
          { memberId: 'm1', amount: 50 },
        ],
      });
      expect(duplicate.valid).toBe(false);
      expect(duplicate.error).toMatch(/Duplicate participant/);
    });

    it('validates zero-sum ledger across home members', () => {
      const reconciled = validateZeroSumLedger([
        { memberId: 'm1', balance: 50 },
        { memberId: 'm2', balance: -20 },
        { memberId: 'm3', balance: -30 },
      ]);
      expect(reconciled.valid).toBe(true);

      const unreconciled = validateZeroSumLedger([
        { memberId: 'm1', balance: 50 },
        { memberId: 'm2', balance: -20 },
      ]);
      expect(unreconciled.valid).toBe(false);
      expect(unreconciled.error).toMatch(/Net balances across home do not sum to zero/);
    });

    it('validates settlement amount does not exceed debt', () => {
      expect(validateSettlementAmount(50, 100).valid).toBe(true);
      expect(validateSettlementAmount(100, 100).valid).toBe(true);

      const exceeded = validateSettlementAmount(100.01, 100);
      expect(exceeded.valid).toBe(false);
      expect(exceeded.error).toMatch(/exceeds the outstanding debt/);
    });
  });

  describe('simplifyDebts', () => {
    it('simplifies transitive debt chain: A owes B $10, B owes C $10 -> A owes C $10', () => {
      // Net balances:
      // A: -10
      // B: +10 - 10 = 0
      // C: +10
      const netBalances = [
        { memberId: 'A', balance: -10 },
        { memberId: 'B', balance: 0 },
        { memberId: 'C', balance: 10 },
      ];

      const settlements = simplifyDebts(netBalances);
      expect(settlements).toHaveLength(1);
      expect(settlements[0]).toEqual({
        fromMemberId: 'A',
        toMemberId: 'C',
        cents: 1000,
        amount: 10.0,
      });
    });
  });
});
