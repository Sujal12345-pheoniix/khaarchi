# Household Cashflow & Safe-to-Spend Engine: Architecture & Integration Analysis

**Document Version:** 1.0.0  
**Status:** Approved for Implementation  
**Feature:** #2 — Household Cashflow & Safe-to-Spend Engine  
**Author:** Principal Engineer, Product Architect, Financial Systems Engineer, Security Engineer  

---

## 1. Executive Summary & Product Thesis

Khaarchi is the Household Financial Operating System designed to understand the financial state of a household and guide better decisions.
- **Feature #1 ("Financial Health Engine")** answers: *"How financially healthy is this household right now, why is it in that state, and how is it changing?"*
- **Feature #2 ("Household Cashflow & Safe-to-Spend Engine")** answers: *"Given everything already committed, scheduled, and spent inside this household, how much financial capacity do we safely have left right now?"*

The user-facing concept is **SAFE-TO-SPEND**.  
The domain engine is **HOUSEHOLD CASHFLOW ENGINE**.  
The underlying capability is **HOUSEHOLD FINANCIAL CAPACITY**.

This is **NOT** a generic bank balance clone, a cosmetic widget, or an AI prediction. It is a deterministic, money-safe domain calculation reading authoritative PostgreSQL records with strict double-counting defense, explicit data sufficiency handling, and complete cross-tenant isolation.

---

## 2. Existing Financial Architecture Review

The Khaarchi repository implements a clean modular monolith:
1. **`packages/financial-core`**:
   - Pure TypeScript, zero external dependencies.
   - Core currency math: `toCents(amount)`, `toMajor(cents)`, `roundFinancial(amount)`.
   - Invariants: `validateExpenseSplits`, `validateZeroSumLedger`, `validateSettlementAmount`.
   - Debt graph reduction: `simplifyDebts`.
2. **`packages/database`**:
   - Prisma ORM v6.19.3 mapping to PostgreSQL with connection pooling.
   - Models: `Home`, `HomeMember`, `Expense`, `ExpenseSplit`, `LedgerEntry`, `Settlement`, `AuditLog`, `Budget`, `BudgetCategory`, `Bill`, `RecurringExpense`, `FinancialHealthSnapshot`, `FinancialHealthInsight`.
3. **`apps/api` (NestJS 11)**:
   - Modular architecture: `AuthModule`, `HomesModule`, `ExpensesModule`, `BalancesModule`, `SettlementsModule`, `BudgetsModule`, `FinancialHealthModule`.
   - Multi-tenant security via `JwtAuthGuard` + `HomeMemberGuard` checking active membership on every `/:homeId` route.
   - Role-based permissions via `@RequireRoles(MemberRole.OWNER)` ensuring administrative boundaries.
4. **`apps/web` (Next.js 15, App Router, React 19)**:
   - TanStack React Query for declarative data fetching and cache invalidation.
   - Design system using Tailwind CSS with Slate, Emerald, Terracotta, and Amber visual tokens.

---

## 3. Feature #1 Integration Audit & Reusable Primitives

Feature #1 introduced the Financial Health Engine with 6 dimensions, versioned scoring profiles (`FAMILY` and `BACHELOR`), deterministic rules, snapshots, and dashboard integration.

### Reusable Primitives for Feature #2:
| Primitive / Service | Location | How Feature #2 Reuses It |
| :--- | :--- | :--- |
| **Integer Cents Math** | `toCents`, `toMajor`, `roundFinancial` (`@homeexpense/shared`) | All Safe-to-Spend sums, deductions, and daily rates are calculated exclusively in integer minor units (paise/cents). |
| **Balance & Debt Calculation** | `BalancesService.getHomeBalances` (`apps/api/src/balances/`) | Reuses authoritative net member balances, zero-sum verification, and unsettled debt amounts for Bachelor mode without re-querying raw ledger tables. |
| **Active Budget & Envelopes** | `BudgetsService.getCurrentBudget` (`apps/api/src/budgets/`) | Fetches authoritative monthly budget pool, spent totals, and category breakdown for the current period. |
| **Household Bills Query** | `prisma.bill` | Unpaid and overdue bills query with strict status filtering (`status !== BillStatus.PAID`). |
| **Recurring Expenses Engine** | `prisma.recurringExpense` | Active recurring commitments (`active: true`) bounded to the evaluation horizon. |
| **Tenant Authorization** | `HomeMemberGuard` | Guarantees caller belongs to the requested `homeId`. |
| **Design System Primitives** | Cards, Badges, Progress Bars, Tooltips | Consistent visual hierarchy matching the existing dashboard. |

