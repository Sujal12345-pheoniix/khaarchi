## HomeExpense Pull Request

### Description of Change
<!-- Provide a concise summary of the changes and the architectural rationale. -->

### Related Issue / Objective
<!-- Fixes # or Relates to Phase ... -->

### Financial Invariant Verification Checklist
- [ ] **Deterministic Math:** Integer minor units (cents) preserved; no floating point division.
- [ ] **Split Invariance:** $\sum \text{Splits} === \text{Total Expense}$ verified.
- [ ] **Ledger Invariance:** $\sum \text{Net Balances} === 0.00$ verified.
- [ ] **Settlement Bounds:** Settlements verified $\le$ current debt.
- [ ] **Multi-Tenant Security:** All database mutations scoped by `homeId`.
- [ ] **Server Authorization:** All sensitive operations authorized server-side.
- [ ] **Tests Added / Passing:** Unit/integration tests added covering new functionality.
- [ ] **No Placeholder / Fake Code:** Zero mock buttons or pseudo-implementations.
