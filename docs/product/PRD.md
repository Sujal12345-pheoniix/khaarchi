# Product Requirements Document (PRD)
## HomeExpense — The Household Financial Operating System

**Document Version:** 1.0.0  
**Status:** Approved Blueprint (Phase 0)  
**Target Delivery:** Production Grade Multi-Tenant Household Financial Platform  

---

## 1. Product Vision

HomeExpense is the financial operating system for modern shared living. Whether operating as a **Bachelor Flat** where roommates split expenses, chase repayments, and settle fluctuating shared bills, or as a **Family Household** where partners allocate category budgets, manage collective obligations, and maintain clear transparency over pooled funds, HomeExpense transforms friction-laden money conversations into automated, deterministic, and auditable financial clarity.

### Core Operating Paradigm
```
HOME ──▶ MEMBERS ──▶ FINANCIAL EVENTS ──▶ DOUBLE-ENTRY LEDGER ──▶ NET BALANCES ──▶ SETTLEMENT
```

---

## 2. Target Users & Personas

### Persona A: "The Apartment Treasurer" (Bachelor / Flatmate Mode)
* **Name:** Rohan, 26, Software Engineer sharing a 3BHK with 2 college friends.
* **Pain Points:** 
  * "Who paid for WiFi?", "Did anyone pay the cook this month?", "We use Splitwise but someone always owes someone else ₹3,412.33 and settlements don't match the bank transfers."
  * One flatmate buys groceries, another pays electricity, and another orders takeout. At the end of the month, calculating who owes whom requires complex manual reconciliation.
* **Goals:** 
  * Instant equal, share-based, or itemized expense splitting.
  * Deterministic net balance calculation where total group debt always resolves to zero ($\sum \text{Net Balances} = 0$).
  * Automated debt simplification (bipartite minimization) so 3 mutual debts collapse into a single payment.

### Persona B: "The Household Planner" (Family Mode)
* **Name:** Priya & Amit, 34 & 36, married couple with a child and home mortgage.
* **Pain Points:**
  * Disjointed bank accounts and credit cards lead to blind spots in monthly grocery, school fees, and domestic utility budgets.
  * Traditional split apps feel adversarial ("You owe me ₹400 for diapers").
* **Goals:**
  * Category-based monthly envelope budgeting.
  * Shared expenditure tracking without nickel-and-diming each other.
  * Centralized recurring bill tracking with due-date alerts.

### Persona C: "The Casual Contributor" (Roommate / Family Dependent)
* **Name:** Kabir, 22, college student living with elder siblings.
* **Pain Points:**
  * Irregular income; easily overwhelmed by complex accounting tables.
* **Goals:**
  * Frictionless mobile UI to snap a photo of a grocery receipt, confirm OCR extraction, and see exactly their single obligation.

---

## 3. Operating Modes: Bachelor Mode vs. Family Mode

| Dimension | Bachelor Flat Mode | Family Household Mode |
| :--- | :--- | :--- |
| **Primary Philosophy** | Debt reconciliation & pairwise obligations | Budget tracking, pooled contributions & expense visibility |
| **Default Split Strategy** | Equal division or custom exact shares per item | 100% Shared Household Pool or percentage contribution based on income |
| **Default Settlement View** | Pairwise debts ("Rohan owes Amit ₹450") | Category consumption ("Home spent ₹24,000 on Groceries this month") |
| **Settlement Obligation** | Mandatory settlement to reach zero net balance | Optional reconciliation; primary focus on budget adherence |
| **Privacy / Visibility** | Strict isolation between homes; members view all home-scoped expenses | Configurable parent/child or manager/dependent visibility |
| **Recurring Bills** | Split among active roommates on creation | Deducted from common monthly household budget |

---

## 4. Core Problems & Competitive Differentiators

### Critical Industry Flaws HomeExpense Solves
1. **The Floating-Point & Rounding Flaw:** Most expense trackers compute floating-point division ($100 / 3 = 33.33333333$), creating orphaned cents and ledger drift. HomeExpense executes all calculations in integer minor units (cents / paise) using deterministic largest-remainder distribution algorithms.
2. **The "Fake Client Truth" Vulnerability:** Typical consumer apps trust client-calculated totals and balances, making them vulnerable to tampering or stale cache states. HomeExpense treats PostgreSQL as the sole financial source of truth; all balances are derived dynamically from immutable ledger entries.
3. **AI / OCR Financial Hallucinations:** AI and OCR systems frequently hallucinate totals, date stamps, or vendor names. HomeExpense mandates a strict multi-state verification workflow: `PENDING_SCAN ──▶ OCR_EXTRACTED ──▶ USER_VERIFIED ──▶ AUTHORITATIVE_EXPENSE`. AI never mutates financial truth silently.
4. **Adversarial Debt Grids vs. Simplified Settlements:** Instead of requiring $N \times (N-1)$ individual payments across roommates, HomeExpense integrates a deterministic debt minimization algorithm that generates the minimum required pairwise settlements.

---

## 5. Non-Negotiable Product Principles

1. **Deterministic Financial Math:** Every split must sum exactly to the expense amount ($\sum \text{Splits} = \text{Amount}$).
2. **Zero-Sum Ledger Invariant:** Across any home, the sum of all members' net balances must equal zero at all times ($\sum_{m} \text{Balance}_m = 0$).
3. **Double-Entry Ledger Integrity:** Financial events do not overwrite balance columns; they write append-only debit and credit entries.
4. **Authoritative Server Enforcement:** Never trust client-supplied `userId`, `homeId`, `memberId`, `role`, or calculated balances.
5. **No Fake Functionality / Anti-Slop:** Every button, input, and modal must be bound to a real, tested, resilient backend API and database transaction.

---

## 6. MVP vs. Post-MVP Scope Boundary

### Phase 1 (MVP Scope)
* **Auth & Profiles:** Email/Password registration with bcrypt, JWT auth, secure sessions, profile management.
* **Home Management:** Creation of Bachelor and Family homes, multi-tenant data isolation, member roles (`OWNER`, `ADMIN`, `MEMBER`, `VIEWER`), email invitations.
* **Deterministic Expense Engine:**
  * Add, edit, delete expenses with categories.
  * Equal split, exact split, percentage split, and share split.
  * Remainder cent distribution with mathematical invariance.
* **Double-Entry Ledger & Balances:**
  * Immutable `ledger_entries` table.
  * Real-time net balance calculation.
  * Direct pairwise debt tracking.
  * Transitive debt minimization (`simplifyDebts`).
* **Settlements:**
  * Debt settlement flow with obligation bounds checking (cannot overpay).
  * Counterbalancing ledger entries.
* **Receipt Capture (Manual):** File/receipt upload attached to expense records.
* **Audit Trail:** Immutable audit logging for every create, update, delete, and settle mutation.

### Phase 2 (Post-MVP Scope)
* **Automated OCR Receipt Pipeline:** Cloud storage integration (S3/GCS), asynchronous OCR worker via BullMQ/Redis, two-phase confirmation modal.
* **Recurring Expenses & Bills:** Cron/worker scheduler generating expense instances with due date reminders.
* **Envelope Budgets:** Monthly home budgets with category limits, rollover support, and threshold alerts (80%, 100%).
* **Real-time Notifications:** WebSockets/Push notifications for expense additions, debt mentions, and settlement confirmations.
* **Financial Analytics & Export:** Category spending charts, month-over-month trendlines, and CSV/PDF ledger export.
* **Banking / Payment Gateway Integration:** UPI intent links and Stripe/Razorpay direct settlement triggers.
