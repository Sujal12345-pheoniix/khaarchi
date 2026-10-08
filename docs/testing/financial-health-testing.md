# Financial Health Engine — Testing Matrix & Verification Report

**Document Version:** 1.0.0  
**Feature:** #1 — Khaarchi Financial Health Engine  
**Test Suite:** Vitest  

---

## 1. Test Execution Summary

| Suite / Package | Test Files | Total Tests | Passed | Failed | Duration |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `packages/financial-core` | 1 | 14 | 14 | 0 | 0.5s |
| `packages/shared` | 1 | 14 | 14 | 0 | 0.4s |
| `apps/api` | 8 | 78 | 78 | 0 | 2.0s |
| **Total Monorepo** | **10** | **106** | **106** | **0** | **2.9s** |

---

## 2. Test Matrix by Domain

### A. Calculators (`apps/api/src/financial-health/__tests__/calculators.spec.ts`)
- [x] `BudgetDisciplineCalculator`:
  - Missing budget returns `BUILDING_PROFILE` with null score.
  - Utilization $\le 80\%$ scores 100 with accurate remaining budget.
  - Linear decay between 80% and 100%.
  - Exceeded budget and category overrun penalties.
- [x] `BillReadinessCalculator`:
  - Zero bills scores 100 with `EXCELLENT`.
  - Overdue bills incur severe -35 penalties with exact rupee metrics.
  - 3+ overdue bills cap score at 0 `CRITICAL`.
- [x] `SpendingStabilityCalculator`:
  - Zero historical months returns `BUILDING_PROFILE`.
  - Normalization of partial month against historical 3-month baseline.
  - Spending spikes > 50% above baseline incur proportional penalties.
- [x] `DebtHealthCalculator`:
  - Reconciled zero-debt ledger scores 100.
  - Low float ($\le 15\%$) maintains healthy score.
  - High unsettled debt ratio ($> 60\%$) scores `CRITICAL`.
- [x] `RecurringLoadCalculator`:
  - Zero recurring commitments scores 95.
  - Weekly and yearly commitments convert accurately to monthly equivalents.
  - Inactive recurring rules are excluded.
- [x] `ContributionBalanceCalculator`:
  - Bachelor mode marks contribution balance as N/A.
  - Family mode assesses partner contribution disparity against equal split expectations.

### B. Scoring Engine (`apps/api/src/financial-health/__tests__/health-score.engine.spec.ts`)
- [x] Profile weights sum strictly to 1.00 for Family.
- [x] Profile weights sum strictly to 1.00 for Bachelor.
- [x] Section 39 exact specification test (82.60 $\to$ 83).
- [x] Dynamic weight re-normalization when dimensions are missing.
- [x] Cold start: insufficient activity ($< 2$ dimensions) yields `BUILDING_PROFILE` with null score.
- [x] Determinism invariant: identical input produces identical output across repeated runs.

### C. Rules Engine (`apps/api/src/financial-health/__tests__/health-rules.engine.spec.ts`)
- [x] Triggers `SPENDING_SPIKE` with measurable percentage and baseline rupee figures.
- [x] Triggers `BUDGET_EXCEEDED` with exact overspend amount.
- [x] Triggers `OVERDUE_BILL` with count and total debt.
- [x] Triggers `HIGH_RECURRING_LOAD` when recurring commitments exceed 50%.

### D. Service & Multi-Tenancy Security (`apps/api/src/financial-health/__tests__/financial-health.controller.spec.ts`)
- [x] Declarative `@UseGuards(JwtAuthGuard, HomeMemberGuard)` protection.
- [x] Cross-tenant access blocked with `ForbiddenException('Access denied: You are not an active member of this Home.')`.
- [x] Unauthenticated requests blocked with `Authentication required.`.
- [x] Deactivated members blocked with `ForbiddenException`.
- [x] Missing `homeId` rejected with `BadRequestException`.
- [x] Non-destructive asynchronous analytical snapshot generation.
