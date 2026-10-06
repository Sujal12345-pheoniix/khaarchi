# HomeExpense — API Reference & Security Model

Base URL: `/api/v1`

All protected endpoints require the HTTP Header:
`Authorization: Bearer <accessToken>`

---

## 1. Authentication (`/auth`)

### `POST /auth/register`
Creates a user account with salted bcrypt password hashing.
- **Request Body**:
  ```json
  {
    "email": "user@domain.com",
    "password": "Password123!",
    "name": "Jane Doe",
    "avatarUrl": "https://..."
  }
  ```
- **Response**: `201 Created`
  ```json
  {
    "user": { "id": "uuid", "email": "...", "name": "..." },
    "accessToken": "jwt_token_string"
  }
  ```

### `POST /auth/login`
Authenticates credentials and returns a signed JWT.

### `GET /auth/me`
Returns the active authenticated user profile.

---

## 2. Homes & Membership (`/homes`)

### `POST /homes`
Creates a new home. The caller is automatically assigned as the `OWNER` in an atomic database transaction.
- **Request Body**:
  ```json
  {
    "name": "Flat 402",
    "type": "BACHELOR", // "BACHELOR" | "FAMILY"
    "currency": "INR",
    "description": "Roommates"
  }
  ```

### `GET /homes`
Lists all homes where the authenticated user is an active member.

### `GET /homes/:homeId`
Returns home details, settings, and active members list.
- **Security**: Guarded by `HomeMemberGuard`. Caller must be an active member of `:homeId`.

### `POST /homes/:homeId/members`
Invites or adds a member to the home.
- **Security**: Requires `OWNER` or `ADMIN` role.

---

## 3. Expenses & Splits (`/homes/:homeId/expenses`)

### `POST /homes/:homeId/expenses`
Atomically records an expense, creates split distributions, and writes double-entry ledger records.
- **Security**: Guarded by `HomeMemberGuard`.
- **Invariants Enforced**:
  - Payer must be an active member of `:homeId`.
  - All participants must be active members of `:homeId`.
  - $\sum \text{Splits} = \text{Amount}$ (verified in cents).
- **Request Body**:
  ```json
  {
    "description": "Internet Bill",
    "amount": 1000.00,
    "category": "UTILITIES",
    "date": "2026-10-06T12:00:00Z",
    "payerMemberId": "uuid-payer",
    "splitType": "EQUAL", // "EQUAL" | "PERCENTAGE" | "SHARES" | "EXACT"
    "splits": [
      { "memberId": "uuid-1", "amount": 500.00 },
      { "memberId": "uuid-2", "amount": 500.00 }
    ]
  }
  ```

### `GET /homes/:homeId/expenses`
Paginated ledger feed of all expenses with payer and participant share breakdown.

### `DELETE /homes/:homeId/expenses/:expenseId`
Transactionally reverses an expense, removes its splits, cleans up ledger entries, and logs the audit event.

---

## 4. Balances & Debt Minimization (`/homes/:homeId/balances`)

### `GET /homes/:homeId/balances`
Derives real-time financial balances strictly from PostgreSQL `ledger_entries`.
- **Returns**:
  - `totalSpending`: Total historical expenditure in the home.
  - `memberBalances`: Net balance per member ($\sum \text{Credits} - \sum \text{Debts}$).
  - `pairwiseDebts`: Net obligations between every pair of roommates.
  - `suggestedSettlements`: Minimal payment set calculated via transitive debt minimization algorithm.
  - `isReconciled`: Invariant check that $\sum \text{Net Balances} = 0.00$.

---

## 5. Settlements (`/homes/:homeId/settlements`)

### `POST /homes/:homeId/settlements`
Records a debt settlement between two members.
- **Security & Invariants**:
  - Both members must belong to `:homeId`.
  - Payment cannot exceed the debtor's outstanding obligation to the creditor.
  - Writes counterbalancing `LedgerEntry` record in an atomic transaction.
