# Data Flow Diagrams (DFD)
## HomeExpense — Core Process Data Flows

**Document Version:** 1.0.0  
**Notation:** Gane & Sarson / Yourdon Structured Analysis  

---

## 1. DFD Level 0: System Context Diagram

```
                 ┌────────────────────────────────────────────────────────┐
                 │                      User / Client                     │
                 └───────┬────────────────────────────────────────▲───────┘
                         │                                        │
           Expense Inputs│                                        │Real-time Balances,
           Receipt Scans,│                                        │Ledger Feeds,
           Settlement Cmd│                                        │Settlement Plans
                         ▼                                        │
                 ┌────────────────────────────────────────────────┴───────┐
                 │                                                        │
                 │                 0.0 HOMEEXPENSE SYSTEM                 │
                 │              (Household Financial Engine)              │
                 │                                                        │
                 └───────┬────────────────────────────────────────▲───────┘
                         │                                        │
           SQL Queries & │                                        │Authoritative Records,
           Transactions  │                                        │Immutable Ledger Data
                         ▼                                        │
                 ┌────────────────────────────────────────────────┴───────┐
                 │                PostgreSQL Data Store                   │
                 │             (Homes, Ledger, Balances)                  │
                 └────────────────────────────────────────────────────────┘
```

---

## 2. DFD Level 1: System Decomposition

```
                           ┌──────────────────────────────┐
                           │          User/Client         │
                           └──────────────┬───────────────┘
                                          │
                  ┌───────────────────────┼───────────────────────┐
                  │ (1) Auth              │ (2) Expense           │ (3) Settlement
                  ▼                       ▼                       ▼
       ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
       │   1.0 Auth &        │ │  2.0 Financial      │ │  3.0 Balance &      │
       │   Membership        │ │  Event Processing   │ │  Settlement Engine  │
       └──────────┬──────────┘ └──────────┬──────────┘ └──────────┬──────────┘
                  │                       │                       │
                  ▼                       ▼                       ▼
            [D1: Users &            [D2: Expenses &         [D3: Ledger       │
             HomeMembers]            ExpenseSplits]          Entries]         │
                                          │                       ▲           │
                                          └───────────────────────┼───────────┘
                                                  Generates       │ Updates /
                                                  Double-Entry    │ Counterbalances
```

---

## 3. DFD Level 2: Financial Event to Double-Entry Ledger Pipeline

```
[User Submits Expense]
       │
       ▼
(2.1 Validate Invariants)
       │ - Check Payer is Active Member
       │ - Check All Participants in Home
       │ - Verify SUM(Splits) === Expense Total (Cents)
       ▼
(2.2 Begin DB Transaction)
       │
       ├─────────────────────────────────┐
       ▼                                 ▼
(2.3 Insert Expense Record)     (2.4 Insert ExpenseSplits)
       │                                 │
       └────────────────┬────────────────┘
                        │
                        ▼
(2.5 Generate Double-Entry Ledger Records)
       │ For each participant P != Payer:
       │   Insert LedgerEntry:
       │     Debtor = P
       │     Creditor = Payer
       │     Amount = Split Amount
       ▼
(2.6 Write Immutable Audit Log)
       │
       ▼
(2.7 Commit Transaction) ──▶ [Notify Home Members via Outbox]
```

---

## 4. DFD Level 2: Settlement & Debt Reduction Flow

```
[User Submits Settlement (Debtor, Creditor, Amount)]
       │
       ▼
(3.1 Verify Authorization & Membership)
       │
       ▼
(3.2 Query Ledger: Calculate Outstanding Debt)
       │ Net Debt = SUM(Debtor -> Creditor) - SUM(Creditor -> Debtor)
       │ Check: 0 < Settlement Amount <= Net Debt
       ▼
(3.3 Begin DB Transaction)
       │
       ├─────────────────────────────────┐
       ▼                                 ▼
(3.4 Insert Settlement Record)  (3.5 Insert Offsetting LedgerEntry)
       │                           Debtor = Creditor (original)
       │                           Creditor = Debtor (original)
       │                           Amount = Settlement Amount
       ▼                                 │
(3.6 Write AuditLog)                     │
       │                                 │
       └────────────────┬────────────────┘
                        │
                        ▼
(3.7 Commit DB Transaction) ──▶ [Recalculate Net Balances: (Net Debt - Amount)]
```

---

## 5. DFD Level 2: Receipt OCR & Human Verification Pipeline

```
[User Uploads Receipt Image]
       │
       ▼
(4.1 Request Pre-signed S3 URL) ──▶ (Direct Upload to S3 Bucket)
       │
       ▼
(4.2 Insert Receipt Record: Status = PENDING_SCAN)
       │
       ▼
(4.3 Push Job to BullMQ Redis Queue: 'ocr-processing-queue')
       │
       ▼
(4.4 Worker Fetches Image, Invokes OCR Engine)
       │ Extracts: Merchant, Date, Total, Tax, Line Items
       ▼
(4.5 Update Receipt Record: Status = OCR_EXTRACTED, Payload = JSON)
       │
       ▼
(4.6 Client Renders Interactive Review Modal)
       │ Human Inspects & Edits Parsed Values
       ▼
(4.7 User Clicks "Confirm & Convert")
       │
       ▼
(4.8 Trigger Standard Expense Pipeline: Journey 8)
       Status = USER_VERIFIED
```
