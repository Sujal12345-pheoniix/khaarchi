# Contributing to HomeExpense

## 1. Non-Negotiable Engineering Principles

1. **PostgreSQL is the source of truth for financial data.** Never rely on local storage or client state for balances or debt obligations.
2. **Deterministic Rounding:** All money math is calculated in integer minor units (cents / paise) with deterministic largest-remainder distribution.
3. **Double-Entry Ledger Integrity:** Financial mutations write debit and credit entries atomically.
4. **Never trust client-supplied identity or totals:** Validate `(userId, homeId, memberId, role)` server-side on every request.
5. **Anti-Slop Rule:** Never submit placeholder buttons, mock UI, or unvalidated tests.

---

## 2. Git & Branching Strategy

* `main`: Production release branch. Direct commits are restricted.
* `develop`: Integration branch for active sprint features.
* `feature/*`: Vertical slice feature development (e.g. `feature/ocr-pipeline`).
* `fix/*`: Bug fixes.
* `hotfix/*`: Production hotfixes.
* `release/*`: Release candidate staging.

Every meaningful change must be accompanied by tests and approved via Pull Request.

---

## 3. Development Workflow

1. Clone repository and install dependencies:
   ```bash
   pnpm install
   pnpm approve-builds --all
   ```
2. Setup environment:
   ```bash
   cp .env.example .env
   ```
3. Synchronize database & seed fixtures:
   ```bash
   pnpm --filter @homeexpense/database run prisma:db:push
   pnpm --filter @homeexpense/database run db:seed
   ```
4. Run test suites:
   ```bash
   pnpm test
   ```
5. Run dev services:
   ```bash
   pnpm dev:api   # API at http://localhost:4000
   pnpm dev:web   # Web at http://localhost:3000
   ```
