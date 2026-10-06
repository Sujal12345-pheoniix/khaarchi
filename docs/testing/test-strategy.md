# Quality Assurance & Testing Strategy
## HomeExpense — Verification Protocols & Financial Invariant Testing

**Document Version:** 1.0.0  
**Test Runner:** Vitest & Playwright  
**Target Code Coverage:** 100% on Financial Math & Invariants, >85% overall backend  

---

## 1. The HomeExpense Testing Pyramid

```
                  ┌────────────────────────┐
                  │       E2E Tests        │ (Playwright: Critical User Journeys)
                  ├────────────────────────┤
                  │   Integration Tests    │ (Supertest / TestContainers Postgres)
                  ├────────────────────────┤
                  │    Invariant Tests     │ (Deterministic Math & Boundary Fuzzing)
                  ├────────────────────────┤
                  │       Unit Tests       │ (Vitest: Fast Pure Functions & Schemas)
                  └────────────────────────┘
```

---

## 2. Invariant & Precision Verification Protocol

Financial logic cannot rely solely on standard happy-path unit tests. HomeExpense mandates property-based and edge-case testing for:

1. **Cent Precision & Binary Drift:**
   * Test floating-point hazards: $0.1 + 0.2 = 0.30000000000000004$ must resolve to exactly $30 \text{ cents}$.
2. **Remainder Cent Allocation:**
   * $₹100.00$ split 3 ways must produce: $[33.34, 33.33, 33.33]$ summing to exactly $100.00$.
   * $₹10.00$ split 7 ways must produce exact penny distribution summing to $10.00$.
3. **Zero-Sum Ledger Property:**
   * For any combination of expenses and settlements in a closed home, $\sum \text{Net Balances} = 0.00$.
4. **Settlement Bounds Property:**
   * Settle amount $> \text{debt}$ must throw a `400 Bad Request` invariant violation.
   * Settling with oneself must throw a validation error.

---

## 3. Concurrency & Race Condition Verification

* **Simultaneous Double Settlement:** Two concurrent requests attempting to settle the same debt must execute within serializable transactions or utilize `Idempotency-Key` headers to prevent double-crediting.
* **Concurrent Expense Deletion:** Attempting to delete an expense while a settlement against it is processing must roll back gracefully.

---

## 4. Continuous Integration (CI) Enforcement Gates

Every pull request must pass the automated CI pipeline:
1. `pnpm lint`: Zero ESLint or TypeScript warnings.
2. `pnpm test`: 100% passing Vitest test suite.
3. `pnpm --filter @homeexpense/database run prisma:validate`: Schema validity check.
4. `pnpm build`: Clean compilation of all workspace packages.
