# Financial Health Engine — Scoring Algorithm Specification

**Document Version:** 1.0.0  
**Algorithm Version:** `FINANCIAL_HEALTH_V1`  

---

## 1. Mathematical Scoring Formula

The Khaarchi Household Financial Health Score ($S \in [0, 100]$) is calculated as the deterministic linear weighted sum of normalized dimensional scores ($s_i \in [0, 100]$):

$$S = \text{round}\left(\sum_{i \in \text{Active}} s_i \cdot \hat{w}_i\right)$$

Where:
- $w_i$ is the base weight configured in the scoring profile for dimension $i$.
- $\hat{w}_i$ is the dynamically re-normalized weight for active dimensions:

$$\hat{w}_i = \frac{w_i}{\sum_{j \in \text{Active}} w_j}$$

- Active dimensions satisfy: $s_i \neq \text{null}$ and $w_i > 0$.
- If $|\text{Active}| < 2$, $S = \text{null}$ and Status is `BUILDING_PROFILE`.

---

## 2. Versioned Profiles

### Family Household Profile (`HEALTH_SCORE_PROFILE_V1_FAMILY`)
| Dimension | Key | Base Weight ($w_i$) |
| :--- | :--- | :--- |
| **Budget Discipline** | `BUDGET_DISCIPLINE` | 0.25 (25%) |
| **Bill Readiness** | `BILL_READINESS` | 0.20 (20%) |
| **Spending Stability** | `SPENDING_STABILITY` | 0.20 (20%) |
| **Contribution Balance** | `CONTRIBUTION_BALANCE` | 0.15 (15%) |
| **Recurring Load** | `RECURRING_LOAD` | 0.10 (10%) |
| **Debt Health** | `DEBT_HEALTH` | 0.10 (10%) |
| **Total** | | **1.00 (100%)** |

### Bachelor Flat Profile (`HEALTH_SCORE_PROFILE_V1_BACHELOR`)
| Dimension | Key | Base Weight ($w_i$) |
| :--- | :--- | :--- |
| **Debt Health** | `DEBT_HEALTH` | 0.30 (30%) |
| **Spending Stability** | `SPENDING_STABILITY` | 0.20 (20%) |
| **Budget Discipline** | `BUDGET_DISCIPLINE` | 0.20 (20%) |
| **Recurring Load** | `RECURRING_LOAD` | 0.15 (15%) |
| **Bill Readiness** | `BILL_READINESS` | 0.15 (15%) |
| **Contribution Balance** | `CONTRIBUTION_BALANCE` | 0.00 (0% / N/A) |
| **Total** | | **1.00 (100%)** |

---

## 3. Dimensional Scoring Functions

### 1. Budget Discipline ($s_{\text{budget}}$)
Let $u = \frac{\text{totalSpentCents}}{\text{totalBudgetCents}}$:
- If $u \le 0.80$: $s_{\text{raw}} = 100$
- If $0.80 < u \le 1.00$: $s_{\text{raw}} = 100 - \frac{u - 0.80}{0.20} \cdot 30$ (Decays linearly from 100 to 70)
- If $1.00 < u \le 1.25$: $s_{\text{raw}} = 70 - \frac{u - 1.00}{0.25} \cdot 50$ (Decays linearly from 70 to 20)
- If $u > 1.25$: $s_{\text{raw}} = \max\left(0, 20 - \frac{u - 1.25}{0.25} \cdot 20\right)$ (Decays to 0)
- Category Overrun Penalty: $-5$ points per overrun envelope (capped at $-15$).
- Final $s_{\text{budget}} = \text{clamp}(0, 100, \text{round}(s_{\text{raw}} - \text{penalty}))$.

### 2. Bill Readiness ($s_{\text{bills}}$)
- Overdue Penalty: $-35$ points per overdue bill.
- Upcoming Due ($\le 7$ days): $-8$ points per bill.
- Final $s_{\text{bills}} = \max(0, 100 - 35 \cdot n_{\text{overdue}} - 8 \cdot n_{\text{upcoming7}})$.

### 3. Spending Stability ($s_{\text{stability}}$)
Let $d_{\text{norm}}$ be projected month spend: $d_{\text{norm}} = \frac{\text{currentSpendCents}}{\max(0.1, \text{daysElapsed} / \text{daysInMonth})}$.  
Let $\Delta = \frac{d_{\text{norm}} - \text{baselineAvg}}{\text{baselineAvg}} \cdot 100\%$:
- If $\Delta \le 0\%$: $s = 100$
- If $0\% < \Delta \le 15\%$: $s = 100 - \frac{\Delta}{15} \cdot 15$ ($100 \to 85$)
- If $15\% < \Delta \le 35\%$: $s = 85 - \frac{\Delta - 15}{20} \cdot 20$ ($85 \to 65$)
- If $35\% < \Delta \le 60\%$: $s = 65 - \frac{\Delta - 35}{25} \cdot 25$ ($65 \to 40$)
- If $\Delta > 60\%$: $s = \max\left(10, 40 - \frac{\Delta - 60}{40} \cdot 30\right)$

### 4. Debt Health ($s_{\text{debt}}$)
Reuses authoritative `BalancesService` zero-sum ledger.  
Let $r = \frac{\text{totalUnsettledDebt}}{\text{totalHouseholdSpend}}$:
- If unsettled debt is 0: $s = 100$
- If $r \le 0.15$: $s = 100 - \frac{r}{0.15} \cdot 15$ ($100 \to 85$)
- If $0.15 < r \le 0.35$: $s = 85 - \frac{r - 0.15}{0.20} \cdot 20$ ($85 \to 65$)
- If $0.35 < r \le 0.60$: $s = 65 - \frac{r - 0.35}{0.25} \cdot 25$ ($65 \to 40$)
- If $r > 0.60$: $s = \max\left(15, 40 - \frac{r - 0.60}{0.40} \cdot 25\right)$

### 5. Recurring Load ($s_{\text{recurring}}$)
All active rules converted to monthly equivalent.  
Let $b = \frac{\text{monthlyRecurringCommittedAmount}}{\text{comparableMonthlySpend}}$:
- If $b \le 0.30$: $s = 100 - \frac{b}{0.30} \cdot 10$ ($100 \to 90$)
- If $0.30 < b \le 0.50$: $s = 90 - \frac{b - 0.30}{0.20} \cdot 20$ ($90 \to 70$)
- If $0.50 < b \le 0.70$: $s = 70 - \frac{b - 0.50}{0.20} \cdot 30$ ($70 \to 40$)
- If $b > 0.70$: $s = \max\left(15, 40 - \frac{b - 0.70}{0.30} \cdot 25\right)$

---

## 4. Verification Fixture (Section 39 Test Case)

```typescript
Family Mode Fixture:
Budget = 76       × 0.25 = 19.00
Bills = 94        × 0.20 = 18.80
Stability = 83    × 0.20 = 16.60
Contribution = 82 × 0.15 = 12.30
Recurring = 68    × 0.10 =  6.80
Debt = 91         × 0.10 =  9.10
---------------------------------
Weighted Sum             = 82.60
Final Display Score      = 83 (HEALTHY)
```
Verified in unit test: `apps/api/src/financial-health/__tests__/health-score.engine.spec.ts`.
