# Financial Health Engine — Architecture Specification

**Document Version:** 1.0.0  
**Feature:** #1 — Khaarchi Financial Health Engine  
**Layer:** Backend Domain / NestJS Modular Monolith / Next.js Web  

---

## 1. Component Architecture & Data Flow

```mermaid
flowchart TD
    subgraph Client["Next.js Web Client"]
        DashboardCard["FinancialHealthCard (/homes/:homeId)"]
        FullPage["FinancialHealthPage (/homes/:homeId/financial-health)"]
    end

    subgraph API["NestJS API (/api/v1)"]
        Controller["FinancialHealthController"]
        GuardAuth["JwtAuthGuard"]
        GuardMember["HomeMemberGuard (Scoping & RBAC)"]
        Service["FinancialHealthService"]
        
        subgraph DomainCalculators["Pure Calculators (0-100)"]
            C_Budget["BudgetDisciplineCalculator"]
            C_Bills["BillReadinessCalculator"]
            C_Spend["SpendingStabilityCalculator"]
            C_Debt["DebtHealthCalculator"]
            C_Recur["RecurringLoadCalculator"]
            C_Contrib["ContributionBalanceCalculator"]
        end
        
        subgraph Engine["Scoring & Rules Engines"]
            ScoreEngine["HealthScoreEngine (Profiles V1)"]
            RulesEngine["HealthRulesEngine (Deterministic Insights)"]
            TrendEngine["HealthTrendEngine (Component Deltas)"]
        end
        
        SnapshotSvc["HealthSnapshotService"]
    end

    subgraph Database["PostgreSQL (Prisma ORM)"]
        T_Expenses[("expenses")]
        T_Ledger[("ledger_entries")]
        T_Budgets[("budgets & budget_categories")]
        T_Bills[("bills")]
        T_Recurring[("recurring_expenses")]
        T_Snapshots[("financial_health_snapshots")]
        T_Insights[("financial_health_insights")]
    end

    DashboardCard -->|GET /homes/:homeId/financial-health| Controller
    FullPage -->|GET /homes/:homeId/financial-health| Controller
    FullPage -->|GET /homes/:homeId/financial-health/history| Controller

    Controller --> GuardAuth
    GuardAuth --> GuardMember
    GuardMember --> Service

    Service --> T_Expenses
    Service --> T_Budgets
    Service --> T_Bills
    Service --> T_Recurring
    Service -->|Authoritative Balances & Ledger| DomainCalculators
    
    DomainCalculators --> Engine
    Engine --> SnapshotSvc
    SnapshotSvc -.->|Non-blocking write| T_Snapshots
    SnapshotSvc -.->|Non-blocking write| T_Insights
    Engine --> Controller
```

---

## 2. Dependencies & Subsystems

1. **`BalancesService`**: Authoritative double-entry debt calculations, pairwise netting, and zero-sum invariant assertions. Reused directly without recalculating or duplicating ledger math.
2. **`HomeMemberGuard`**: Enforces tenant-isolation boundary. Blocks cross-home queries, unauthenticated sessions, and deactivated members.
3. **`PrismaService`**: Managed PostgreSQL transactions and bounded temporal queries.
4. **`packages/financial-core`**: Core math functions (`toCents`, `toMajor`, `roundFinancial`) ensuring zero floating-point accumulation.

---

## 3. Security & Multi-Tenancy Threat Model

| Threat | Vulnerability Vector | Defense Mechanism | Verified In |
| :--- | :--- | :--- | :--- |
| **Cross-Tenant Access** | Caller queries `GET /homes/:foreignId/financial-health` | `HomeMemberGuard` queries `home_members` by `(homeId, userId, isActive)`. Rejects non-members with `403 Forbidden`. | `financial-health.controller.spec.ts` |
| **Score Tampering** | Client attempts to supply score in body or headers | Endpoint is strictly `GET`. Server reads database truth and calculates score entirely server-side. | `financial-health.controller.ts` |
| **Unauthenticated Snooping** | Missing or expired JWT token | `JwtAuthGuard` rejects before guard evaluation with `401 Unauthorized`. | `financial-health.controller.spec.ts` |
| **Stale Member Access** | Deactivated member queries historic home data | `HomeMemberGuard` explicitly asserts `member.isActive === true`. | `financial-health.controller.spec.ts` |
| **Information Leakage** | Exceptions dump raw database connection strings or schemas | Handled by NestJS `AllExceptionsFilter` stripping stack traces in production. | `apps/api/src/common/filters` |

---

## 4. Performance & Query Efficiency

1. **Bounded Historical Windows**: Historical spending stability queries are bounded to `[targetMonthStart, targetMonthEnd]` for the past 3 months.
2. **Database Aggregations**: Queries use PostgreSQL native `_sum` and `_count` aggregations instead of loading full expense rows into Node.js heap memory.
3. **Concurrent Parallel I/O**: Expenses, budgets, bills, recurring rules, and balances are retrieved concurrently using `Promise.all`.
4. **Asynchronous Snapshot Recording**: Persisting analytical snapshots (`financial_health_snapshots`) executes as a non-blocking asynchronous task; slow snapshot writes never delay the user response.

---

## 5. Failure Modes & Reliability

| Failure Mode | Behavior | Recovery / UX |
| :--- | :--- | :--- |
| **Zero Historical Months** | Spending stability returns `null` score with `INSUFFICIENT` sufficiency. | Score engine re-normalizes active weights; UI displays "Building Profile". |
| **No Budget Defined** | Budget discipline returns `null` score with `INSUFFICIENT` sufficiency. | Score engine dynamically re-normalizes remaining active dimensions. |
| **Snapshot Table Write Failure** | Logged to console as an error. | Evaluated health payload is returned successfully to client (read integrity preserved). |
| **Network Failure on Client** | React Query catches failure. | User sees actionable retry modal with link back to household. |
