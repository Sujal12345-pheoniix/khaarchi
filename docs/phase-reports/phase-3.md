# Phase 3 Engineering Report — Identity & Access Control

**System:** HomeExpense Financial Household Platform  
**Phase:** Phase 3 — Identity + Access Control  
**Status:** Complete & Verified  
**Date:** October 6, 2026  
**Engineering Directive Alignment:** 100% Invariant & Zero-Trust Enforcement

---

## 1. Executive Summary

Phase 3 establishes the enterprise security, identity, session management, and server-side authorization architecture for HomeExpense. Built strictly under zero-trust principles, the system enforces multi-tenant boundary isolation, role-based access control (`HOME_OWNER`, `HOME_ADMIN`, `MEMBER`), and object-level security where resource ownership is validated on every state-mutating operation.

All 56 unit, integration, and security negative tests across the monorepo pass without regressions, and the complete application build (`@homeexpense/api`, `@homeexpense/web`, `@homeexpense/database`, `@homeexpense/shared`) compiles cleanly.

---

## 2. Authentication & Session Infrastructure

### 2.1 Credential & Cryptographic Security
- **Password Hashing:** Salted bcrypt with 10 rounds of work factor. Plaintext passwords are never retained in memory or logged.
- **Verification & Reset Tokens:** 256-bit cryptographically secure pseudorandom tokens (`crypto.randomBytes(32)`).
- **Session Tokens & Refresh Token Rotation:**
  - Short-lived JWT Access Tokens (1-hour lifespan) containing user ID, email, and session ID.
  - Long-lived cryptographically generated Refresh Tokens (7-day lifespan).
  - Refresh tokens stored in PostgreSQL `sessions` table strictly as SHA-256 hashes (`refreshTokenHash`), preventing token exposure in the event of database dumps.
  - **Replay Protection via Rotation:** Using a refresh token invalidates the prior session record and generates a new token pair.

### 2.2 Complete Authentication Lifecycle
1. **Registration (`POST /auth/register`):**
   - Validates input format via Zod `RegisterSchema`.
   - Hashes password.
   - Generates 24-hour cryptographic email verification token.
   - Instantiates user, session, and audit log record.
2. **Login (`POST /auth/login`):**
   - Evaluates account deactivation status.
   - Evaluates brute-force lockout status.
   - Compares credentials; records failed attempts and locks account for 15 minutes after 5 consecutive failures.
   - Resets failed counter on success, establishes a fresh session, and issues token pair.
3. **Token Refresh (`POST /auth/refresh`):**
   - Validates hashed refresh token in database.
   - Checks revocation status (`isValid = true`) and expiry date.
   - Rotates session record and issues new tokens.
4. **Logout (`POST /auth/logout`):**
   - Invalidates active session (or all user sessions) in database.
   - Emits `LOGOUT` audit log event.
5. **Email Verification (`POST /auth/verify-email/request` & `confirm`):**
   - Dispatches cryptographic token; confirms and marks `emailVerified = true`.
6. **Password Recovery (`POST /auth/forgot-password` & `reset-password`):**
   - Enumeration-safe reset token generation (1-hour window).
   - Reset transactionally re-hashes password, clears token, and revokes all active sessions.
7. **Password Change (`POST /auth/change-password`):**
   - Authenticated old-password verification, new password uniqueness check, session invalidation, and issuance of fresh credentials.
8. **Profile & Account Deactivation (`PATCH /auth/me`, `DELETE /auth/me`):**
   - Self-service profile updates (name, avatar).
   - Deactivation marks `isDeactivated = true`, invalidates all sessions, and suspends all household memberships (`isActive = false`).

---

## 3. Server-Side RBAC Architecture

Authorization is strictly enforced server-side via NestJS guards and service transactions. Client-supplied role or authorization claims are never trusted.

```
                           ┌───────────────────────────┐
                           │   HOME_OWNER Authority    │
                           └─────────────┬─────────────┘
                                         │ Inherits
                           ┌─────────────▼─────────────┐
                           │   HOME_ADMIN Authority    │
                           └─────────────┬─────────────┘
                                         │ Inherits
                           ┌─────────────▼─────────────┐
                           │     MEMBER Authority      │
                           └───────────────────────────┘
```

