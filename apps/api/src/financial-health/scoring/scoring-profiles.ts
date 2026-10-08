import { HomeType } from '@homeexpense/shared';
import { ScoringProfileConfig, HealthDimensionKey } from '../types/financial-health.types.js';

export const SCORING_ALGORITHM_VERSION = 'FINANCIAL_HEALTH_V1';

/**
 * Family Mode Scoring Profile (V1)
 * Emphasizes budget envelopes, recurring utility readiness, spending stability,
 * and equitable household pooling.
 */
export const HEALTH_SCORE_PROFILE_V1_FAMILY: ScoringProfileConfig = {
  profile: HomeType.FAMILY,
  version: SCORING_ALGORITHM_VERSION,
  weights: {
    BUDGET_DISCIPLINE: 0.25,
    BILL_READINESS: 0.20,
    SPENDING_STABILITY: 0.20,
    CONTRIBUTION_BALANCE: 0.15,
    RECURRING_LOAD: 0.10,
    DEBT_HEALTH: 0.10,
  },
};

/**
 * Bachelor Mode Scoring Profile (V1)
 * Emphasizes debt health, settlement velocity, spending stability,
 * budget discipline, and recurring obligation load.
 * Contribution balance is 0% (N/A for roommate flat sharing).
 */
export const HEALTH_SCORE_PROFILE_V1_BACHELOR: ScoringProfileConfig = {
  profile: HomeType.BACHELOR,
  version: SCORING_ALGORITHM_VERSION,
  weights: {
    DEBT_HEALTH: 0.30,
    SPENDING_STABILITY: 0.20,
    BUDGET_DISCIPLINE: 0.20,
    RECURRING_LOAD: 0.15,
    BILL_READINESS: 0.15,
    CONTRIBUTION_BALANCE: 0.0,
  },
};

export function getScoringProfile(homeType: HomeType): ScoringProfileConfig {
  if (homeType === HomeType.FAMILY) {
    return HEALTH_SCORE_PROFILE_V1_FAMILY;
  }
  return HEALTH_SCORE_PROFILE_V1_BACHELOR;
}
