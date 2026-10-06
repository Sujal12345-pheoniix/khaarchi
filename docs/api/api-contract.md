# Complete REST API Contract Specification
## HomeExpense — Enterprise Endpoints & Schema Protocols

**Base URL:** `/api/v1`  
**Protocol:** HTTPS with JSON Payloads  
**Standard Authentication Header:** `Authorization: Bearer <accessToken>`  
**Idempotency Header:** `Idempotency-Key: <unique-uuid-v4>` (Mandatory on financial mutations)  

---

## Standard Error Response Format
All non-2xx responses return this standard envelope:
```json
{
  "statusCode": 400,
  "timestamp": "2026-10-06T12:00:00.000Z",
  "path": "/api/v1/homes/123/expenses",
  "error": "Bad Request",
  "message": "Financial Invariant Violation: Sum of splits (99.00) does not equal expense total (100.00)."
}
```

---

## 1. Authentication (`/auth`)

### `POST /auth/register`
* **Auth:** Public
* **Request:**
  ```json
  { "email": "user@example.com", "password": "Password123!", "name": "Alex Doe" }
  ```
* **Response `201 Created`:**
  ```json
  { "user": { "id": "uuid", "email": "...", "name": "..." }, "accessToken": "jwt" }
  ```

### `POST /auth/login`
* **Auth:** Public
* **Request:** `{ "email": "user@example.com", "password": "Password123!" }`
* **Response `200 OK`:** `{ "user": { ... }, "accessToken": "jwt" }`

### `GET /auth/me`
* **Auth:** Bearer JWT
* **Response `200 OK`:** `{ "user": { "id": "uuid", "email": "...", "name": "..." } }`

---

## 2. Homes & Membership (`/homes`)

### `POST /homes`
* **Auth:** Bearer JWT
* **Request:**
  ```json
  {
    "name": "Oakwood Apartment",
    "type": "BACHELOR", // "BACHELOR" | "FAMILY"
    "currency": "INR",
    "description": "Optional notes"
  }
  ```
* **Response `201 Created`:** Home entity with caller as `OWNER`.

### `GET /homes`
* **Auth:** Bearer JWT
* **Response `200 OK`:** Array of Homes where caller is an active member with `currentUserRole`.

### `GET /homes/:homeId`
* **Auth:** Bearer JWT | **Guard:** `HomeMemberGuard`
* **Response `200 OK`:** Full home details, settings, and active member list.

### `POST /homes/:homeId/members`
* **Auth:** Bearer JWT | **Guard:** `HomeMemberGuard` (Role: `OWNER`, `ADMIN`)
* **Request:**
  ```json
  { "email": "roommate@domain.com", "role": "MEMBER" }
  ```
* **Response `201 Created`:** Created/reactivated member details.

---

## 3. Expenses & Splits (`/homes/:homeId/expenses`)

### `POST /homes/:homeId/expenses`
* **Auth:** Bearer JWT | **Guard:** `HomeMemberGuard`
* **Headers:** `Idempotency-Key` (Recommended)
* **Request:**
  ```json
  {
    "description": "Monthly High-Speed WiFi",
    "amount": 1500.00,
    "category": "UTILITIES",
    "date": "2026-10-06T12:00:00Z",
    "payerMemberId": "uuid-payer",
    "splitType": "EQUAL",
    "splits": [
      { "memberId": "uuid-m1", "amount": 500.00 },
      { "memberId": "uuid-m2", "amount": 500.00 },
      { "memberId": "uuid-m3", "amount": 500.00 }
    ],
    "receiptUrl": null,
    "notes": "Bill for Oct"
  }
  ```
* **Response `201 Created`:** Expense entity with populated splits and ledger references.
* **Errors:** `400 Bad Request` if $\sum \text{Splits} \ne \text{Amount}$, or if payer/participants do not belong to home.

### `GET /homes/:homeId/expenses`
* **Auth:** Bearer JWT | **Guard:** `HomeMemberGuard`
* **Query Parameters:** `page=1`, `limit=20`, `category=UTILITIES`
* **Response `200 OK`:**
  ```json
  {
    "total": 45,
    "page": 1,
    "limit": 20,
    "totalPages": 3,
    "data": [ ... ]
  }
  ```

### `DELETE /homes/:homeId/expenses/:expenseId`
* **Auth:** Bearer JWT | **Guard:** `HomeMemberGuard` (Role: `OWNER`, `ADMIN`, or Payer)
* **Response `200 OK`:** `{ "success": true, "message": "Expense and ledger entries deleted." }`

