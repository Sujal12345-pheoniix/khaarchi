# HomeExpense — API Reference & Security Model
**Version:** 1.0.0 (Phase 3 — Identity & Access Control)  
**Base URL:** `/api/v1`  
**Swagger OpenAPI Specification:** `http://localhost:4000/api/docs`

All protected endpoints require the HTTP Header:
```http
Authorization: Bearer <accessToken>
```

---

## 1. Security Architecture & Middleware Pipeline

Every HTTP request traverses a defense-in-depth pipeline:
```
Client Request
      │
      ▼
1. Helmet Security Headers (HSTS, X-Content-Type-Options, Frameguard)
      │
      ▼
2. RateLimiterGuard (Sliding-window brute force mitigation: 15 req/min per IP)
      │
      ▼
3. Global Exception & Validation Filters (Zod validation pipelines)
      │
      ▼
4. JwtAuthGuard & JwtStrategy (Token validation, Session state & Deactivation check)
      │
      ▼
5. HomeMemberGuard (Multi-tenant isolation & Active membership check)
      │
      ▼
6. Role-Based Access Control (@RequireRoles: OWNER, ADMIN, MEMBER)
      │
      ▼
7. Object-Level Security & Context Verification (Ownership / Payer verification)
      │
      ▼
Controller Action & Database Transaction
```

---

## 2. Authentication & Identity (`/auth`)

### `POST /auth/register`
Creates a user account, hashes password using salted bcrypt (10 rounds), generates a 24-hour cryptographic email verification token, initializes a session, and issues tokens.
- **Rate Limit**: 15 requests / min / IP.
- **Request Body**:
  ```json
  {
    "email": "user@household.local",
    "password": "Password123!",
    "name": "Alex Taylor",
    "avatarUrl": "https://..."
  }
  ```
- **Response**: `201 Created`
  ```json
  {
    "user": {
      "id": "uuid",
      "email": "user@household.local",
      "name": "Alex Taylor",
      "emailVerified": false,
      "createdAt": "2026-10-06T12:00:00.000Z"
    },
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "7c9f8a...",
    "verificationToken": "6d3a..."
  }
  ```

### `POST /auth/login`
Authenticates credentials with brute-force lockout protection (locks account for 15 minutes after 5 consecutive failures). Rotates session and returns access + refresh tokens.
- **Rate Limit**: 15 requests / min / IP.
- **Request Body**:
  ```json
  {
    "email": "user@household.local",
    "password": "Password123!"
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`: `"Invalid email or password."`
  - `401 Unauthorized`: `"Account is temporarily locked due to consecutive failed logins. Please retry in 15 minute(s)."`
  - `401 Unauthorized`: `"This account has been deactivated. Please contact support."`

### `POST /auth/refresh`
Rotates session refresh token for replay protection and issues a new JWT access token.
- **Request Body**: `{ "refreshToken": "string" }`
- **Response**: `200 OK` `{ "accessToken": "...", "refreshToken": "..." }`

### `POST /auth/logout`
Revokes active session(s) in the database and records an audit log.
- **Security**: Requires `Bearer` token.
- **Request Body**: `{ "refreshToken": "optional_string" }` (If omitted, revokes all sessions for user).

### `POST /auth/verify-email/request`
Generates a new 24-hour cryptographic email verification token for authenticated user.
- **Security**: Requires `Bearer` token.

### `POST /auth/verify-email/confirm`
Validates verification token and marks `emailVerified = true`.
- **Request Body**: `{ "token": "string" }`

### `POST /auth/forgot-password`
Initiates password recovery with enumeration defense (always returns success). Dispatches 1-hour reset token if active account exists.
- **Rate Limit**: 15 requests / min / IP.
- **Request Body**: `{ "email": "user@household.local" }`

### `POST /auth/reset-password`
Validates reset token, re-hashes password, clears reset token, and immediately invalidates all active sessions.
- **Rate Limit**: 15 requests / min / IP.
- **Request Body**:
  ```json
  {
    "token": "reset_token_string",
    "newPassword": "NewSecurePassword456!"
  }
  ```

### `POST /auth/change-password`
Authenticated password change. Verifies current password, checks uniqueness, updates hash, revokes prior sessions, and establishes fresh tokens.
- **Security**: Requires `Bearer` token.
- **Request Body**:
  ```json
  {
    "currentPassword": "OldPassword123!",
    "newPassword": "NewSecurePassword456!"
  }
  ```

### `GET /auth/me`
Retrieves current authenticated profile.
- **Security**: Requires `Bearer` token.

### `PATCH /auth/me`
Updates profile information. Object-level security: only authenticated user can modify their own attributes.
- **Security**: Requires `Bearer` token.
- **Request Body**: `{ "name": "Alex T.", "avatarUrl": "https://..." }`

### `DELETE /auth/me`
Deactivates user account, invalidates all sessions, suspends home memberships (`isActive = false`), and logs `ACCOUNT_DEACTIVATE` audit event.

