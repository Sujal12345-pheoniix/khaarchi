# Equilibrium Household — Design System Specification
**Product:** HomeExpense  
**Phase:** Phase 2 (Elite UI/UX + Design System)  
**Status:** Approved & Implemented  
**Reference Origin:** `design/DESIGN.md`, `design/code.html`, `design/screen.png`

---

## 1. Design Philosophy & Aesthetic Intent

HomeExpense implements the **Equilibrium Household** design language: an editorial, Swiss-inspired financial minimalism engineered specifically for high-density household economics. It completely eschews generic AI dashboard conventions (excessive gradients, glassmorphism blur stacks, floating SaaS cards with oversized dropshadows) in favor of:

1. **Deterministic Legibility:** Financial figures must be readable at a glance without visual ambiguity.
2. **Restraint & High Signal:** Clean hairline borders and subtle tonal steps replace loud shadows and distracting decorations.
3. **Tabular Precision:** Every monetary value, share count, and ledger delta uses monospaced tabular numerals (`font-variant-numeric: tabular-nums`) so decimals align vertically.
4. **Calm Spatial Architecture:** An eggshell/arctic canvas (`#f6f9ff`) paired with pure white containers (`#ffffff`) and deep obsidian typography (`#111d26`) provides zero fatigue for frequent daily entry.

---

## 2. Color System & Semantic Token Roles

The color architecture is built around three tonal layers: Arctic Canvas, Layered Containers, and Precision Accents.

### 2.1 Surfaces & Neutrals
| Token Name | Hex Code | Semantic Role |
| :--- | :--- | :--- |
| `surface-canvas` | `#f6f9ff` | Global background canvas for pages |
| `surface-container-lowest` | `#ffffff` | Primary cards, hero input blocks, elevated modals |
| `surface-container-low` | `#f0f4f9` | Secondary cards, subtle grouped lists, input backgrounds |
| `surface-container` | `#ebf5ff` | Inset well containers, chip backgrounds, micro-pill wells |
| `surface-container-high` | `#e3effc` | Hover states on wells, active selection indicators |
| `surface-container-highest` | `#ddeaf7` | Active segmented control thumbs, borders on high-contrast containers |

### 2.2 Typography & Ink
| Token Name | Hex Code | Semantic Role |
| :--- | :--- | :--- |
| `ink` / `on-surface` | `#111d26` | Deep obsidian ink for primary headlines, amounts, and critical text |
| `on-surface-variant` | `#444749` | Secondary descriptions, column headers, meta labels |
| `outline` | `#747779` | Active input borders, focused boundaries |
| `outline-variant` | `#c5c7ca` | Hairline separators, subtle borders (`#e6e9eb` in light contrast contexts) |

### 2.3 Semantic Accents & Financial Indicators
| Token Name | Hex Code | Semantic Role | Container Pair |
| :--- | :--- | :--- | :--- |
| `primary` | `#000000` | Primary actions, pill buttons, critical badges | `#f0f4f9` |
| `secondary` | `#116c47` | Evergreen surplus, verified balanced ledger, credits | `#9ef1c2` (`secondary-container`) |
| `error` | `#ba1a1a` | Terracotta debt, unallocated remainder, validation errors | `#ffdad6` (`error-container`) |
| `mode-bachelor` | `#0369a1` | Sky blue badge for Bachelor/Flat roommate split mode | `#e0f2fe` |
| `mode-family` | `#116c47` | Emerald badge for Family pooled budget envelope mode | `#e8f5e9` |

---

## 3. Typography Hierarchy & Tabular Numerals

Typography is built on **Geist** for crisp geometric UI reading and **Geist Mono** for cryptographic hashes, currencies, and technical IDs.

### 3.1 Strict Tabular Numeral Mandate
> **Invariable Rule:** All monetary amounts, percentages, quantities, and share ratios MUST render with `font-variant-numeric: tabular-nums` (Tailwind class: `font-numeric`). This prevents decimal jitter and ensures columns of amounts align to the exact cent.

### 3.2 Type Scale
| Level | Font Size | Line Height | Weight | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Hero Numeric** | `40px` (`2.5rem`) | `1.1` | Bold (`700`) | Main expense entry amount, big balance display |
| **Heading 1** | `24px` (`1.5rem`) | `1.2` | Bold (`700`) | Page titles, home ledger names |
| **Heading 2** | `18px` (`1.125rem`) | `1.3` | Semibold (`600`) | Section titles, modal headers |
| **Heading 3** | `15px` (`0.9375rem`) | `1.4` | Semibold (`600`) | Card headings, breakdown section names |
| **Body Large** | `14px` (`0.875rem`) | `1.5` | Regular (`400`) / Medium (`500`) | Primary inputs, member names, button text |
| **Body Small** | `12px` (`0.75rem`) | `1.4` | Regular (`400`) / Medium (`500`) | Secondary descriptions, timestamps, pills |
| **Micro / Mono** | `11px` (`0.6875rem`) | `1.3` | Medium (`500`) / Semibold (`600`) | Ledger balance status, role tags, percentages |

