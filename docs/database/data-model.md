# Relational Data Model Specification
## HomeExpense — Comprehensive Database Schema & Constraints

**Document Version:** 1.0.0  
**Database Engine:** PostgreSQL 16+  
**ORM:** Prisma ORM  

---

## 1. Multi-Tenant Isolation & Partitioning Rules

1. **Mandatory Tenant Foreign Key (`homeId`):** Every tenant-scoped entity (`expenses`, `expense_splits`, `ledger_entries`, `settlements`, `recurring_rules`, `bills`, `budgets`) must carry `homeId UUID NOT NULL`.
2. **Compound Tenant Indexes:** All query paths use compound indexes beginning with `homeId` (e.g. `@@index([homeId, date])`, `@@index([homeId, payerMemberId])`).
3. **No Direct Member Deletion with Open Obligations:** `HomeMember` rows cannot be hard-deleted if they are referenced in historical `ledger_entries` (`onDelete: Restrict`). Members are soft-deactivated via `isActive = false`.

---

## 2. Comprehensive Entity Definitions

### 1. `User`
* **Purpose:** Global identity and authentication principal across multiple homes.
* **Fields:**
  * `id`: `UUID` (PK, default `uuid()`)
  * `email`: `VARCHAR(255)` (UNIQUE, NOT NULL, indexed)
  * `passwordHash`: `VARCHAR(255)` (NOT NULL)
  * `name`: `VARCHAR(100)` (NOT NULL)
  * `avatarUrl`: `VARCHAR(512)` (NULLABLE)
  * `emailVerified`: `BOOLEAN` (DEFAULT `false`)
  * `createdAt`: `TIMESTAMPTZ` (DEFAULT `now()`)
  * `updatedAt`: `TIMESTAMPTZ` (`@updatedAt`)
* **Relationships:** $1:N$ with `HomeMember`, `Session`, `AuditLog`, `Notification`.
* **Deletion Rule:** Cascade to active sessions; orphan protection on homes where user is sole `OWNER`.

### 2. `Home`
* **Purpose:** The root multi-tenant container for all household financial activities.
* **Fields:**
  * `id`: `UUID` (PK)
  * `name`: `VARCHAR(100)` (NOT NULL)
  * `type`: `ENUM('BACHELOR', 'FAMILY')` (DEFAULT `'BACHELOR'`)
  * `currency`: `VARCHAR(3)` (DEFAULT `'INR'`)
  * `description`: `TEXT` (NULLABLE)
  * `createdAt`, `updatedAt`: `TIMESTAMPTZ`
* **Relationships:** $1:N$ with `HomeMember`, `Expense`, `LedgerEntry`, `Settlement`, `RecurringExpense`, `Bill`, `Budget`, `AuditLog`.
* **Deletion Rule:** Cascade to all home children. Can only be initiated by member with role `OWNER`.

### 3. `HomeMember`
* **Purpose:** Represents the tenancy relationship, role, and permission binding between a User and a Home.
* **Fields:**
  * `id`: `UUID` (PK)
  * `homeId`: `UUID` (FK -> `Home.id`, CASCADE)
  * `userId`: `UUID` (FK -> `User.id`, CASCADE)
  * `role`: `ENUM('OWNER', 'ADMIN', 'MEMBER', 'VIEWER')` (DEFAULT `'MEMBER'`)
  * `isActive`: `BOOLEAN` (DEFAULT `true`)
  * `joinedAt`: `TIMESTAMPTZ` (DEFAULT `now()`)
* **Constraints:** `UNIQUE(homeId, userId)`.
* **Deletion Rule:** Restrict if referenced in `LedgerEntry` or `Expense`. Set `isActive = false` instead.

### 4. `HomeInvite`
* **Purpose:** Secure invitation tokens issued to onboard new members to a home.
* **Fields:**
  * `id`: `UUID` (PK)
  * `homeId`: `UUID` (FK -> `Home.id`, CASCADE)
  * `email`: `VARCHAR(255)` (NOT NULL)
  * `role`: `ENUM('ADMIN', 'MEMBER', 'VIEWER')` (DEFAULT `'MEMBER'`)
  * `token`: `VARCHAR(128)` (UNIQUE, NOT NULL, indexed)
  * `expiresAt`: `TIMESTAMPTZ` (NOT NULL, default 7 days)
  * `status`: `ENUM('PENDING', 'ACCEPTED', 'EXPIRED', 'REJECTED')` (DEFAULT `'PENDING'`)
  * `createdAt`: `TIMESTAMPTZ`