---

## 3. Homes & RBAC Matrix (`/homes`)

### Role Hierarchy & Permissions
| Permission / Operation | HOME_OWNER | HOME_ADMIN | MEMBER | VIEWER |
| :--- | :---: | :---: | :---: | :---: |
| Delete Home | **YES** | NO | NO | NO |
| Transfer Home Ownership | **YES** | NO | NO | NO |
| Change Member Role to ADMIN | **YES** | NO | NO | NO |
| Alter Role of an ADMIN | **YES** | NO | NO | NO |
| Alter Role of a MEMBER | **YES** | **YES** | NO | NO |
| Invite Member | **YES** | **YES** | NO | NO |
| Remove Member (Regular) | **YES** | **YES** | NO | NO |
| Remove Member (Admin) | **YES** | NO | NO | NO |
| Update Home Settings / Details | **YES** | **YES** | NO | NO |
| Record Expense | **YES** | **YES** | **YES** | NO |
| Delete Own Expense | **YES** | **YES** | **YES** | NO |
| Delete Other Member's Expense | **YES** | **YES** | NO | NO |
| Record Settlement (As Participant) | **YES** | **YES** | **YES** | NO |
| Record Settlement (On Behalf of Others) | **YES** | **YES** | NO | NO |
| View Home & Balances | **YES** | **YES** | **YES** | **YES** |

### `POST /homes`
Creates a new home. Caller is atomically designated as `HOME_OWNER`.
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
Lists all homes where caller is an active member.

### `GET /homes/:homeId`
Returns home details, settings, and active members list.
- **Security**: Guarded by `HomeMemberGuard`. Caller must be an active member.

### `PATCH /homes/:homeId`
Updates home name or description.
- **Security**: Requires `HOME_OWNER` or `HOME_ADMIN`.

### `DELETE /homes/:homeId`
Permanently deletes home and cascades records.
- **Security**: Requires `HOME_OWNER` strictly. Rejects `HOME_ADMIN` with `403 Forbidden`.

### `POST /homes/:homeId/members`
Invites or adds a member to the home.
- **Security**: Requires `HOME_OWNER` or `HOME_ADMIN`.

### `PATCH /homes/:homeId/members/:memberId/role`
Updates a member's role.
- **Security**:
  - Regular `MEMBER` cannot alter roles (`403 Forbidden`).
  - `HOME_ADMIN` cannot alter role of another Admin or the Owner (`403 Forbidden`).
  - Cannot demote `HOME_OWNER` without ownership transfer (`403 Forbidden`).

### `DELETE /homes/:homeId/members/:memberId`
Removes a member from home (`isActive = false`).
- **Security**:
  - `HOME_OWNER` cannot be removed (`400 Bad Request`).
  - `MEMBER` cannot remove other members (`403 Forbidden`).
  - `HOME_ADMIN` cannot remove other Admins or Owner (`403 Forbidden`).

### `POST /homes/:homeId/transfer-ownership`
Transfers ownership from caller to another active member.
- **Security**: Requires `HOME_OWNER` strictly. Demotes previous owner to `ADMIN` and designates recipient as `OWNER`.

---

## 4. Expenses & Object-Level Security (`/homes/:homeId/expenses`)

### `POST /homes/:homeId/expenses`
Atomically records an expense, creates split distributions, and writes double-entry ledger records.
- **Security**: Guarded by `HomeMemberGuard`.
- **Invariants Enforced**:
  - Payer must be an active member of `:homeId`.
  - All participants must be active members of `:homeId`.
  - $\sum \text{Splits} = \text{Amount}$ (verified in integer cents).

### `GET /homes/:homeId/expenses`
Paginated ledger feed of all expenses with payer and participant share breakdown.

### `DELETE /homes/:homeId/expenses/:expenseId`
Transactionally reverses an expense, removes its splits, cleans up ledger entries, and logs the audit event.
- **Object-Level Security**:
  - If caller is a regular `MEMBER`, caller MUST be the user linked to `payerMemberId` of that expense!
  - If caller is not the payer and does not have `HOME_OWNER` or `HOME_ADMIN` role, returns `403 Forbidden`: `"Object-level security violation: You can only delete expenses that you paid for unless you are a Home Owner or Admin."`

---

## 5. Settlements & Object-Level Security (`/homes/:homeId/settlements`)

### `POST /homes/:homeId/settlements`
Records a debt settlement between two members.
- **Object-Level Security**:
  - Caller must be either the debtor (`fromMember`), the creditor (`toMember`), or a `HOME_OWNER` / `HOME_ADMIN`.
  - Unrelated regular members attempting to record settlements on behalf of others are rejected with `403 Forbidden`.
- **Invariants Enforced**:
  - Both members must belong to `:homeId`.
  - Payment cannot exceed the debtor's outstanding obligation to the creditor.
  - Writes counterbalancing `LedgerEntry` record in an atomic transaction.
