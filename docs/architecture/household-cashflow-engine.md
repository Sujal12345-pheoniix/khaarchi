# Feature #2 — Household Cashflow & Safe-to-Spend Engine

## 1. Architectural Overview & Product Thesis

Khaarchi is the Household Financial Operating System. Unlike traditional single-user personal finance tools (which calculate safe-to-spend purely from personal bank accounts) or expense sharing tools (which only track peer-to-peer debts), Khaarchi understands the collective financial graph of the household.

Feature #1 answers:
> *"How financially healthy is this household?"*

Feature #2 answers:
> *"Given everything already committed, scheduled, and reserved inside this household, how much discretionary financial capacity do we safely have right now?"*

The underlying domain engine is the **Household Cashflow Engine**, and the user-facing metric is **Safe-to-Spend**.

---

## 2. Safe-to-Spend Formula (SAFE_TO_SPEND_V1)

Authoritative calculation:

$$\text{SafeToSpend} = \text{AvailableCapacity} + \text{ReliableExpectedInflow} - \text{PostedExpenses} - \text{UpcomingObligations} - \text{RecurringCommitments} - \text{ProtectedReserve}$$

### Exact Component Definitions

1. **Available Capacity ($\text{AvailableCapacity}$)**:
   - For budgeted households: Authoritative total monthly household budget sum across active category envelopes (`Budget.amount`).
   - For unbudgeted households: Historical 3-month trailing average monthly expenditure acting as a baseline ceiling (or reliable verified income inflows if established). In V1, if unbudgeted and zero baseline, marked with `LOW` data sufficiency.
2. **Reliable Expected Inflow ($\text{ReliableExpectedInflow}$)**:
   - Verified scheduled income or external inflows arriving within the current period horizon. In V1 default, conservative posture = ₹0 unless verified.
3. **Posted Expenses In Period ($\text{PostedExpenses}$)**:
   - Sum of all non-reverted actual expenses recorded in PostgreSQL within the active calendar month period (`from <= expense.date <= to`).
4. **Upcoming Obligations ($\text{UpcomingObligations}$)**:
   - Unpaid bills due within the remaining period (`dueDate >= referenceDate && dueDate <= periodEnd && status != BillStatus.PAID`).
   - Bills already marked `PAID` are strictly ignored to prevent double counting.
   - Overdue bills (`dueDate < referenceDate && status != BillStatus.PAID`) are included in commitments and prioritized as `HIGH` urgency warnings.
5. **Recurring Commitments ($\text{RecurringCommitments}$)**:
   - Unposted recurring expense instances whose next scheduled execution date falls strictly in the future of the current month (`nextRunAt >= referenceDate && nextRunAt <= periodEnd && status == ACTIVE`).
   - Previous recurring occurrences already executed earlier in the month are captured under `PostedExpenses` and thus ignored here.
6. **Protected Reserve ($\text{ProtectedReserve}$)**:
   - The emergency liquidity floor set explicitly by the household Owner (`Home.protectedReserve`). This capital is quarantined from discretionary spending.

---

## 3. Strict Financial Invariants

1. **Integer Minor Units (Paise/Cents)**:
   - All arithmetic operations are performed using integer cents/paise (`toCents`, `toMajor`, `roundFinancial`) to eliminate IEEE 754 floating-point drift.
2. **Deficit Preservation (No Zero-Clamping)**:
   - If obligations exceed capacity, Safe-to-Spend evaluates to a **negative number** (e.g. $-\text{₹}6,000$).
   - Status transitions to `DEFICIT` and a `CRITICAL` warning (`NEGATIVE_CAPACITY`) is emitted.
   - Deficits are **NEVER** silently clamped to zero, ensuring total transparency of financial distress.
3. **Double Counting Defenses**:
   - *Paid Bills*: Bills with `status === PAID` are excluded from upcoming obligations.
   - *Recurring Expenses*: Filtered strictly to `nextRunAt >= referenceDate`. Executed runs already exist as posted expenses in the ledger/expenses table.
   - *Shared Balances*: Unsettled peer-to-peer debts among members do not diminish total external household liquidity; they represent internal reallocation unless explicitly mapped to external settlements.
   - *Protected Reserve*: Quarantined as a structural deduction, never conflated with general savings.
4. **Deterministic Calculation**:
   - Zero AI/LLM involvement. The result is 100% reproducible and verifiable from PostgreSQL records.

---

## 4. Multi-Tenancy & Authorization

- All endpoints are nested under `/homes/:homeId/cashflow/*`.
- Every query enforces multi-tenant scoping (`where: { homeId }`).
- Requests pass through `JwtAuthGuard` and `HomeMemberGuard`. Non-members receive `403 Forbidden`.
- Modifying the emergency reserve (`PATCH /homes/:homeId/cashflow/reserve`) requires the `OWNER` role via `@RequireRoles(MemberRole.OWNER)`. Non-owners receive `403 Forbidden`.

---

## 5. Domain Warning Engine

The engine computes prioritized deterministic warnings:
- `CRITICAL` / `NEGATIVE_CAPACITY`: Obligations exceed capacity. Discretionary spending halted.
- `HIGH` / `OVERDUE_BILLS`: Unpaid bills have passed their due date.
- `HIGH` / `UPCOMING_BILLS_EXCEED_SAFE_TO_SPEND`: Upcoming bills exceed remaining discretionary cushion.
- `MEDIUM` / `LOW_CUSHION`: Safe-to-spend is positive but less than 15% of initial capacity.
- `LOW` / `NO_BUDGET`: Household operates without a defined budget envelope, reducing pacing accuracy.
- `LOW` / `NO_EMERGENCY_RESERVE`: No emergency liquidity buffer configured.