### 5. `Expense`
* **Purpose:** Authoritative financial event representing an expenditure within a home.
* **Fields:**
  * `id`: `UUID` (PK)
  * `homeId`: `UUID` (FK -> `Home.id`, CASCADE)
  * `payerMemberId`: `UUID` (FK -> `HomeMember.id`, RESTRICT)
  * `amount`: `DECIMAL(12, 2)` (NOT NULL, CHECK `amount > 0`)
  * `description`: `VARCHAR(255)` (NOT NULL)
  * `category`: `VARCHAR(50)` (DEFAULT `'OTHER'`)
  * `splitType`: `ENUM('EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES')` (DEFAULT `'EQUAL'`)
  * `receiptUrl`: `VARCHAR(512)` (NULLABLE)
  * `notes`: `TEXT` (NULLABLE)
  * `date`: `TIMESTAMPTZ` (DEFAULT `now()`, indexed with `homeId`)
  * `status`: `ENUM('CONFIRMED', 'REVERSED')` (DEFAULT `'CONFIRMED'`)
  * `createdAt`, `updatedAt`: `TIMESTAMPTZ`
* **Indexes:** `@@index([homeId, date])`, `@@index([homeId, payerMemberId])`.

### 6. `ExpenseSplit`
* **Purpose:** Explicit distribution of an expense across participants.
* **Fields:**
  * `id`: `UUID` (PK)
  * `expenseId`: `UUID` (FK -> `Expense.id`, CASCADE)
  * `memberId`: `UUID` (FK -> `HomeMember.id`, RESTRICT)
  * `amount`: `DECIMAL(12, 2)` (NOT NULL, CHECK `amount > 0`)
  * `percentage`: `DECIMAL(5, 2)` (NULLABLE)
  * `shares`: `INTEGER` (NULLABLE)
  * `createdAt`: `TIMESTAMPTZ`
* **Constraints:** `UNIQUE(expenseId, memberId)`.

### 7. `ExpenseItem`
* **Purpose:** Itemized sub-line items from OCR receipts (e.g., Milk: ₹60, Eggs: ₹90).
* **Fields:**
  * `id`: `UUID` (PK)
  * `expenseId`: `UUID` (FK -> `Expense.id`, CASCADE)
  * `name`: `VARCHAR(150)` (NOT NULL)
  * `quantity`: `DECIMAL(8, 2)` (DEFAULT `1`)
  * `price`: `DECIMAL(12, 2)` (NOT NULL)
  * `assignedMemberId`: `UUID` (NULLABLE, FK -> `HomeMember.id`)

### 8. `LedgerEntry` (Double-Entry Core)
* **Purpose:** Immutable double-entry bookkeeping row linking debtor and creditor per transaction.
* **Fields:**
  * `id`: `UUID` (PK)
  * `homeId`: `UUID` (FK -> `Home.id`, CASCADE)
  * `expenseId`: `UUID` (NULLABLE, FK -> `Expense.id`, CASCADE)
  * `settlementId`: `UUID` (NULLABLE, FK -> `Settlement.id`, CASCADE)
  * `debtorMemberId`: `UUID` (FK -> `HomeMember.id`, RESTRICT)
  * `creditorMemberId`: `UUID` (FK -> `HomeMember.id`, RESTRICT)
  * `amount`: `DECIMAL(12, 2)` (NOT NULL, CHECK `amount > 0`)
  * `notes`: `VARCHAR(255)` (NULLABLE)
  * `createdAt`: `TIMESTAMPTZ` (DEFAULT `now()`)
* **Indexes:** `@@index([homeId, createdAt])`, `@@index([debtorMemberId, creditorMemberId])`, `@@index([creditorMemberId, debtorMemberId])`.

