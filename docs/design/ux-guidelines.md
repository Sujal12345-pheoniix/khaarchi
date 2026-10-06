# Equilibrium Household — UX Guidelines & Interaction Architecture
**Product:** HomeExpense  
**Phase:** Phase 2 (Elite UI/UX + Design System)  
**Status:** Approved & Implemented  
**Core Invariant:** Visual experimentation must never violate financial rules or introduce balance drift.

---

## 1. Core Behavioral Principles

HomeExpense is designed as a calm, deterministic financial instrument. The user experience is governed by four non-negotiable principles:

1. **Deterministic Financial Truth Over Ambiguity:**
   - Every monetary transaction must prove its mathematical balance in real-time before submission.
   - Fractional cents never disappear into rounding black holes; remainder cents are explicitly assigned according to deterministic rules and visualized to the user.
2. **Immediate Cognitive Ergonomics:**
   - Entering an expense must take less than 15 seconds.
   - Payer selection, split distribution mode, and participants are accessible on a single progressive viewport without multi-step wizard friction.
3. **Calm, High-Signal Confidence:**
   - The UI never uses loud alarmist banners for routine operations.
   - Affirmative micro-pills (`"Ledger Balanced"`, `"100% Allocated"`) continuously reassure users of mathematical integrity.
4. **Adaptive Contextual Archetypes:**
   - A household of 4 college roommates has vastly different emotional and structural financial priorities than a family of 4 with a pooled joint mortgage and grocery budget. The UI dynamically shifts focus between **Bachelor Mode** and **Family Mode**.

---

## 2. Dual-Mode UX Architecture

```
                       ┌─────────────────────────────────────┐
                       │     HomeExpense Household Space     │
                       └──────────────────┬──────────────────┘
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
     ┌─────────────────────────┐                     ┌─────────────────────────┐
     │      BACHELOR MODE      │                     │       FAMILY MODE       │
     │   (Flat / Roommates)    │                     │   (Joint / Household)   │
     ├─────────────────────────┤                     ├─────────────────────────┤
     │ • Pairwise Debt Matrix  │                     │ • Category Budget Wells │
     │ • Settlement Paths      │                     │ • Pooled Shared Account │
     │ • Who owes Whom         │                     │ • Recurring Bills Due   │
     │ • Individual P&L        │                     │ • Household Burn Rate   │
     │ • Split Remainder Rules │                     │ • Allowance Discretion  │
     └─────────────────────────┘                     └─────────────────────────┘
```

### 2.1 Bachelor Mode (Roommate & Flat Sharing)
- **Primary Goal:** Eliminate social friction, clarify "who paid" and "who owes", and minimize the number of repayment transactions.
- **Key UX Surfaces:**
  - **Payer Rail:** Prominently highlights the member who fronted the capital.
  - **Pairwise Debt Matrix:** Clear grid or list showing direct obligations: *"Alex owes Jordan $31.13"*.
  - **Debt Simplification Action:** One-tap graph reduction converting 8 multi-person debts into 2 optimal transfers.
  - **Split Mode Rail:** Rapid switching between `Equal`, `Exact`, `% Pct`, and `Shares`.
  - **Explicit Remainder Visualization:** Shows who absorbed the odd cent: *"Jordan absorbed $0.01 remainder"*.

### 2.2 Family Mode (Household Envelope & Shared Pool)
- **Primary Goal:** Track collective household runway, ensure recurring utility/rent bills are funded, and monitor category envelope burnout.
- **Key UX Surfaces:**
  - **Budget Envelopes:** Progress bars and remaining balance meters for categories (Groceries, Utilities, Housing, Childcare).
  - **Bill Calendar:** Upcoming due dates with automated split reminders.
  - **Household Burn Rate:** Daily average velocity of expenditure versus monthly budget ceiling.
  - **Pooled vs. Reimbursable Toggles:** Clear distinction between pooled household expenses and personal reimbursable items.

---

## 3. Financial Calculation & Split UX

### 3.1 Live Split Feedback Loop
When editing an expense amount or participant list, the UI executes instant client-side math using `@homeexpense/financial-core`:
1. **Dynamic Person-Share Calculation:** As total amount changes from `$120.00` to `$124.50`, each participant's card reflects `$31.13` instantaneously.
2. **Remainder Absorption Callout:** A calm notification explains remainder distribution without cluttering the screen.
3. **Allocation Verification Bar:**
   - Displays a live progress bar reflecting percentage of cents accounted for.
   - When exactly `100.00%` is allocated, the bar transitions to secondary evergreen (`#116c47`) with a checkmark badge.
   - If over-allocated or under-allocated (e.g. in `Exact` or `% Pct` mode), the bar transitions to terracotta (`#ba1a1a`) and disables the submit button with a precise prompt: *"Allocate remaining $4.20 to balance ledger"*.

---

## 4. UI States & Feedback Patterns

### 4.1 Loading States
- Content areas utilize smooth pulse skeletons with matching border radii (`rounded-2xl`).
- Buttons display spinning loader icons (`Loader2`) and maintain fixed dimensions to prevent layout shift during async mutations.

### 4.2 Empty States
- Never display blank white space.
- Display an editorial illustration or stylized geometric glyph, a reassuring explanation of why no records exist yet, and a clear call-to-action button (e.g., *"Record your first expense"* or *"Establish your first home"*).

### 4.3 Error Handling & Validation
- Validation feedback appears directly alongside the offending control (e.g., inside the participant breakdown card or below the amount input).
- Errors specify the exact mathematical variance down to the integer cent (e.g., *"Sum of shares ($99.98) does not equal total amount ($100.00)"*).

---

## 5. Interaction Ergonomics & Mobile-First Execution

1. **One-Thumb Operation:**
   - Sticky primary action buttons are anchored at the bottom edge (`pb-safe`) for effortless thumb reach on mobile devices.
2. **Tabular Numeral Alignment:**
   - Financial lists right-align numerical values, guaranteeing decimal points align down entire transaction feeds.
3. **Haptic & Kinetic Micro-Interactions:**
   - Tapping segmented controls uses subtle scale shifts (`active:scale-[0.98]`).
   - Mode toggles animate with smooth spring transitions without lag.
