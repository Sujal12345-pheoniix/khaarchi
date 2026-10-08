import { describe, it, expect } from 'vitest';
import { evaluateHealthScore } from '../scoring/health-score.engine.js';
import {
  HEALTH_SCORE_PROFILE_V1_FAMILY,
  HEALTH_SCORE_PROFILE_V1_BACHELOR,
} from '../scoring/scoring-profiles.js';
import { HealthStatus, DataSufficiency } from '@homeexpense/shared';
import { DimensionCalculationOutput } from '../types/financial-health.types.js';

describe('Health Score Engine & Profiles', () => {
  it('validates Family profile weights sum exactly to 1.00', () => {
    const weights = Object.values(HEALTH_SCORE_PROFILE_V1_FAMILY.weights);
    const sum = weights.reduce((a, b) => a + b, 0);
    expect(Number(sum.toFixed(4))).toBe(1.0);
  });

  it('validates Bachelor profile weights sum exactly to 1.00', () => {
    const weights = Object.values(HEALTH_SCORE_PROFILE_V1_BACHELOR.weights);
    const sum = weights.reduce((a, b) => a + b, 0);
    expect(Number(sum.toFixed(4))).toBe(1.0);
  });

  it('matches Section 39 specification precisely (Expected: 82.60 -> Final display score: 83)', () => {
    // Section 39:
    // Budget = 76 (weight 0.25) -> 19.00
    // Bills = 94 (weight 0.20) -> 18.80
    // Stability = 83 (weight 0.20) -> 16.60
    // Contribution = 82 (weight 0.15) -> 12.30
    // Recurring = 68 (weight 0.10) -> 6.80
    // Debt = 91 (weight 0.10) -> 9.10
    // Sum = 82.60 -> Display Score = 83
    const fixtureDimensions: DimensionCalculationOutput[] = [
      {
        key: 'BUDGET_DISCIPLINE',
        label: 'Budget Discipline',
        score: 76,
        status: HealthStatus.HEALTHY,
        sufficiency: DataSufficiency.FULL,
        explanation: 'Budget discipline at 76',
        metrics: {},
      },
      {
        key: 'BILL_READINESS',
        label: 'Bill Readiness',
        score: 94,
        status: HealthStatus.EXCELLENT,
        sufficiency: DataSufficiency.FULL,
        explanation: 'Bills readiness at 94',
        metrics: {},
      },
      {
        key: 'SPENDING_STABILITY',
        label: 'Spending Stability',
        score: 83,
        status: HealthStatus.HEALTHY,
        sufficiency: DataSufficiency.FULL,
        explanation: 'Spending stability at 83',
        metrics: {},
      },
      {
        key: 'CONTRIBUTION_BALANCE',
        label: 'Contribution Balance',
        score: 82,
        status: HealthStatus.HEALTHY,
        sufficiency: DataSufficiency.FULL,
        explanation: 'Contribution balance at 82',
        metrics: {},
      },
      {
        key: 'RECURRING_LOAD',
        label: 'Recurring Load',
        score: 68,
        status: HealthStatus.WATCH,
        sufficiency: DataSufficiency.FULL,
        explanation: 'Recurring load at 68',
        metrics: {},
      },
      {
        key: 'DEBT_HEALTH',
        label: 'Debt Health',
        score: 91,
        status: HealthStatus.EXCELLENT,
        sufficiency: DataSufficiency.FULL,
        explanation: 'Debt health at 91',
        metrics: {},
      },
    ];

    const result = evaluateHealthScore(fixtureDimensions, HEALTH_SCORE_PROFILE_V1_FAMILY);

    expect(result.score).toBe(83);
    expect(result.status).toBe(HealthStatus.HEALTHY);
    expect(result.confidence).toBe('HIGH');
    expect(result.dataSufficiency).toBe(DataSufficiency.FULL);

    const budgetBreakdown = result.breakdown.find((b) => b.key === 'BUDGET_DISCIPLINE');
    expect(budgetBreakdown?.weightedContribution).toBe(19.0);

    const billBreakdown = result.breakdown.find((b) => b.key === 'BILL_READINESS');
    expect(billBreakdown?.weightedContribution).toBe(18.8);

    const stabilityBreakdown = result.breakdown.find((b) => b.key === 'SPENDING_STABILITY');
    expect(stabilityBreakdown?.weightedContribution).toBe(16.6);

    const contribBreakdown = result.breakdown.find((b) => b.key === 'CONTRIBUTION_BALANCE');
    expect(contribBreakdown?.weightedContribution).toBe(12.3);

    const recurringBreakdown = result.breakdown.find((b) => b.key === 'RECURRING_LOAD');
    expect(recurringBreakdown?.weightedContribution).toBe(6.8);

    const debtBreakdown = result.breakdown.find((b) => b.key === 'DEBT_HEALTH');
    expect(debtBreakdown?.weightedContribution).toBe(9.1);
  });

  it('correctly re-normalizes weights when a dimension is missing (dynamic redistribution)', () => {
    // Suppose Budget Discipline is missing (score = null) in Family Mode
    // Active dimensions: Bills (0.20), Stability (0.20), Contrib (0.15), Recurring (0.10), Debt (0.10)
    // Sum of active base weights = 0.75
    // Weights are normalized by dividing by 0.75
    const dimensions: DimensionCalculationOutput[] = [
      {
        key: 'BUDGET_DISCIPLINE',
        label: 'Budget Discipline',
        score: null,
        status: HealthStatus.BUILDING_PROFILE,
        sufficiency: DataSufficiency.INSUFFICIENT,
        explanation: 'No budget set',
        metrics: {},
      },
      {
        key: 'BILL_READINESS',
        label: 'Bill Readiness',
        score: 100,
        status: HealthStatus.EXCELLENT,
        sufficiency: DataSufficiency.FULL,
        explanation: 'All bills paid',
        metrics: {},
      },
      {
        key: 'SPENDING_STABILITY',
        label: 'Spending Stability',
        score: 100,
        status: HealthStatus.EXCELLENT,
        sufficiency: DataSufficiency.FULL,
        explanation: 'Stable spend',
        metrics: {},
      },
      {
        key: 'DEBT_HEALTH',
        label: 'Debt Health',
        score: 100,
        status: HealthStatus.EXCELLENT,
        sufficiency: DataSufficiency.FULL,
        explanation: 'No debts',
        metrics: {},
      },
      {
        key: 'RECURRING_LOAD',
        label: 'Recurring Load',
        score: 100,
        status: HealthStatus.EXCELLENT,
        sufficiency: DataSufficiency.FULL,
        explanation: 'No recurring load',
        metrics: {},
      },
      {
        key: 'CONTRIBUTION_BALANCE',
        label: 'Contribution Balance',
        score: null,
        status: HealthStatus.BUILDING_PROFILE,
        sufficiency: DataSufficiency.INSUFFICIENT,
        explanation: 'N/A',
        metrics: {},
      },
    ];

    const result = evaluateHealthScore(dimensions, HEALTH_SCORE_PROFILE_V1_FAMILY);

    // Active dimensions have score 100, so score must be 100 without dropping to zero
    expect(result.score).toBe(100);
    expect(result.status).toBe(HealthStatus.EXCELLENT);
    expect(result.dataSufficiency).toBe(DataSufficiency.PARTIAL);
  });

  it('returns BUILDING_PROFILE with score = null when data sufficiency is insufficient', () => {
    const emptyDimensions: DimensionCalculationOutput[] = [
      {
        key: 'BUDGET_DISCIPLINE',
        label: 'Budget Discipline',
        score: null,
        status: HealthStatus.BUILDING_PROFILE,
        sufficiency: DataSufficiency.INSUFFICIENT,
        explanation: 'No budget',
        metrics: {},
      },
      {
        key: 'BILL_READINESS',
        label: 'Bill Readiness',
        score: null,
        status: HealthStatus.BUILDING_PROFILE,
        sufficiency: DataSufficiency.INSUFFICIENT,
        explanation: 'No bills',
        metrics: {},
      },
      {
        key: 'SPENDING_STABILITY',
        label: 'Spending Stability',
        score: null,
        status: HealthStatus.BUILDING_PROFILE,
        sufficiency: DataSufficiency.INSUFFICIENT,
        explanation: 'No history',
        metrics: {},
      },
      {
        key: 'DEBT_HEALTH',
        label: 'Debt Health',
        score: null,
        status: HealthStatus.BUILDING_PROFILE,
        sufficiency: DataSufficiency.INSUFFICIENT,
        explanation: 'No debts',
        metrics: {},
      },
      {
        key: 'RECURRING_LOAD',
        label: 'Recurring Load',
        score: null,
        status: HealthStatus.BUILDING_PROFILE,
        sufficiency: DataSufficiency.INSUFFICIENT,
        explanation: 'No recurring',
        metrics: {},
      },
      {
        key: 'CONTRIBUTION_BALANCE',
        label: 'Contribution Balance',
        score: null,
        status: HealthStatus.BUILDING_PROFILE,
        sufficiency: DataSufficiency.INSUFFICIENT,
        explanation: 'N/A',
        metrics: {},
      },
    ];

    const result = evaluateHealthScore(emptyDimensions, HEALTH_SCORE_PROFILE_V1_FAMILY);

    expect(result.score).toBeNull();
    expect(result.status).toBe(HealthStatus.BUILDING_PROFILE);
    expect(result.dataSufficiency).toBe(DataSufficiency.INSUFFICIENT);
    expect(result.confidence).toBe('LOW');
  });

  it('guarantees identical output across multiple runs (determinism invariant)', () => {
    const fixture: DimensionCalculationOutput[] = [
      {
        key: 'BUDGET_DISCIPLINE',
        label: 'Budget',
        score: 80,
        status: HealthStatus.HEALTHY,
        sufficiency: DataSufficiency.FULL,
        explanation: '',
        metrics: {},
      },
      {
        key: 'BILL_READINESS',
        label: 'Bills',
        score: 90,
        status: HealthStatus.EXCELLENT,
        sufficiency: DataSufficiency.FULL,
        explanation: '',
        metrics: {},
      },
      {
        key: 'SPENDING_STABILITY',
        label: 'Stability',
        score: 75,
        status: HealthStatus.HEALTHY,
        sufficiency: DataSufficiency.FULL,
        explanation: '',
        metrics: {},
      },
      {
        key: 'DEBT_HEALTH',
        label: 'Debt',
        score: 85,
        status: HealthStatus.HEALTHY,
        sufficiency: DataSufficiency.FULL,
        explanation: '',
        metrics: {},
      },
      {
        key: 'RECURRING_LOAD',
        label: 'Recurring',
        score: 70,
        status: HealthStatus.WATCH,
        sufficiency: DataSufficiency.FULL,
        explanation: '',
        metrics: {},
      },
      {
        key: 'CONTRIBUTION_BALANCE',
        label: 'Contribution',
        score: null,
        status: HealthStatus.BUILDING_PROFILE,
        sufficiency: DataSufficiency.INSUFFICIENT,
        explanation: '',
        metrics: {},
      },
    ];

    const run1 = evaluateHealthScore(fixture, HEALTH_SCORE_PROFILE_V1_BACHELOR);
    const run2 = evaluateHealthScore(fixture, HEALTH_SCORE_PROFILE_V1_BACHELOR);
    const run3 = evaluateHealthScore(fixture, HEALTH_SCORE_PROFILE_V1_BACHELOR);

    expect(run1).toEqual(run2);
    expect(run2).toEqual(run3);
  });
});