### 3.1 Role Hierarchy Matrix
| Operation | HOME_OWNER | HOME_ADMIN | MEMBER | Enforcement Rule |
| :--- | :---: | :---: | :---: | :--- |
| **Delete Home** | **YES** | NO | NO | Owner-only operation; Admin rejected with `403 Forbidden` |
| **Transfer Ownership** | **YES** | NO | NO | Owner-only operation; Admin rejected with `403 Forbidden` |
| **Alter Admin Role** | **YES** | NO | NO | Owner-only operation; Admin cannot alter peers or Owner |
| **Alter Member Role** | **YES** | **YES** | NO | Admin/Owner only; Members rejected with `403 Forbidden` |
| **Invite Member** | **YES** | **YES** | NO | Admin/Owner only; Members rejected with `403 Forbidden` |
| **Remove Regular Member** | **YES** | **YES** | NO | Admin/Owner only; Owner cannot be removed |
| **Remove Admin Member** | **YES** | NO | NO | Owner only; Admins cannot remove other Admins |
| **Update Home Details** | **YES** | **YES** | NO | Admin/Owner only |
| **Record Expense** | **YES** | **YES** | **YES** | Active membership required |
| **Delete Own Expense** | **YES** | **YES** | **YES** | Payer verified |
| **Delete Other's Expense** | **YES** | **YES** | NO | Object-level security; Member rejected with `403 Forbidden` |
| **Record Settlement (Participant)** | **YES** | **YES** | **YES** | Debtor or Creditor verified |
| **Record Settlement (Third Party)** | **YES** | **YES** | NO | Object-level security; Member rejected with `403 Forbidden` |

---

## 4. Object-Level Security & Context Verification

Every resource operation traverses a 5-point verification chain:
$$\text{Authenticated User} \longrightarrow \text{Active Home Membership} \longrightarrow \text{Role Authority} \longrightarrow \text{Resource Ownership} \longrightarrow \text{Operation Permission}$$

1. **Expense Ownership Guard:**
   - When deleting an expense (`DELETE /homes/:homeId/expenses/:expenseId`), the service checks whether the caller is the member who actually fronted the expense (`expense.payer.userId === actorUserId`).
   - If the caller is not the payer, the operation is permitted **only** if the caller possesses `HOME_OWNER` or `HOME_ADMIN` status in that home. Otherwise, a `403 Forbidden` violation is raised.
2. **Settlement Participant Guard:**
   - When recording a debt settlement (`POST /homes/:homeId/settlements`), the service validates that the caller is either the debtor (`fromMember`), the creditor (`toMember`), or a home Admin/Owner. Unrelated regular members are blocked from settling debts between third parties.
3. **User Isolation Guard:**
   - User profile mutations and account operations (`PATCH /auth/me`, `DELETE /auth/me`) bind strictly to `request.user.id` extracted from the cryptographically verified JWT payload. No client query parameter or body property can target another user's record.

---

## 5. Security Hardening & Abuse Protection

1. **Helmet HTTP Headers:** Configured in `apps/api/src/main.ts` with strict HSTS, X-Content-Type-Options (`nosniff`), Frameguard (`deny`), and X-XSS-Protection.
2. **Sliding-Window Rate Limiting (`RateLimiterGuard`):** Limits sensitive authentication endpoints (`/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`) to **15 requests per minute per IP**, throwing `429 Too Many Requests` when exceeded.
3. **Brute-Force Account Lockout:** Automatically tracks failed login attempts. On 5 consecutive failures, the user account is locked for 15 minutes, blocking further credential guessing attacks.
4. **Comprehensive Audit Logging:** Critical security actions emit immutable records into PostgreSQL `audit_logs` table:
   - `LOGIN`, `FAILED_LOGIN`, `LOGOUT`
   - `PASSWORD_RESET`, `PASSWORD_CHANGE`
   - `ACCOUNT_DEACTIVATE`
   - `ROLE_CHANGE`, `INVITE`, `DELETE`

---

## 6. Verification & Test Suite Results