---

## 4. Balances & Debt Minimization (`/homes/:homeId/balances`)

### `GET /homes/:homeId/balances`
* **Auth:** Bearer JWT | **Guard:** `HomeMemberGuard`
* **Response `200 OK`:**
  ```json
  {
    "homeId": "uuid",
    "totalSpending": 45200.00,
    "totalExpenseCount": 38,
    "isReconciled": true,
    "memberBalances": [
      { "memberId": "uuid-1", "user": { "name": "Rohan" }, "balance": 1500.00, "status": "OWED" },
      { "memberId": "uuid-2", "user": { "name": "Amit" }, "balance": -1500.00, "status": "OWES" }
    ],
    "pairwiseDebts": [
      { "fromMemberId": "uuid-2", "toMemberId": "uuid-1", "fromName": "Amit", "toName": "Rohan", "amount": 1500.00 }
    ],
    "suggestedSettlements": [
      { "fromMemberId": "uuid-2", "toMemberId": "uuid-1", "amount": 1500.00, "cents": 150000 }
    ]
  }
  ```

---

## 5. Debt Settlements (`/homes/:homeId/settlements`)

### `POST /homes/:homeId/settlements`
* **Auth:** Bearer JWT | **Guard:** `HomeMemberGuard`
* **Headers:** `Idempotency-Key`
* **Request:**
  ```json
  {
    "fromMemberId": "uuid-debtor",
    "toMemberId": "uuid-creditor",
    "amount": 500.00,
    "notes": "Google Pay Ref #8912"
  }
  ```
* **Response `201 Created`:** Settlement entity and offsetting ledger entry.
* **Errors:** `400 Bad Request` if `amount > current outstanding debt` or if `fromMemberId === toMemberId`.

### `GET /homes/:homeId/settlements`
* **Auth:** Bearer JWT | **Guard:** `HomeMemberGuard`
* **Response `200 OK`:** Array of historical settlements.

---

## 6. Recurring Expenses (`/homes/:homeId/recurring`)

### `POST /homes/:homeId/recurring`
* **Auth:** Bearer JWT | **Guard:** `HomeMemberGuard`
* **Request:**
  ```json
  {
    "description": "Cook Salary",
    "amount": 6000.00,
    "category": "MAINTENANCE",
    "interval": "MONTHLY",
    "nextRunAt": "2026-11-01T00:00:00Z",
    "splitType": "EQUAL"
  }
  ```
* **Response `201 Created`:** Created `RecurringExpense` rule.

---

## 7. Household Bills (`/homes/:homeId/bills`)

### `POST /homes/:homeId/bills`
* **Auth:** Bearer JWT | **Guard:** `HomeMemberGuard`
* **Request:** `{ "title": "Electricity Bill", "amount": 3200.00, "dueDate": "2026-10-15T00:00:00Z" }`
* **Response `201 Created`:** Created `Bill` record with status `UNPAID`.

---

## 8. Monthly Budgets (`/homes/:homeId/budgets`)

### `POST /homes/:homeId/budgets`
* **Auth:** Bearer JWT | **Guard:** `HomeMemberGuard` (Role: `OWNER`, `ADMIN`)
* **Request:**
  ```json
  {
    "month": 10,
    "year": 2026,
    "totalBudget": 50000.00,
    "categories": [
      { "category": "GROCERIES", "allocatedAmount": 20000.00 },
      { "category": "UTILITIES", "allocatedAmount": 10000.00 }
    ]
  }
  ```
* **Response `201 Created`:** Budget and envelope allocations.

---

## 9. Receipt Storage & OCR (`/receipts`)

### `POST /receipts/presign`
* **Auth:** Bearer JWT
* **Request:** `{ "homeId": "uuid", "fileName": "bill.jpg", "mimeType": "image/jpeg" }`
* **Response `200 OK`:**
  ```json
  {
    "uploadUrl": "https://s3.amazonaws.com/homeexpense-receipts/...?signature=...",
    "fileUrl": "https://cdn.homeexpense.app/receipts/xyz.jpg",
    "receiptId": "uuid"
  }
  ```

### `POST /receipts/:receiptId/confirm-ocr`
* **Auth:** Bearer JWT
* **Request:** Human-confirmed merchant name, items, tax, and total.
* **Response `200 OK`:** Receipt state converted to `USER_VERIFIED`.
