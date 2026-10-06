# Modular Monolith Architecture & Module Map
## HomeExpense — Boundary Specifications & Dependency Matrix

**Document Version:** 1.0.0  
**Pattern:** Strict Layered Modular Monolith  

---

## 1. Module Responsibility & Ownership Matrix

| Module | Core Purpose | Data Entities Owned | Allowed Inbound Consumers |
| :--- | :--- | :--- | :--- |
| **AuthModule** | Authentication, password hashing, JWT lifecycle | `User`, `Session` | Public / All Modules |
| **HomesModule** | Multi-tenant scoping, membership, roles, invites | `Home`, `HomeMember`, `HomeInvite` | Expenses, Balances, Settlements, Budgets, Bills |
| **ExpensesModule** | Expense mutations, split strategies, receipt linkage | `Expense`, `ExpenseSplit`, `ExpenseItem` | Balances, Budgets, Analytics |
| **BalancesModule** | Double-entry balance calculation, debt reduction | Read-only aggregator of `LedgerEntry` | Web UI, Analytics, Settlements |
| **SettlementsModule**| Debt settlements, counterbalancing ledger writes | `Settlement` | Web UI, Balances |
| **LedgerCore** | Authoritative ledger append and consistency invariants | `LedgerEntry` | Expenses, Settlements |
| **RecurringModule** | Cron scheduling for recurring rules and auto-expenses | `RecurringRule`, `RecurringInstance` | Expenses |
| **BillsModule** | Upcoming domestic utility bill reminders & due dates | `Bill` | Expenses, Notifications |
| **BudgetsModule** | Monthly envelope budgeting and thresholds (Family) | `Budget`, `BudgetCategory` | Expenses, Notifications |
| **ReceiptsModule** | S3 pre-signed upload, OCR queueing, draft parsing | `Receipt` | Expenses |
| **NotificationsModule** | Outbox consumer, transactional emails, push alerts | `Notification`, `OutboxEvent` | All Modules |
| **AuditModule** | Immutable compliance and financial activity logging | `AuditLog` | All Modules |

---

## 2. Dependency Graph & Directional Rules

```
                             ┌──────────────┐
                             │  AuthModule  │
                             └──────┬───────┘
                                    │
                                    ▼
                             ┌──────────────┐
                             │ HomesModule  │
                             └──────┬───────┘
                                    │
       ┌────────────────────────────┼────────────────────────────┐
       │                            │                            │
       ▼                            ▼                            ▼
┌──────────────┐             ┌──────────────┐             ┌──────────────┐
│ExpensesModule│             │BudgetsModule │             │ BillsModule  │
└──────┬───────┘             └──────┬───────┘             └──────┬───────┘
       │                            │                            │
       ├────────────────────────────┴────────────────────────────┘
       ▼
┌──────────────┐
│  LedgerCore  │ ◀──────┐
└──────┬───────┘        │
       │                │
       ▼                │
┌──────────────┐        │
│BalancesModule│        │
└──────┬───────┘        │
       │                │
       ▼                │
┌──────────────┐        │
│SettlementsMod│────────┘
└──────────────┘
```

---

## 3. Inter-Module Communication Principles

1. **Unidirectional Dependency Flow:** Dependencies only point downward. A lower-level module (such as `LedgerCore` or `HomesModule`) NEVER imports or calls a higher-level module (such as `ExpensesModule` or `WebUI`).
2. **Zero Circular Dependencies:** Circular imports are strictly forbidden by architectural linting (`madge`).
3. **Database Transaction Propagation:** When a cross-boundary financial mutation occurs (e.g. `ExpensesModule` calling `LedgerCore` to generate debits/credits), the interactive Prisma transaction context (`tx: Prisma.TransactionClient`) MUST be explicitly passed down so that all operations succeed or roll back atomically.
4. **Asynchronous Event-Driven Decoupling:** Side effects such as sending notification emails or recalculating analytics rollups MUST NOT execute synchronously inside the database transaction. They must be enqueued via transactional outbox records (`OutboxEvent`) and processed by workers.