A dedicated security and RBAC test suite was executed in [`apps/api/src/__tests__/security-rbac.spec.ts`](file:///c:/Users/sujal.kumar/Downloads/kharchi/apps/api/src/__tests__/security-rbac.spec.ts) covering all required negative test scenarios:

| Category | Test Description | Result |
| :--- | :--- | :---: |
| **Boundary Isolation** | Non-member without home membership is rejected with `403 Forbidden` | **PASSED** |
| **Boundary Isolation** | Deactivated member (`isActive = false`) cannot access home | **PASSED** |
| **RBAC Negative** | Regular `MEMBER` blocked from endpoints requiring `ADMIN` or `OWNER` | **PASSED** |
| **RBAC Negative** | Regular `MEMBER` blocked from modifying roles or removing members | **PASSED** |
| **RBAC Negative** | `HOME_ADMIN` blocked from deleting home (`Owner-only operation`) | **PASSED** |
| **RBAC Negative** | `HOME_ADMIN` blocked from transferring home ownership | **PASSED** |
| **RBAC Negative** | `HOME_ADMIN` blocked from altering role of `HOME_OWNER` | **PASSED** |
| **RBAC Negative** | `HOME_ADMIN` blocked from altering role of another `ADMIN` | **PASSED** |
| **Session Security** | Revoked session refresh attempt rejected with `401 Unauthorized` | **PASSED** |
| **Session Security** | Expired refresh token rejected with `401 Unauthorized` | **PASSED** |
| **Session Security** | Password reset invalidates all existing sessions in database | **PASSED** |
| **Deactivated User** | `JwtStrategy` rejects deactivated user from protected endpoints | **PASSED** |
| **Deactivated User** | Deactivated user login rejected immediately | **PASSED** |
| **Deactivated User** | Account deactivation revokes memberships and invalidates sessions | **PASSED** |
| **Object-Level Security** | Non-payer `MEMBER` blocked from deleting another member's expense | **PASSED** |
| **Object-Level Security** | Payer or `OWNER` successfully permitted to delete expense | **PASSED** |
| **Object-Level Security** | Third-party `MEMBER` blocked from recording settlement for others | **PASSED** |
| **Abuse Protection** | 5 consecutive failed logins triggers 15-minute account lockout | **PASSED** |
| **Abuse Protection** | Active lockout window blocks login attempts | **PASSED** |
| **Rate Limiting** | `RateLimiterGuard` blocks requests exceeding 15 req/min with `429` | **PASSED** |

### Complete Monorepo Test Summary
```
Test Files  4 passed (4)
Tests       56 passed (56)
- packages/financial-core:  14/14 passed
- packages/shared:          14/14 passed
- apps/api (Financials):    7/7 passed
- apps/api (Security/RBAC): 21/21 passed
Total Execution Time: ~2.5s
```

---

## 7. Deliverable Artifacts

- **Database Migration:** [`packages/database/prisma/schema.prisma`](file:///c:/Users/sujal.kumar/Downloads/kharchi/packages/database/prisma/schema.prisma) (Extended with `sessions` table, security fields on `users`, and auth `AuditAction` enum).
- **Validation Schemas:** [`packages/validation/src/schemas.ts`](file:///c:/Users/sujal.kumar/Downloads/kharchi/packages/validation/src/schemas.ts) & [`packages/shared`](file:///c:/Users/sujal.kumar/Downloads/kharchi/packages/shared).
- **Auth Module:**
  - [`apps/api/src/auth/auth.service.ts`](file:///c:/Users/sujal.kumar/Downloads/kharchi/apps/api/src/auth/auth.service.ts)
  - [`apps/api/src/auth/auth.controller.ts`](file:///c:/Users/sujal.kumar/Downloads/kharchi/apps/api/src/auth/auth.controller.ts)
  - [`apps/api/src/auth/strategies/jwt.strategy.ts`](file:///c:/Users/sujal.kumar/Downloads/kharchi/apps/api/src/auth/strategies/jwt.strategy.ts)
  - [`apps/api/src/auth/guards/rate-limiter.guard.ts`](file:///c:/Users/sujal.kumar/Downloads/kharchi/apps/api/src/auth/guards/rate-limiter.guard.ts)
- **RBAC Module:**
  - [`apps/api/src/homes/homes.service.ts`](file:///c:/Users/sujal.kumar/Downloads/kharchi/apps/api/src/homes/homes.service.ts)
  - [`apps/api/src/homes/homes.controller.ts`](file:///c:/Users/sujal.kumar/Downloads/kharchi/apps/api/src/homes/homes.controller.ts)
  - [`apps/api/src/homes/guards/home-member.guard.ts`](file:///c:/Users/sujal.kumar/Downloads/kharchi/apps/api/src/homes/guards/home-member.guard.ts)
- **Object-Level Security:**
  - [`apps/api/src/expenses/expenses.service.ts`](file:///c:/Users/sujal.kumar/Downloads/kharchi/apps/api/src/expenses/expenses.service.ts)
  - [`apps/api/src/settlements/settlements.service.ts`](file:///c:/Users/sujal.kumar/Downloads/kharchi/apps/api/src/settlements/settlements.service.ts)
- **Security Hardening:** [`apps/api/src/main.ts`](file:///c:/Users/sujal.kumar/Downloads/kharchi/apps/api/src/main.ts) (Helmet + strict CORS).
- **Test Suite:** [`apps/api/src/__tests__/security-rbac.spec.ts`](file:///c:/Users/sujal.kumar/Downloads/kharchi/apps/api/src/__tests__/security-rbac.spec.ts).
- **API Reference:** [`docs/API.md`](file:///c:/Users/sujal.kumar/Downloads/kharchi/docs/API.md).