---

## 4. Financial Source of Truth & Available Capacity Definition

### The Source of Truth: PostgreSQL
The Safe-to-Spend engine is an **analytical calculation layer**. It **DOES NOT** persist a fake account balance, duplicate ledger entries, or store a mutable "safe_to_spend_balance" column. PostgreSQL records remain the sole authoritative truth.

### Defining "Available Capacity" in Khaarchi
Khaarchi currently models household financial operations through pooled budgets, member spending limits, and shared ledger debts rather than raw bank feed scrapers (which are explicitly out of scope).

Therefore, Available Capacity is deterministically resolved as follows:
1. **Family Mode**:
   - The authoritative pool for the current calendar month is the household's **Monthly Budget** (`Budget.totalBudget`).
   - If a budget is configured: `availableCapacity = Budget.totalBudget`.
   - If no budget has been configured by the Owner: `availableCapacity = 0`, `capacitySource = 'UNAVAILABLE'`, `dataSufficiency = 'INSUFFICIENT' | 'PARTIAL'`, and `confidence = 'LOW'`.
2. **Bachelor Mode**:
   - Individual flatmates track debts, credits, and spending allocations.
   - If a flatmate has an explicit `spendingLimit` on `HomeMember`, or the flat sets a shared monthly ceiling, capacity is anchored to that allocation. If unconfigured, capacity is marked `UNAVAILABLE`, signaling that the household picture is still building.
3. **No Phantom Money**:
   - We **NEVER** guess income, invent paydays, or infer bank deposits from expense history.
   - The engine explicitly surfaces the assumption: `"No expected income was included because no authoritative income schedule is modeled in this household."`

---

## 5. Core Mathematical Model & Double-Counting Defense

### The Authoritative Formula (SAFE_TO_SPEND_V1)

$$\text{SafeToSpend} = \text{AvailableCapacity} + \text{ReliableExpectedInflow} - \text{PostedExpensesInPeriod} - \text{UpcomingObligations} - \text{RecurringCommitments} - \text{ProtectedReserve}$$

Where:
1. **$\text{AvailableCapacity}$**: Authoritative monthly budget ceiling ($\ge 0$).
2. **$\text{ReliableExpectedInflow}$**: Strictly $0$ in V1 (as no verified income model exists). Surfaced as an explicit documented assumption.
3. **$\text{PostedExpensesInPeriod}$**: Sum of all PostgreSQL expenses posted between $\text{PeriodStart}$ and $\text{ReferenceDate}$ in the current evaluation cycle.
4. **$\text{UpcomingObligations}$**: Sum of all bills with $\text{status} \in \{\text{UNPAID}, \text{OVERDUE}\}$ whose due date falls within the period or is already overdue.
5. **$\text{RecurringCommitments}$**: Sum of all active recurring expenses ($\text{active} = \text{true}$) whose $\text{nextRunAt} \ge \text{ReferenceDate}$ and $\le \text{PeriodEnd}$.
6. **$\text{ProtectedReserve}$**: Configurable household emergency/liquidity floor on `Home.protectedReserve` (defaults to $0$ if not configured).

