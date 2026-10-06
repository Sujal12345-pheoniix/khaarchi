# End-to-End User Journeys
## HomeExpense — Complete Operational Workflows

This document establishes the canonical step-by-step user journeys for all 23 primary product scenarios.

---

### Journey 1: User Registration
1. User visits `/register`.
2. Enters full name, email address, and password (minimum 8 characters with strength requirements).
3. Client performs pre-flight validation using Zod.
4. Submits form via `POST /api/v1/auth/register`.
5. Server verifies uniqueness of email, hashes password with salted bcrypt (`rounds = 10`), generates a user record and a signed JWT access token.
6. Client securely stores JWT token in `auth_token` storage and navigates to the Homes Hub (`/`).

---

### Journey 2: User Login
1. User visits `/login`.
2. Inputs email and password.
3. Client sends `POST /api/v1/auth/login`.
4. Server authenticates credentials via bcrypt compare, verifies account active status, and returns user payload + JWT.
5. User session is initialized and redirected to previous protected route or Homes Hub (`/`).

---

### Journey 3: Email Verification
1. Upon registration, an asynchronous outbox event triggers a verification email containing a signed cryptographic token with a 24-hour TTL.
2. User clicks link: `https://homeexpense.app/verify-email?token=xyz`.
3. Frontend forwards token to `POST /api/v1/auth/verify-email`.
4. Server marks `User.emailVerified = true`, invalidates token, and grants verified status badge.

---

### Journey 4: Create Bachelor Home
1. User navigates to Homes Hub and clicks **Create New Home**.
2. Form prompts: Home Name (e.g. "Greenwood Flat 302"), Mode = `BACHELOR`, Currency = `INR (₹)`, and description.
3. Submits `POST /api/v1/homes`.
4. Server executes an interactive transaction:
   - Inserts `Home` record with `type = BACHELOR`.
   - Inserts `HomeMember` record with `role = OWNER` for the creator.
   - Writes `AuditLog` entry.
5. User is immediately redirected to the Home Financial Dashboard (`/homes/:homeId`).

---

### Journey 5: Create Family Home
1. User clicks **Create New Home** and selects Mode = `FAMILY`.
2. Inputs Household Name (e.g. "The Sharma Family"), Currency, and monthly budget starting period.
3. Server executes atomic creation: sets mode to `FAMILY`, enables envelope budgeting defaults, and assigns creator as `OWNER`.
4. Dashboard adapts UI: prioritizes monthly spending pool, envelope progress, and category breakdowns over pairwise debt matrices.

---

### Journey 6: Invite Member to Home
1. Owner or Admin clicks **Invite Member** in the top navbar.
2. Inputs invitee email and selects role (`ADMIN`, `MEMBER`, or `VIEWER`).
3. Client calls `POST /api/v1/homes/:homeId/members`.
4. Server verifies authorization (`HomeMemberGuard` ensures caller is `OWNER` or `ADMIN`).
5. Server creates or retrieves invited user account, adds `HomeMember` record (or pending `HomeInvite`), and records an `AuditLog`.
6. Email notification dispatched to invitee with join instructions.

---

### Journey 7: Accept Invitation
1. Invitee clicks email link or enters invite code on Homes Hub.
2. System calls `POST /api/v1/homes/invites/:inviteCode/accept`.
3. Server updates `HomeInvite.status = ACCEPTED` and activates `HomeMember.isActive = true`.
4. The new member is granted access to the home's live dashboard, expenses feed, and ledger balance calculations.

---

### Journey 8: Add General Expense
1. Member clicks **Add Expense** in Home Dashboard.
2. Inputs Description (e.g., "Monthly High-Speed Internet"), Total Amount (₹1,500.00), Category (`UTILITIES`), Date, and Payer (`CurrentMember` or another member).
3. Selects Split Strategy and participants.
4. Client previews live cent breakdown and validates sum invariant.
5. Member clicks **Save Expense** (`POST /api/v1/homes/:homeId/expenses`).
6. Server commits atomic database transaction (Expense, ExpenseSplit, LedgerEntries, AuditLog).

---

### Journey 9: Equal Split Workflow
1. User enters Total Amount = ₹100.00 among 3 participants ($M_1, M_2, M_3$).
2. Split algorithm computes minor units: $10000 \text{ cents} / 3 = 3333 \text{ cents}$ with $1 \text{ cent remainder}$.
3. Deterministic allocation assigns $M_1 = 33.34$, $M_2 = 33.33$, $M_3 = 33.33$.
4. UI displays exact minor-unit allocation.
5. Invariant check asserts: $33.34 + 33.33 + 33.33 = 100.00$.
6. Submits transaction to server; server re-verifies invariant before persistence.

---

### Journey 10: Exact Split Workflow
1. User selects `EXACT` split strategy for a ₹2,500.00 dinner bill.
2. User enters specific amounts per roommate based on consumed dishes: $M_1 = ₹1,200.00$, $M_2 = ₹800.00$, $M_3 = ₹500.00$.
3. Interactive validator checks: $1200 + 800 + 500 = 2500$.
4. Save button remains disabled until exact sum matches total expense down to ₹0.00.
5. Server commits exact ledger obligations.

---

### Journey 11: Percentage Split Workflow
1. In a Family or shared utility setting, User selects `PERCENTAGE`.
2. Allocates percentages: Partner 1 = 60%, Partner 2 = 40% of a ₹10,000.00 grocery bill.
3. System computes minor units: $₹6,000.00$ and $₹4,000.00$.
4. Validates $\sum \text{Percentages} = 100.00\%$.
5. Residual cents (if any due to fractional percentages like 33.33%) are automatically allocated to the largest participant to guarantee $0.00$ deviation.

