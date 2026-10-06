# System Architecture Specification
## HomeExpense — Production-Grade Modular Monolith

**Document Version:** 1.0.0  
**Target Infrastructure:** Cloud-Native / Multi-Tenant  
**Primary Pattern:** Clean Modular Monolith with Asynchronous Worker Offloading  

---

## 1. High-Level Architecture Overview

```
                               ┌────────────────────────────────────────────────┐
                               │             Edge / CDN / WAF Layer             │
                               │        (Cloudflare / AWS CloudFront)           │
                               └──────────────────────┬─────────────────────────┘
                                                      │
                       ┌──────────────────────────────┴──────────────────────────────┐
                       │                                                             │
                       ▼                                                             ▼
        ┌─────────────────────────────┐                               ┌─────────────────────────────┐
        │   Next.js 15 Web Frontend   │                               │     NestJS Modular API      │
        │   (SSR / Client Components) │                               │      (Node.js / Express)    │
        │   - TanStack React Query    │ ─── HTTPS / REST / WS ──────▶ │   - Auth, Homes, Expenses   │
        │   - React Hook Form + Zod   │                               │   - Ledger, Balances        │
        │   - Tailwind CSS            │                               │   - Guards, Interceptors    │
        └─────────────────────────────┘                               └──────────────┬──────────────┘
                                                                                     │
                                   ┌─────────────────────────────────────────────────┼──────────────────────────────┐
                                   │                                                 │                              │
                                   ▼                                                 ▼                              ▼
                    ┌─────────────────────────────┐                   ┌─────────────────────────────┐┌─────────────────────────────┐
                    │    PostgreSQL Database      │                   │     Redis 7 In-Memory Cache ││  S3 / GCS Object Storage    │
                    │   (Neon / RDS Aurora)       │                   │     & BullMQ Worker Broker  ││  - Encrypted Receipts       │
                    │   - Source of Truth         │                   │   - Token Revocation Cache  ││  - Temporary OCR Staging    │
                    │   - Row-Level Isolation     │                   │   - Job Queue Broker        ││  - Pre-Signed Direct Upload │
                    │   - Read / Write Split Pool │                   │   - Real-time Rate Limiting │└─────────────────────────────┘
                    └─────────────────────────────┘                   └──────────────┬──────────────┘
                                                                                     │
                                                                                     ▼
                                                                      ┌─────────────────────────────┐
                                                                      │   Asynchronous Job Worker   │
                                                                      │   - OCR Receipt Processing  │
                                                                      │   - Recurring Expense Engine│
                                                                      │   - Outbox Notification Send│
                                                                      │   - Monthly Analytics Agg.  │
                                                                      └─────────────────────────────┘
```

---

## 2. Frontend Architecture (`apps/web`)

### Tech Stack
* **Framework:** Next.js 15 (App Router with React 19).
* **Language:** TypeScript 5.7+ with strict null checks.
* **State & Server Synchronization:** TanStack React Query (v5) providing declarative caching, optimistic updates, and background refetching.
* **Forms & Schema Validation:** React Hook Form bound with Zod schemas sourced directly from `@homeexpense/shared`.
* **Styling & UI Kit:** Tailwind CSS with custom accounting-grade dark theme, tabular numeric fonts (`font-variant-numeric: tabular-nums`), and Lucide icons.

### Client-Side Financial Rules
1. **Never compute authoritative balances in the browser:** The browser acts strictly as a presentation and preview client.
2. **Interactive Invariant Preview:** Before submitting expenses, the UI runs client-side preview calculations (`calculateEqualSplits`, etc.) to visually verify that $\sum \text{Splits} = \text{Total Amount}$. The submit button is strictly disabled if deviations exist.
3. **Session Transport:** JWTs are stored for request transport, while identity and membership states are validated dynamically on each server request.

---

## 3. Backend Architecture (`apps/api`)

### Tech Stack
* **Framework:** NestJS 11 Modular Monolith.
* **Language:** TypeScript with decorators and reflection metadata.
* **Database Driver:** Prisma ORM 6.x connecting to PostgreSQL.
* **API Documentation:** Auto-generated Swagger / OpenAPI 3.0 at `/api/docs`.

### Modular Decomposition
```
apps/api/src/
├── auth/           # Authentication, JWT strategy, password hashing, token validation
├── homes/          # Home management, memberships, role-based authorization guard
├── expenses/       # Atomic expense recording, split allocation, ledger generation
├── balances/       # Double-entry ledger reconciliation, net balances, debt simplification
├── settlements/    # Debt settlement bounds-checking and ledger offsetting
├── recurring/      # Recurring expense scheduling rules and instance generators
├── bills/          # Bill reminders, due-date tracking, payment reconciliation
├── budgets/        # Monthly category budget envelopes and threshold monitoring
├── receipts/       # Pre-signed upload management, OCR triggers, verification endpoints
├── notifications/  # Transactional outbox event processor, email and push delivery
├── analytics/      # Monthly spending summaries and trendline aggregation
├── common/         # Global filters, interceptors, pipes, decorators, logging
└── prisma/         # PrismaService database lifecycle management
```