---

## 4. Elevation, Radii & Hairline Boundaries

### 4.1 Border Strategy
- Default borders: `1px solid var(--outline-variant)` (`#c5c7ca` with opacity or `#e6e9eb`).
- Focus borders: `1px solid #111d26` (Ink).
- Error borders: `1px solid #ba1a1a` (Terracotta).
- No drop shadows are used without a containing border.

### 4.2 Elevation Levels
- **Level 0 (Flat):** `box-shadow: none` — standard inputs, list items inside containers.
- **Level 1 (Card):** `0 1px 2px rgba(17, 29, 38, 0.05)` — surface cards, segmented control active thumb.
- **Level 2 (Dropdown / Modal):** `0 4px 12px rgba(17, 29, 38, 0.08)` — popups, active modals, floating actions.
- **Level 3 (Sticky Drawer / Overlay):** `0 12px 24px -4px rgba(17, 29, 38, 0.12)` — sticky submission bars.

### 4.3 Corner Radii
- Pill buttons & badges: `9999px` (`rounded-full`)
- Cards & Modals: `16px` (`rounded-2xl`)
- Form Inputs & Buttons: `12px` (`rounded-xl`)
- Micro chips & tags: `6px` (`rounded-md`)

---

## 5. Core Component Specifications

### 5.1 Hero Amount Card
- Centered or left-aligned within a white card container (`surface-container-lowest`).
- Currency indicator displayed as a crisp secondary symbol (`text-on-surface-variant font-mono text-2xl`).
- Large tabular input field without ugly default browser borders (`font-numeric-hero text-40px font-bold text-ink`).

### 5.2 Status Micro-Pill
- Height: `24px`
- Background: `surface-container` (`#ebf5ff`)
- Indicator: Small lock or checkmark icon with text: `"USD • Ledger Balanced"` or `"INR • Ledger Balanced"`.
- Signal: Communicates deterministic double-entry accounting state continuously to the user.

### 5.3 Segmented Mode Rail (Split Selector)
- 4 segments: `Equal`, `Exact`, `% Pct`, `Shares`.
- Container background: `surface-container` with subtle hairline border.
- Active segment: Pure white thumb with `shadow-elevation-1`, bold obsidian text.
- Inactive segments: Text on surface variant, hover background transition.

### 5.4 Live Calculation & Allocation Integrity Banner
- Background: Mint container `#e8f5e9` or `#9ef1c2` when 100% balanced; Terracotta `#ffdad6` when drifting.
- Text: Clear breakdown summary: `"Split 4 ways • $31.13 / person • Cent-perfect remainder absorption applied for zero ledger drift."`
- Real-time arithmetic verification bar: Visual bar showing total percentage allocated (must equal exactly 100.00% or total cents before submission).

### 5.5 Sticky Action Bar
- Pinned to the bottom of the viewport with a subtle gradient backdrop or frosted blur (`backdrop-blur-md`).
- Primary button: Full-width or right-aligned obsidian button (`bg-ink text-white rounded-full py-3.5 px-6 font-semibold`).
- Auto-sync status indicator: `"Double-entry verified & ready to commit"` with animated or steady green pulse.

---

## 6. Accessibility & WCAG Compliance

1. **Color Contrast:**
   - Ink `#111d26` against Canvas `#f6f9ff`: **13.8:1** (Exceeds WCAG AAA requirement of 7:1).
   - Evergreen `#116c47` against White `#ffffff`: **5.4:1** (Exceeds WCAG AA requirement of 4.5:1).
   - Error `#ba1a1a` against White `#ffffff`: **6.1:1** (Exceeds WCAG AA requirement of 4.5:1).
2. **Touch Targets:**
   - All interactive touch targets (buttons, segmented controls, payer avatar chips) maintain a minimum dimension of **44x44 CSS pixels** on mobile viewports.
3. **Assistive Labels:**
   - Currency inputs include explicit `aria-label` specifying currency denomination and cent requirements.
   - Dynamic balance bars announce allocation percentages via `aria-live="polite"` regions.