### 9. `Settlement`
* **Purpose:** Direct repayment recorded between a debtor and creditor.
* **Fields:**
  * `id`: `UUID` (PK)
  * `homeId`: `UUID` (FK -> `Home.id`, CASCADE)
  * `fromMemberId`: `UUID` (FK -> `HomeMember.id`, RESTRICT)
  * `toMemberId`: `UUID` (FK -> `HomeMember.id`, RESTRICT)
  * `amount`: `DECIMAL(12, 2)` (NOT NULL, CHECK `amount > 0`)
  * `proofUrl`: `VARCHAR(512)` (NULLABLE)
  * `notes`: `VARCHAR(255)` (NULLABLE)
  * `status`: `ENUM('PENDING', 'CONFIRMED', 'CANCELLED')` (DEFAULT `'CONFIRMED'`)
  * `settledAt`: `TIMESTAMPTZ` (DEFAULT `now()`)
  * `createdAt`: `TIMESTAMPTZ`
* **Constraints:** CHECK `fromMemberId <> toMemberId`.

### 10. `RecurringExpense`
* **Purpose:** Schedule rule for recurring household bills (rent, maid, subscriptions).
* **Fields:**
  * `id`: `UUID` (PK)
  * `homeId`: `UUID` (FK -> `Home.id`, CASCADE)
  * `payerMemberId`: `UUID` (FK -> `HomeMember.id`, RESTRICT)
  * `amount`: `DECIMAL(12, 2)` (NOT NULL)
  * `description`: `VARCHAR(255)` (NOT NULL)
  * `category`: `VARCHAR(50)` (NOT NULL)
  * `interval`: `ENUM('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY')` (DEFAULT `'MONTHLY'`)
  * `nextRunAt`: `TIMESTAMPTZ` (NOT NULL, indexed)
  * `splitType`: `ENUM('EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES')`
  * `active`: `BOOLEAN` (DEFAULT `true`)
  * `createdAt`: `TIMESTAMPTZ`

### 11. `RecurringInstance`
* **Purpose:** Audit record of an expense generated from a recurring rule.
* **Fields:**
  * `id`: `UUID` (PK)
  * `recurringId`: `UUID` (FK -> `RecurringExpense.id`, CASCADE)
  * `expenseId`: `UUID` (FK -> `Expense.id`, CASCADE)
  * `generatedAt`: `TIMESTAMPTZ` (DEFAULT `now()`)

### 12. `Category`
* **Purpose:** Standard and custom categories for budgeting and analytics.
* **Fields:**
  * `id`: `VARCHAR(50)` (PK, e.g. `'GROCERIES'`)
  * `name`: `VARCHAR(50)` (NOT NULL)
  * `icon`: `VARCHAR(50)` (NOT NULL)
  * `color`: `VARCHAR(20)` (NOT NULL)

### 13. `Budget`
* **Purpose:** Monthly household spending budget (Family mode).
* **Fields:**
  * `id`: `UUID` (PK)
  * `homeId`: `UUID` (FK -> `Home.id`, CASCADE)
  * `month`: `INTEGER` (1-12)
  * `year`: `INTEGER`
  * `totalBudget`: `DECIMAL(12, 2)` (NOT NULL)
  * `createdAt`: `TIMESTAMPTZ`
* **Constraints:** `UNIQUE(homeId, year, month)`.

### 14. `BudgetCategory`
* **Purpose:** Specific category allocation envelope within a monthly budget.
* **Fields:**
  * `id`: `UUID` (PK)
  * `budgetId`: `UUID` (FK -> `Budget.id`, CASCADE)
  * `category`: `VARCHAR(50)` (NOT NULL)
  * `allocatedAmount`: `DECIMAL(12, 2)` (NOT NULL)

### 15. `Bill`
* **Purpose:** Domestic utility bills with due date alerts before conversion to expenses.
* **Fields:**
  * `id`: `UUID` (PK)
  * `homeId`: `UUID` (FK -> `Home.id`, CASCADE)
  * `title`: `VARCHAR(150)` (NOT NULL)
  * `amount`: `DECIMAL(12, 2)` (NOT NULL)
  * `dueDate`: `TIMESTAMPTZ` (NOT NULL)
  * `status`: `ENUM('UNPAID', 'PAID', 'OVERDUE')` (DEFAULT `'UNPAID'`)
  * `billDocumentUrl`: `VARCHAR(512)` (NULLABLE)

