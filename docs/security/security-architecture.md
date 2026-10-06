# Security & Authorization Architecture
## HomeExpense — Defense-in-Depth Security Model

**Document Version:** 1.0.0  
**Compliance Standard:** OWASP Top 10 / SOC 2 Principles  

---

## 1. Authentication & Session Strategy

* **Password Hashing:** Salted bcrypt with an adaptive cost factor (`rounds = 10`), resistant to rainbow table and ASIC GPU brute-force attacks.
* **Token Transport:** Short-lived access tokens (JWT, 15-minute expiration) paired with cryptographically secure, refresh tokens (7-day sliding window).
* **Token Revocation Cache:** Redis token blacklist enables instantaneous logout and session invalidation across all user devices.

---

## 2. Multi-Tenant Object-Level Authorization

The non-negotiable security invariant: **Never trust client-supplied IDs.**

Every API request involving a resource must answer:
```
WHO? (Authenticated user from validated JWT)
WHICH HOME? (Resolved from URL parameter :homeId)
WHICH RESOURCE? (Resolved from database scoped by :homeId)
WHICH ROLE? (Resolved from home_members table where userId = req.user.id AND homeId = :homeId)
IS THIS ACTION AUTHORIZED? (Evaluated by HomeMemberGuard & RolesGuard)
```

### Role-Based Access Control (RBAC) Matrix

| Action / Capability | OWNER | ADMIN | MEMBER | VIEWER |
| :--- | :---: | :---: | :---: | :---: |
| Delete / Archive Home | ✅ | ❌ | ❌ | ❌ |
| Invite Members / Change Roles | ✅ | ✅ | ❌ | ❌ |
| Manage Budgets & Categories | ✅ | ✅ | ❌ | ❌ |
| Log / Edit Expenses | ✅ | ✅ | ✅ | ❌ |
| Record Debt Settlements | ✅ | ✅ | ✅ | ❌ |
| View Balances & Expenses | ✅ | ✅ | ✅ | ✅ |
| Export Audit CSV / PDF | ✅ | ✅ | ✅ | ✅ |

---

## 3. Rate Limiting & Abuse Prevention

Implemented using Redis sliding-window counters:
* **Public Auth Endpoints (`/auth/login`, `/auth/register`):** 5 requests per minute per IP. Exponential backoff on failed attempts.
* **Financial Mutations (`/homes/:homeId/expenses`, `/settlements`):** 30 requests per minute per authenticated user.
* **General Read Endpoints:** 300 requests per minute per IP/user.

---

## 4. File Security & Receipt Sanitization

1. **Private Buckets:** Cloud object storage buckets are completely private; direct public reads are disabled.
2. **Pre-Signed Uploads:** Temporary (15-minute TTL) pre-signed PUT URLs require exact Content-Type and Content-Length constraints.
3. **MIME-Type & Magic Byte Validation:** File uploads are restricted to `image/jpeg`, `image/png`, `image/webp`, and `application/pdf`. File headers are verified via magic byte inspection before processing.
4. **Asynchronous Malware Scanning:** Background workers scan uploaded files using ClamAV prior to OCR ingestion.

---

## 5. Security Headers & Network Hygiene

Standard HTTP security headers enforced by Helmet:
* `Content-Security-Policy`: Restricts scripts, styles, and image origins.
* `Strict-Transport-Security`: `max-age=31536000; includeSubDomains; preload`
* `X-Frame-Options`: `DENY` (prevents clickjacking)
* `X-Content-Type-Options`: `nosniff`
* `Referrer-Policy`: `strict-origin-when-cross-origin`

---

## 6. Immutable Audit Logging

Every financial creation, modification, deletion, or settlement writes an immutable record to the `audit_logs` table:
* `actorUserId`: Initiator of the action.
* `homeId`: Scoped home context.
* `action`: Action verb (`CREATE`, `UPDATE`, `DELETE`, `SETTLE`, `ROLE_CHANGE`).
* `entityType` & `entityId`: Target resource.
* `payload`: Structured JSON snapshot of the state change.
* `ipAddress` & `userAgent`: Network forensic telemetry.
