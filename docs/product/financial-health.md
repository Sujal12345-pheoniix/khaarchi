# Khaarchi Financial Health Engine — Product Specification

**Document Version:** 1.0.0  
**Feature:** #1 — Khaarchi Financial Health Engine  
**Product Thesis:** "Khaarchi understands the financial health of your household."

---

## 1. Product Purpose & Philosophy

Khaarchi is built on the fundamental premise that households need more than basic expense tallying. Splitwise splits bills, banking apps show raw charts, but neither understands whether a household is financially robust, stressed, or accumulating hidden risks.

The Financial Health Engine answers five core questions:
1. **How financially healthy is this household right now?** (0–100 deterministic health score)
2. **Why is it in that state?** (Dimensional breakdown across 6 financial pillars)
3. **What is helping it?** (Household strengths and healthy habits)
4. **What needs attention?** (Deterministic, measurable risk alerts and warnings)
5. **How has its financial health changed?** (Score trend trajectory and explainable component deltas)

This engine is **not** an AI chatbot, not a random statistical guess, and not a credit rating. It is a deterministic domain engine reading authoritative double-entry financial data to provide calm, actionable household financial clarity.

---

## 2. User Experience by Household Archetype

### Bachelor Flat Mode (`BACHELOR`)
Roommates sharing an apartment prioritize fairness, debt minimization, settlement velocity, and predictable shared overhead:
- **Debt Health (30%)**: Are roommate debts being cleared, or is float accumulating?
- **Spending Stability (20%)**: Is shared utility/grocery spend tracking normal run-rates?
- **Budget Discipline (20%)**: Are shared flat envelopes being respected?
- **Recurring Load (15%)**: What percentage of spend is locked in fixed maid/wifi/rent contracts?
- **Bill Readiness (15%)**: Are utility obligations paid on time to avoid disruptions?
- **Contribution Balance (0% / N/A)**: Roommates have independent personal finances; pooled income fairness is omitted.

### Family Household Mode (`FAMILY`)
Families managing pooled domestic accounts prioritize envelope control, upcoming obligations, and fair pooling:
- **Budget Discipline (25%)**: Envelope adherence across groceries, education, utilities, and dining.
- **Bill Readiness (20%)**: Protection against missed bills and overdue utility notices.
- **Spending Stability (20%)**: Month-over-month household burn rate consistency.
- **Contribution Balance (15%)**: Balanced domestic expenditure sharing between contributing partners.
- **Recurring Load (10%)**: Flexibility against fixed monthly domestic overhead.
- **Debt Health (10%)**: Intra-family reconciliations.

---

## 3. The Six Health Dimensions

| Dimension | Description | Authoritative Source | Key Metric |
| :--- | :--- | :--- | :--- |
| **Budget Discipline** | Adherence to monthly spending envelope caps. | `budgets`, `budget_categories`, `expenses` | Budget utilization percentage & category overruns |
| **Bill Readiness** | Preparedness for domestic obligations and overdue debt prevention. | `bills` | Overdue count/amount & bills due in $\le 7$ days |
| **Spending Stability** | Current run-rate vs. 3-month historical baseline. | `expenses` (bounded monthly aggregations) | Normalized percentage deviation from baseline |
| **Debt Health** | Velocity and accumulation of unsettled balances. | `balances.service` & `ledger_entries` | Unsettled debt ratio relative to total household spend |
| **Recurring Load** | Proportion of expenditure locked into commitments. | `recurring_expenses` | Monthly recurring committed ratio |
| **Contribution Balance** | Equity of pooled domestic spending in Family mode. | `expenses` grouped by payer | Maximum contribution share disparity |

---

## 4. Health Status Mapping

| Score Range | Health Status | Badge Display | Meaning |
| :--- | :--- | :--- | :--- |
| **90 – 100** | `EXCELLENT` | Emerald Pill | Superb financial discipline, zero overdue obligations, balanced float. |
| **75 – 89** | `HEALTHY` | Soft Green Pill | Solid financial management with minor variance. |
| **60 – 74** | `WATCH` | Amber Pill | Envelopes nearing limits or minor bill/debt accumulation. |
| **40 – 59** | `AT_RISK` | Orange Pill | Budget exceeded, overdue obligations, or debt accumulation. |
| **0 – 39** | `CRITICAL` | Terracotta Pill | Multiple overdue obligations, severe budget overspend. |
| **N/A** | `BUILDING_PROFILE` | Slate Pill | New household or insufficient data history (< 2 dimensions). |

---

## 5. Missing Data Policy

A brand new household with 0 expenses must **never** be labeled `0/100 CRITICAL`. That would be misleading and demoralizing.

Khaarchi enforces a strict Data Sufficiency Model:
1. **`INSUFFICIENT`**: If active dimensions $< 2$, the engine returns `score: null`, `status: BUILDING_PROFILE`, and presents an actionable onboarding guide.
2. **`PARTIAL`**: If some dimensions are missing (e.g. no budget envelopes set, but bills and expenses exist), the engine dynamically re-normalizes weights of available dimensions to 100% and reports confidence as `MEDIUM` or `LOW`.
3. **`FULL`**: When all applicable dimensions possess authoritative data, confidence reports as `HIGH`.

---

## 6. Real-World Examples

### Example A: Balanced Family Household
- Monthly Budget: ₹50,000 | Spent to date: ₹38,000 (76% utilization) -> **Score: 100**
- Bills: All utility bills paid on time -> **Score: 100**
- Spending Stability: Projected spend is 4% below 3-month baseline -> **Score: 100**
- Debt Health: Zero unsettled debt -> **Score: 100**
- Recurring Load: ₹12,000/mo (24% of spend) -> **Score: 92**
- Contribution: Partners paid 52% and 48% -> **Score: 95**
- **Final Score: 98 (EXCELLENT)**

### Example B: Overdrawn Bachelor Flat
- Roommate Debts: ₹14,000 unsettled across 3 members (58% of spend) -> **Score: 40**
- Stability: Spend is 45% above 3-month baseline due to unplanned festival spend -> **Score: 50**
- Bills: 1 overdue WiFi bill (₹1,500) -> **Score: 65**
- Recurring: Rent + Maid = 62% of monthly spend -> **Score: 52**
- Budget: No budget set (Weight reallocated dynamically)
- **Final Score: 48 (AT_RISK)**
- **Deterministic Insight:** "1 overdue bill totaling ₹1,500 requires immediate payment. ₹14,000 in unsettled member balances represents 58% of spend."

---

## 7. Limitations & Ethical Guardrails

1. **Not Regulated Financial Advice**: Khaarchi Financial Health is an internal operational tool for household harmony, not an investment recommendation or lending underwriting metric.
2. **PostgreSQL as Financial Truth**: Analytical scores are downstream read-only artifacts and never mutate balances or ledgers.
3. **No Fabricated Income**: In the absence of user-configured income inputs, Khaarchi never guesses salary or net worth.