### 16. `Receipt`
* **Purpose:** Staged OCR scan record awaiting human review.
* **Fields:**
  * `id`: `UUID` (PK)
  * `homeId`: `UUID` (FK -> `Home.id`, CASCADE)
  * `uploadedByUserId`: `UUID` (FK -> `User.id`)
  * `fileUrl`: `VARCHAR(512)` (NOT NULL)
  * `mimeType`: `VARCHAR(100)` (NOT NULL)
  * `status`: `ENUM('PENDING_SCAN', 'OCR_EXTRACTED', 'USER_VERIFIED', 'REJECTED')`
  * `rawOcrPayload`: `JSONB` (NULLABLE)
  * `createdAt`: `TIMESTAMPTZ`

### 17. `Notification`
* **Purpose:** In-app notification delivery to individual users.
* **Fields:**
  * `id`: `UUID` (PK)
  * `userId`: `UUID` (FK -> `User.id`, CASCADE)
  * `title`: `VARCHAR(150)` (NOT NULL)
  * `body`: `TEXT` (NOT NULL)
  * `link`: `VARCHAR(255)` (NULLABLE)
  * `read`: `BOOLEAN` (DEFAULT `false`)
  * `createdAt`: `TIMESTAMPTZ` (DEFAULT `now()`)

### 18. `AuditLog`
* **Purpose:** Append-only compliance log recording all sensitive system actions.
* **Fields:**
  * `id`: `UUID` (PK)
  * `homeId`: `UUID` (NULLABLE, indexed)
  * `actorUserId`: `UUID` (FK -> `User.id`)
  * `action`: `ENUM('CREATE', 'UPDATE', 'DELETE', 'SETTLE', 'INVITE', 'ROLE_CHANGE')`
  * `entityType`: `VARCHAR(50)` (NOT NULL)
  * `entityId`: `UUID` (NOT NULL)
  * `payload`: `JSONB` (NULLABLE)
  * `ipAddress`: `VARCHAR(45)` (NULLABLE)
  * `userAgent`: `VARCHAR(255)` (NULLABLE)
  * `createdAt`: `TIMESTAMPTZ` (DEFAULT `now()`)

### 19. `Session`
* **Purpose:** Active refresh token and device tracking for user authentication.
* **Fields:**
  * `id`: `UUID` (PK)
  * `userId`: `UUID` (FK -> `User.id`, CASCADE)
  * `refreshTokenHash`: `VARCHAR(255)` (NOT NULL)
  * `userAgent`: `VARCHAR(255)` (NULLABLE)
  * `ipAddress`: `VARCHAR(45)` (NULLABLE)
  * `expiresAt`: `TIMESTAMPTZ` (NOT NULL)
  * `createdAt`: `TIMESTAMPTZ`

### 20. `IdempotencyKey`
* **Purpose:** Prevents duplicate financial mutations from network retries.
* **Fields:**
  * `key`: `VARCHAR(128)` (PK)
  * `userId`: `UUID` (FK -> `User.id`, CASCADE)
  * `endpoint`: `VARCHAR(255)` (NOT NULL)
  * `responsePayload`: `JSONB` (NOT NULL)
  * `statusCode`: `INTEGER` (NOT NULL)
  * `expiresAt`: `TIMESTAMPTZ` (NOT NULL, default 24h TTL)

### 21. `OutboxEvent`
* **Purpose:** Transactional outbox guaranteeing at-least-once message delivery to queues.
* **Fields:**
  * `id`: `UUID` (PK)
  * `aggregateType`: `VARCHAR(50)` (e.g. `'EXPENSE'`)
  * `aggregateId`: `UUID` (NOT NULL)
  * `eventType`: `VARCHAR(100)` (e.g. `'expense.created'`)
  * `payload`: `JSONB` (NOT NULL)
  * `status`: `ENUM('PENDING', 'PROCESSED', 'FAILED')` (DEFAULT `'PENDING'`)
  * `retryCount`: `INTEGER` (DEFAULT `0`)
  * `createdAt`: `TIMESTAMPTZ` (DEFAULT `now()`)