---

### Journey 12: Share-Based Split Workflow
1. Roommates split bulk groceries where Roommate A stayed 2 weeks (2 shares) and Roommates B & C stayed 4 weeks (4 shares each). Total = 10 shares.
2. Expense Amount = ₹5,000.00.
3. System calculates: Share unit value = $₹5,000 / 10 = ₹500.00$.
4. Roommate A = ₹1,000.00 (2 shares), Roommates B & C = ₹2,000.00 each (4 shares each).
5. Exact reconciliation confirmed and persisted.

---

### Journey 13: View Real-Time Balances & Debt Minimization
1. User opens Home Dashboard.
2. System loads `GET /api/v1/homes/:homeId/balances`.
3. Backend calculates:
   - Net balance per member from all active `ledger_entries`.
   - Pairwise directed debts (netting mutual obligations: if A owes B 50 and B owes A 20, net is A owes B 30).
   - Zero-sum invariant assertion ($\sum \text{Net Balances} = 0.00$).
   - Simplified settlement plan via bipartite graph reduction (`simplifyDebts`).
4. User sees prominent personal status badge (`OWED ₹1,250.00` in emerald or `OWES ₹450.00` in rose) and the minimal list of payments to resolve all household debts.

---

### Journey 14: Settle Debt
1. Member clicks **Settle Up** or clicks a suggested settlement card.
2. Modal pre-selects Debtor (Payer), Creditor (Recipient), and current outstanding obligation.
3. User enters payment amount (must be $> 0$ and $\le$ outstanding obligation).
4. Adds optional payment reference (e.g., "UPI Transaction #120938472").
5. Submits `POST /api/v1/homes/:homeId/settlements`.
6. Server runs atomic transaction: creates `Settlement` record, inserts counterbalancing `LedgerEntry`, and writes `AuditLog`.
7. Balances update immediately; debt drops to ₹0.00.

---

### Journey 15: Create Recurring Expense
1. User navigates to Recurring Expenses section.
2. Defines recurring rule: Description = "House Maid Salary", Amount = ₹8,000.00, Frequency = `MONTHLY`, Due Day = 1st of month, Split Strategy = `EQUAL` among all active flatmates.
3. Submits `POST /api/v1/homes/:homeId/recurring`.
4. Background cron/worker polls active recurring rules daily and generates authoritative expense instances with ledger entries when due.

---

### Journey 16: Manage Household Bill
1. Member uploads an electricity bill due on the 15th.
2. Creates `Bill` record with status `UNPAID` and reminder threshold (3 days before due date).
3. Notification engine fires alerts to flatmates as the due date approaches.
4. When a member pays the bill, they toggle status to `PAID`, converting the bill into an authoritative settled `Expense`.

---

### Journey 17: Create Monthly Category Budget (Family Mode)
1. Family manager opens Budget Center.
2. Sets monthly household ceiling (e.g., ₹60,000.00 for October) and allocates category envelopes:
   - Groceries: ₹25,000.00
   - Utilities: ₹10,000.00
   - Child Care / School: ₹15,000.00
   - Dining Out: ₹10,000.00
3. As expenses are logged, progress bars dynamically reflect envelope depletion with cautionary alerts at 80% and 100%.

---

### Journey 18: Receive In-App & Email Notifications
1. When User A adds an expense involving User B, an outbox notification event is emitted.
2. Notification service dispatches in-app bell notification and email digest.
3. User B receives actionable notification: *"Rohan added 'WiFi Bill' (₹1,500.00). Your share is ₹500.00."*

---

### Journey 19: Upload Receipt
1. User clicks **Attach Receipt** in the Add Expense modal.
2. Selects image (PNG/JPEG/WEBP) or PDF receipt (max 10MB).
3. Client requests pre-signed upload URL from `POST /api/v1/receipts/presign`.
4. Direct multipart upload streams file to secure private cloud storage (S3/GCS) with virus/mime-type scanning.
5. Receipt metadata record created with status `PENDING_SCAN`.

---

### Journey 20: OCR Receipt Processing (Post-MVP Pipeline)
1. Upload triggers asynchronous worker queue job (`BullMQ`).
2. OCR engine extracts merchant name, date, itemized line items, tax, and total amount.
3. Confidence scores assigned per field.
4. Receipt record updated to `OCR_EXTRACTED` with structured JSON payload.

---

### Journey 21: Confirm OCR Extraction (Human-in-the-Loop)
1. User is presented with an interactive confirmation modal showing the uploaded receipt image side-by-side with parsed fields.
2. User reviews and adjusts any misread fields (e.g. adjusts total from ₹1,080.00 to ₹1,000.00 if tax was double-counted).
3. User explicitly clicks **Confirm & Convert to Expense**.
4. Status changes to `USER_VERIFIED`. Financial truth is only updated after explicit human confirmation.

---

### Journey 22: View Financial Analytics & Trends
1. User navigates to Analytics tab.
2. Client queries `GET /api/v1/homes/:homeId/analytics?period=monthly`.
3. Displays:
   - Total spending over time (monthly bar chart).
   - Category distribution (pie/donut breakdown).
   - Highest spending categories and month-over-month percentage variances.
   - Payer distribution (who fronts the most cash).

---

### Journey 23: Export Audit Report (CSV / PDF)
1. Home Owner or Member clicks **Export Report**.
2. Selects date range (e.g., "Fiscal Year 2026" or "Last 3 Months") and format (CSV or PDF).
3. Server streams cryptographic, timestamped CSV containing full transaction log: Expense ID, Date, Description, Category, Payer, Participant Splits, Settlement Links, and Audit Checksum.
