# HomeExpense — System Architecture & Invariants

## 1. Core Paradigm

```
HOME -> MEMBERS -> FINANCIAL EVENTS -> LEDGER -> BALANCES -> SETTLEMENT
```

HomeExpense is a home-centric financial operating system for bachelors, roommates, and families.

### Fundamental Financial Invariants
1. **PostgreSQL is the single source of truth**: No balance or ledger state is ever derived or trusted from client input or cache alone.
2. **Deterministic Rounding & Division**: Split amounts must sum precisely to the event total:
   $$\sum \text{Split Amounts} = \text{Total Expense Amount}$$
3. **Percentage Invariant**: Percentage splits must sum to exactly 100.00%.
4. **Membership & Authorization Invariant**:
   - Payer must be an active member of the Home.
   - All participants in a split must be active members of the Home.
   - Operations cross-checked by `(userId, homeId, memberId, role, permissions)`.
5. **Zero-Sum Ledger**: For any settled group state across all members:
   $$\sum \text{Net Balances} = 0$$
6. **Settlement Invariant**: A settlement payment can never exceed the outstanding obligation between the debtor and creditor.

---

## 2. Monorepo Structure

```
kharchi/
├── apps/
│   ├── api/             # NestJS modular monolith API backend
│   └── web/             # Next.js App Router frontend
├── packages/
│   ├── shared/          # Shared domain schemas, DTOs, math validation utils
│   └── database/        # Prisma schema, migrations, client generation
├── docs/                # Architecture, ADRs, runbooks, security records
├── docker-compose.yml   # PostgreSQL 16 & Redis
└── pnpm-workspace.yaml
```

---

## 3. Data Isolation and Multi-Tenancy

Every query modifying or reading financial records is scoped by `homeId`.
Authorization checks happen server-side on every request using NestJS Guards and database-level transaction locks where balance mutations occur.