### Request Pipeline & Security Interception
```
HTTP Request 
  ──▶ Helmet / Security Headers
  ──▶ Global Rate Limiting Guard
  ──▶ Global Exception Filter (standardized error envelopes)
  ──▶ Route Matching
  ──▶ JwtAuthGuard (validates Bearer token & attaches User)
  ──▶ HomeMemberGuard (verifies user is active member of :homeId)
  ──▶ RolesGuard (verifies required MemberRole: OWNER, ADMIN, MEMBER, VIEWER)
  ──▶ ZodValidationPipe (validates and parses DTO against strict shared schemas)
  ──▶ Controller Handler
  ──▶ Service Layer (runs within Prisma interactive transactions)
  ──▶ Response Serialization
```

---

## 4. Database Architecture (PostgreSQL)

### Single Source of Truth
PostgreSQL is the authoritative store. No balance is ever persisted as an editable scalar column that could drift out of sync; balances are computed via SQL aggregation over immutable `ledger_entries`.

### Multi-Tenant Isolation Strategy
* **Logical Isolation Scoped by `homeId`:** Every tenant-specific table (`expenses`, `expense_splits`, `ledger_entries`, `settlements`, `bills`, `budgets`) includes an indexed `homeId UUID NOT NULL` column.
* **Enforced Foreign Keys & Cascades:** Deleting a home cascades to all contained financial events, while deleting individual members is blocked if historical financial obligations or ledger entries exist (`onDelete: Restrict`).
* **Connection Pooling:** Configured with pgBouncer / Neon connection pooling to handle concurrent serverless and containerized traffic bursts without pool exhaustion.

---

## 5. Asynchronous Worker Architecture (Redis + BullMQ)

Long-running and non-blocking tasks are decoupled from the HTTP request-response cycle using Redis 7 and BullMQ:

```
Producer (API) ──▶ Redis Queue ──▶ Consumer Worker ──▶ Outbox / DB
```

### Queues
1. `ocr-processing-queue`: Receives receipt image URLs, calls OCR engine, extracts line items, updates receipt status to `OCR_EXTRACTED`.
2. `recurring-expense-queue`: Runs nightly cron (`0 0 * * *`), evaluates `recurring_rules` whose `nextRunAt <= NOW()`, and generates authoritative expenses.
3. `notification-dispatch-queue`: Consumes transactional outbox events and delivers emails (SES/SendGrid) or push notifications.
4. `analytics-rollup-queue`: Recomputes monthly category spending aggregates upon expense mutations.

---

## 6. Storage Architecture (Encrypted Object Storage)

* **Provider:** AWS S3 or Google Cloud Storage.
* **Access Model:** All buckets are private with public access blocked.
* **Pre-Signed Uploads:** API issues short-lived (15-minute) pre-signed PUT URLs. The browser uploads binary files directly to object storage, bypassing API server memory buffers.
* **Encryption:** Server-Side Encryption with AES-256 (SSE-S3/KMS).
* **Lifecycle Rules:** Unverified temporary receipt scans are pruned after 30 days; verified expense receipts are archived to standard cold storage.

---

## 7. AI & OCR Architecture (Human-in-the-Loop)

```
[Receipt Image]
       │
       ▼
[Cloud Storage]
       │
       ▼
[OCR Extraction Worker]
       │
       ▼
[Structured Draft (JSON)] ──▶ [Interactive Confirmation Modal] ──▶ [Authoritative Expense]
                                (Human Verifies & Edits)
```

### Safety Principles
1. **Zero Silent Mutations:** AI and OCR outputs are classified as drafts (`OCR_EXTRACTED`) and are NEVER automatically inserted into `ledger_entries`.
2. **Explicit User Confirmation:** A user must review the scanned merchant, date, tax, and line items in a side-by-side modal and click **Confirm** before any financial entry is created.
3. **Auditable Source:** The raw receipt image URL remains permanently linked to the verified expense for full auditability.

---

## 8. Observability & SRE Architecture

* **Structured Logging:** JSON logs containing `timestamp`, `level`, `context`, `correlationId`, `userId`, `homeId`, `path`, and `durationMs`.
* **Distributed Tracing:** OpenTelemetry instrumenting NestJS HTTP handlers, Prisma queries, and BullMQ worker jobs.
* **Error Tracking:** Sentry SDK capturing uncaught server and client exceptions with sanitized payloads (PII and passwords redacted).
* **Metrics:** Prometheus endpoint exporting HTTP latency histograms, database query timings, active WebSocket connections, and financial invariant health.