### Double-Counting Defense Matrix
| Potential Double-Count Hazard | Defense Mechanism in V1 |
| :--- | :--- |
| **Paid Bill vs Upcoming Obligation** | Only bills with `status !== BillStatus.PAID` are included. Paid bills are excluded from obligations, preventing subtraction against already posted expenses. |
| **Posted Recurring Expense vs Future Recurrence** | Only recurring expenses with `nextRunAt >= referenceDate` within the period are counted. Any recurrence that already executed and logged an `Expense` earlier in the month is already captured in $\text{PostedExpensesInPeriod}$. |
| **Settled Debt vs Outstanding Balance** | In Bachelor mode, settlements with `status === CONFIRMED` already created balancing `LedgerEntry` records. Only net un-settled balances from `BalancesService` are evaluated. |
| **Reserved Funds vs Discretionary Spend** | $\text{ProtectedReserve}$ is strictly deducted once from the pool and never compounded across categories. |

### Negative Safe-to-Spend Handling
If $\text{PostedExpensesInPeriod} + \text{UpcomingObligations} + \text{RecurringCommitments} + \text{ProtectedReserve} > \text{AvailableCapacity}$:
$$\text{SafeToSpend} < 0$$
- We **NEVER** clamp negative capacity to ₹0. Masking a ₹7,000 deficit as ₹0 is financially deceptive.
- The result reports the exact negative value, sets `status = 'DEFICIT'`, and generates a `CRITICAL` severity warning.

---

## 6. Time Horizon & Period Model

V1 operates on the **Current Calendar Month**:
- `period.start`: 1st day of the current calendar month at 00:00:00.000 UTC.
- `period.end`: Last day of the current calendar month at 23:59:59.999 UTC.
- `period.daysRemaining`: $\max(1, \text{totalDaysInMonth} - \text{currentDay} + 1)$.
- `dailySafeToSpend`: $\text{roundFinancial}(\text{SafeToSpend} / \text{daysRemaining})$.

---

## 7. Confidence & Data Sufficiency Rules

### Data Sufficiency Levels:
- **`FULL`**: Authoritative capacity (monthly budget) is configured, bills are tracked, and recurring commitments are recorded.
- **`PARTIAL`**: Either capacity is configured but no bills/recurring expenses are tracked, or bills/commitments exist without a formal monthly budget ceiling.
- **`INSUFFICIENT`**: Brand new home with neither budget nor recorded commitments.

### Confidence Levels:
- **`HIGH`**: `dataSufficiency === FULL` and ledger zero-sum is reconciled.
- **`MEDIUM`**: `dataSufficiency === PARTIAL` or days remaining $< 3$.
- **`LOW`**: `dataSufficiency === INSUFFICIENT`.

---

## 8. Deterministic Warning Engine

| Warning Code | Severity | Trigger Condition | Explanatory Message |
| :--- | :--- | :--- | :--- |
| `NEGATIVE_CAPACITY` | `CRITICAL` | $\text{SafeToSpend} < 0$ | Total committed obligations and posted spending exceed available capacity by ₹X. Household is in deficit. |
| `OVERDUE_BILLS` | `HIGH` | Any bill with `status === 'OVERDUE'` or (`status === 'UNPAID'` and `dueDate < today`) | X household bills totaling ₹Y are past due and require immediate payment. |
| `HIGH_OBLIGATION_BURDEN` | `HIGH` | $(\text{Obligations} + \text{Recurring}) / \text{Capacity} > 0.70$ | Fixed commitments consume > 70% of available household capacity. Discretionary flexibility is constrained. |
| `BUDGET_EXHAUSTED` | `HIGH` | $\text{PostedExpenses} / \text{Capacity} > 0.90$ | Over 90% of the household budget has already been spent with X days remaining in the month. |
| `MISSING_CAPACITY` | `MEDIUM` | `capacitySource === 'UNAVAILABLE'` | Monthly household budget is not configured. Safe-to-spend cannot be evaluated with high confidence. |
| `TIGHT_CAPACITY` | `LOW` | $0 \le \text{SafeToSpend} < 2000$ | Safe-to-spend is positive but very tight (less than ₹2,000 remaining for the period). |

