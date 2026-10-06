# Lifecycle State Machines
## HomeExpense — Formal Financial & Operational State Transitions

**Document Version:** 1.0.0  

---

## 1. Expense State Machine

```
              ┌───────────────┐
              │    DRAFT      │ (Optional temporary draft from OCR)
              └───────┬───────┘
                      │ Submit & Invariants Validated
                      ▼
              ┌───────────────┐
       ┌─────▶│   CONFIRMED   │ (Authoritative record; written to Ledger)
       │      └───────┬───────┘
       │              │
Re-edit│              ├─────────────────────────────┐
(offset│              ▼ Edit (atomic ledger offset) ▼ Delete (reversal entry)
& re-  │      ┌───────────────┐             ┌───────────────┐
insert)└──────│    EDITING    │             │   REVERSED    │ (Terminal; ledger canceled)
              └───────────────┘             └───────────────┘
```

* **CONFIRMED:** Expense is validated, immutable ledger entries are generated, and net balances are updated.
* **REVERSED:** An expense deletion does not delete historical rows; it writes counterbalancing ledger entries with `status = REVERSED`.

---

## 2. Settlement State Machine

```
              ┌───────────────┐
              │    PENDING    │ (Recorded by payer; awaiting confirmation if required)
              └───────┬───────┘
                      │
                      ├─────────────────────────────┐
                      │ Confirmed by payee / auto    │ Rejected / Disputed
                      ▼                             ▼
              ┌───────────────┐             ┌───────────────┐
              │   CONFIRMED   │             │   REJECTED    │
              │ (Offset ledger│             │ (No ledger    │
              │  entries live)│             │  offset)      │
              └───────┬───────┘             └───────────────┘
                      │
                      ▼ Voided by Admin
              ┌───────────────┐
              │    VOIDED     │ (Counterbalancing reversal written)
              └───────────────┘
```

---

## 3. Bill State Machine

```
   ┌───────────────┐
   │    DRAFT      │
   └───────┬───────┘
           │ Activate
           ▼
   ┌───────────────┐       Due Date Passes
   │    UNPAID     │─────────────────────────┐
   └───────┬───────┘                         ▼
           │                         ┌───────────────┐
           │ Member Pays Bill        │    OVERDUE    │
           │ (Converts to Expense)   └───────┬───────┘
           ▼                                 │ Member Pays
   ┌───────────────┐                         │
   │     PAID      │◀────────────────────────┘
   └───────┬───────┘
           │ (Archived)
           ▼
   ┌───────────────┐
   │   ARCHIVED    │
   └───────────────┘
```

---

## 4. Recurring Expense State Machine

```
   ┌───────────────┐
   │    ACTIVE     │ ──(Cron fires on due date)──▶ [Generates Confirmed Expense Instance]
   └───────┬───────┘                                      │
           │                                              │
           ├─────────────────────────┐                    ▼
           │ Pause                   │ Cancel     ┌───────────────┐
           ▼                         ▼            │   INSTANCE    │
   ┌───────────────┐         ┌───────────────┐    │   GENERATED   │
   │    PAUSED     │         │   CANCELLED   │    └───────────────┘
   └───────┬───────┘         └───────────────┘
           │ Resume
           ▼
   ┌───────────────┐
   │    ACTIVE     │
   └───────────────┘
```

---

## 5. Home Invitation State Machine

```
              ┌───────────────┐
              │    PENDING    │ (Email dispatched; token valid for 7 days)
              └───────┬───────┘
                      │
        ┌─────────────┼─────────────────────────────┐
        │ Accept      │ Reject                      │ TTL Expiration (7 days)
        ▼             ▼                             ▼
┌───────────────┐ ┌───────────────┐         ┌───────────────┐
│   ACCEPTED    │ │   REJECTED    │         │    EXPIRED    │
│ (User added   │ │ (Token killed)│         │ (Token killed)│
│  as Member)   │ └───────────────┘         └───────┬───────┘
└───────────────┘                                   │ Resend
                                                    ▼
                                            ┌───────────────┐
                                            │    PENDING    │
                                            └───────────────┘
```

---

## 6. Receipt & OCR Pipeline State Machine

```
   ┌──────────────────┐
   │   PENDING_SCAN   │ (File uploaded to S3; queued in BullMQ)
   └─────────┬────────┘
             │
             ├─────────────────────────────────────────┐
             │ OCR worker extracts line items          │ Extraction Error
             ▼                                         ▼
   ┌──────────────────┐                       ┌──────────────────┐
   │   OCR_EXTRACTED  │                       │   SCAN_FAILED    │
   └─────────┬────────┘                       └─────────┬────────┘
             │                                          │ Manual Entry
             ├──────────────────────────┐               │
             │ User Confirms & Edits    │ Rejected      ▼
             ▼                          ▼         ┌──────────────────┐
   ┌──────────────────┐        ┌──────────────┐   │  USER_VERIFIED   │
   │  USER_VERIFIED   │        │   REJECTED   │   │(Manual entry     │
   │(Converts to      │        │(Discarded)   │   │ converted to exp)│
   │ Authoritative    │        └──────────────┘   └──────────────────┘
   │ Expense)         │
   └──────────────────┘
```

---

## 7. Notification State Machine

```
   ┌───────────────┐
   │    QUEUED     │ (Written to OutboxEvent in DB)
   └───────┬───────┘
           │ Worker dequeues
           ▼
   ┌───────────────┐
   │  PROCESSING   │
   └───────┬───────┘
           │
           ├─────────────────────────┐
           │ Provider accepts (200)   │ Error (SMTP / Network)
           ▼                         ▼
   ┌───────────────┐         ┌───────────────┐
   │   DELIVERED   │         │    FAILED     │ (Retry up to 3x with backoff)
   └───────────────┘         └───────┬───────┘
                                     │ Max retries exceeded
                                     ▼
                             ┌───────────────┐
                             │  DEAD_LETTER  │
                             └───────────────┘
```