---

## 9. API Specification & Security Contract

### Route:
```http
GET /api/v1/homes/:homeId/cashflow/safe-to-spend
```

### Security & Cross-Home Isolation:
- Guards: `@UseGuards(JwtAuthGuard, HomeMemberGuard)`
- Verification:
  1. Authenticates user JWT.
  2. Resolves `homeId` param.
  3. `HomeMemberGuard` verifies caller has an active `HomeMember` record for `homeId`.
  4. If caller belongs to Home B and requests Home A: HTTP 403 Forbidden.
  5. Never accepts client-calculated totals (`safeToSpend`, `availableAmount`, etc.). Everything is calculated on the server.

### Schema Impact:
To support protected emergency reserves cleanly:
- Add `protectedReserve Decimal? @db.Decimal(12, 2) @default(0)` to `Home` model in Prisma.
- Backward compatible, non-destructive, defaults to 0.

---

## 10. Frontend Architecture

1. **Dashboard Health Card Addition**:
   - `SafeToSpendCard` embedded in `/homes/[homeId]/page.tsx` directly alongside the Financial Health card.
   - Displays prominent Safe-to-Spend amount, days remaining, daily spending allowance, confidence badge, and quick warning chip.
   - Deep link to full `/homes/[homeId]/cashflow` page.
2. **Dedicated Full Cashflow Page (`/homes/[homeId]/cashflow`)**:
   - **Header**: Safe-to-Spend KPI, daily burn allowance, confidence badge, period range.
   - **Four-Component Breakdown**:
     - Available Capacity (with source indicator)
     - Posted Spending (with count of transactions)
     - Upcoming Obligations (with drill-down table of unpaid/overdue bills)
     - Recurring Commitments (with drill-down table of upcoming recurrences)
     - Protected Reserve (with indicator if configured)
   - **Explainability Panel ("Why is Safe-to-Spend at this amount?")**:
     - Step-by-step mathematical reconciliation breakdown.
     - Documented assumptions list.
   - **Warnings Feed**:
     - Prioritized alerts (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`) with concrete advice.
   - **Empty / Insufficient Data States**:
     - Contextual setup guidance with interactive CTA to configure budget envelopes or log bills.

---

## 11. Implementation Sequence

1. **Database Schema**: Add `protectedReserve` to `Home` model in Prisma schema, push with `prisma db push`.
2. **Domain Package / Calculators**:
   - Pure domain calculator: `apps/api/src/cashflow/calculators/safe-to-spend.calculator.ts` with comprehensive edge cases (positive, zero, negative, no bills, no recurring, leap years).
3. **Application Service & Controller**:
   - `CashflowService` (`apps/api/src/cashflow/cashflow.service.ts`): Concurrently loads authoritative data and invokes calculator.
   - `CashflowController` (`apps/api/src/cashflow/cashflow.controller.ts`): Enforces RBAC and tenant isolation.
   - `CashflowModule` (`apps/api/src/cashflow/cashflow.module.ts`): Registered in `AppModule`.
4. **Backend Test Suite**:
   - Unit tests for pure calculator (`safe-to-spend.calculator.spec.ts`).
   - Service tests with mocked Prisma/Balances (`cashflow.service.spec.ts`).
   - Controller tests verifying RBAC & isolation (`cashflow.controller.spec.ts`).
5. **Frontend Components & Pages**:
   - Dashboard card: `apps/web/src/components/safe-to-spend-card.tsx`.
   - Full page: `apps/web/src/app/homes/[homeId]/cashflow/page.tsx`.
   - Embed card in `apps/web/src/app/homes/[homeId]/page.tsx`.
6. **Verification & Audit**:
   - Monorepo tests (`pnpm test`).
   - Monorepo lint (`pnpm lint`).
   - Web & API build (`pnpm build`).
   - Security isolation audit.
   - Final implementation report.
