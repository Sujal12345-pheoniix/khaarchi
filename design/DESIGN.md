---
name: Equilibrium Household
colors:
  surface: '#f6f9ff'
  surface-dim: '#cfdbe8'
  surface-bright: '#f6f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#ebf5ff'
  surface-container: '#e3effc'
  surface-container-high: '#ddeaf7'
  surface-container-highest: '#d8e4f1'
  on-surface: '#111d26'
  on-surface-variant: '#44474a'
  inverse-surface: '#26323b'
  inverse-on-surface: '#e6f2ff'
  outline: '#75777a'
  outline-variant: '#c5c7ca'
  surface-tint: '#5b5f62'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#181c1f'
  on-primary-container: '#818488'
  inverse-primary: '#c4c7cb'
  secondary: '#116c47'
  on-secondary: '#ffffff'
  secondary-container: '#9ef1c2'
  on-secondary-container: '#18704b'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#3f0400'
  on-tertiary-container: '#da5c45'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e0e3e7'
  primary-fixed-dim: '#c4c7cb'
  on-primary-fixed: '#181c1f'
  on-primary-fixed-variant: '#43474b'
  secondary-fixed: '#a1f4c5'
  secondary-fixed-dim: '#85d7aa'
  on-secondary-fixed: '#002112'
  on-secondary-fixed-variant: '#005233'
  tertiary-fixed: '#ffdad3'
  tertiary-fixed-dim: '#ffb4a5'
  on-tertiary-fixed: '#3f0400'
  on-tertiary-fixed-variant: '#87200f'
  background: '#f6f9ff'
  on-background: '#111d26'
  surface-variant: '#d8e4f1'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 3rem
    fontWeight: '600'
    lineHeight: 3.5rem
    letterSpacing: -0.03em
  display-lg-mobile:
    fontFamily: Geist
    fontSize: 2.25rem
    fontWeight: '600'
    lineHeight: 2.75rem
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Geist
    fontSize: 2rem
    fontWeight: '600'
    lineHeight: 2.5rem
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 1.625rem
    fontWeight: '600'
    lineHeight: 2.125rem
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Geist
    fontSize: 1.375rem
    fontWeight: '500'
    lineHeight: 1.875rem
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Geist
    fontSize: 1.125rem
    fontWeight: '500'
    lineHeight: 1.625rem
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Geist
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: 1.5rem
  body-md:
    fontFamily: Geist
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.375rem
  body-sm:
    fontFamily: Geist
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: 1.125rem
  label-lg:
    fontFamily: Geist
    fontSize: 0.875rem
    fontWeight: '500'
    lineHeight: 1.25rem
    letterSpacing: 0.01em
  label-md:
    fontFamily: Geist
    fontSize: 0.75rem
    fontWeight: '500'
    lineHeight: 1rem
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Geist
    fontSize: 0.6875rem
    fontWeight: '600'
    lineHeight: 0.875rem
    letterSpacing: 0.04em
  numeric-hero:
    fontFamily: Geist
    fontSize: 2.5rem
    fontWeight: '600'
    lineHeight: 3rem
    letterSpacing: -0.03em
  numeric-hero-mobile:
    fontFamily: Geist
    fontSize: 2rem
    fontWeight: '600'
    lineHeight: 2.5rem
    letterSpacing: -0.02em
  numeric-ledger:
    fontFamily: Geist
    fontSize: 1.125rem
    fontWeight: '500'
    lineHeight: 1.5rem
    letterSpacing: -0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-md: 1.5rem
  gutter-lg: 2rem
  margin: 1rem
  margin-md: 2rem
  margin-lg: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style

The design system embodies editorial financial clarity, architectural discipline, and quiet authority. Designed to support both flatmates navigating shared ledger splits ("Bachelor Mode") and families tracking household burn-down envelopes ("Family Mode"), the visual language rejects consumer-fintech hyperbole, noisy neon gradients, and gamified animations.

The aesthetic fuses Swiss graphic minimalism with tactile editorial layouts:
- **Calm, High-Information Legibility:** Crisp hierarchies prioritizing numeric comprehension, settlement paths, and transactional context without cognitive fatigue.
- **Architectural Precision:** Subtle hairline dividing rules, structural whitespace, and tabular alignment that evoke balance sheets and classical Swiss ledgers.
- **Dignified Tone:** Financial conversations among roommates and partners can be fraught; the interface acts as an objective, neutral arbiter—reliable, grounded, and serene.

## Colors

The palette relies on warm, natural materials contrasted with deep mineral inks and muted functional semantics.

### Canvas & Structural Neutrals
- **Canvas Base:** `#FBFBFA` (warm eggshell alabaster). Establishes an editorial, non-sterile foundation.
- **Surface Elevation:** `#FFFFFF` (pure white) for primary cards, balance sheets, and interactive inputs.
- **Surface Muted / Inset:** `#F4F5F6` for table headers, segmented pills, chip containers, and track states.
- **Hairline Border:** `#E6E9EB` applied across dividers, card strokes, and input outlines at 1px.

### Typography & Ink
- **Primary Ink:** Deep Basalt `#121619` for headlines, values, active states, and core currency figures.
- **Secondary Ink:** Slate Muted `#5E6A75` for metadata, labels, secondary breakdowns, and helper copy.
- **Tertiary Ink / Disabled:** `#9CA6AF` for inactive controls and placeholder text.

### Financial Semantic Accents
- **Credit / Surplus / Owed to User:** Deep Evergreen `#0F6B46` paired with Soft Sage `#E8F5EE` for badge backgrounds and credit rows.
- **Debit / Deficit / User Owes:** Terracotta `#A83824` paired with Soft Terracotta `#FDF0ED` for debt settlements, urgent dues, and budget overdrafts.
- **Informational / Neutral System:** Steel Blue `#234A6F` paired with Pale Steel `#EBF2F7` for multi-payer distribution tags and neutral reconciliation markers.
- **Pending / Warning:** Amber Ochre `#B45309` paired with Light Amber `#FEF3C7` for unverified splits and approaching bill limits.

## Typography

The type system prioritizes structural alignment and mathematical order using **Geist**.

### Tabular Formatting Rules
- **Font-Variant:** Apply `font-variant-numeric: tabular-nums lining-nums` across all numeric tokens, settlement lines, currency values, and timestamp indicators. Decimal points and commas must visually align vertically down lists.
- **Letter Spacing:** Headlines utilize tighter negative tracking (`-0.02em` to `-0.03em`) to anchor financial figures with editorial gravitas. Small uppercase and section labels use subtle positive tracking (`+0.02em` to `+0.04em`) to ensure legibility at micro scales.
- **Currency Symbols:** Prefix currency identifiers (`$`, `€`, `£`) match the numeral weight but reduce visual prominence via secondary ink or slightly reduced sizing to keep values front-and-center.

## Layout & Spacing

Layout adheres to an 8px base rhythm with 4px sub-grid precision for micro-alignments.

### Grid & Breakpoints
- **Mobile (Base to 639px):** 4-column fluid grid. Margin: `1rem` (16px), gutter: `1rem` (16px). All primary CTA elements, bottom sheets, and keypad inputs span full width or uniform dual splits.
- **Tablet (640px to 1023px):** 8-column fluid grid. Margin: `2rem` (32px), gutter: `1.5rem` (24px). Dual-pane layouts enable ledger list display on the left with settlement breakdowns on the right.
- **Desktop (1024px+):** 12-column structured grid locked to a max-width of `1280px`. Margin: `3rem` (48px), gutter: `2rem` (32px). Dedicated utility sidebar, central transaction stream, and contextual envelope breakdown panel.

### Spatial Discipline
- **Information Density:** Spacing between related numeric data (amount and label) is tight (`space-xs` to `space-sm`), while spacing between distinct transaction groups or envelope categories is generous (`space-lg` to `space-xl`) to prevent data bleed.
- **Touch Ergonomics:** Interactive mobile zones maintain a strict minimum hit area of 44x44px, regardless of the visual surface boundary.

## Elevation & Depth

Visual hierarchy is communicated via clean planar surface changes and hairline outlines (`#E6E9EB`), reinforced by soft, diffuse shadows rather than dramatic drop-offs.

### Layer Architecture
- **Level 0 (Canvas):** `#FBFBFA`. The primary backdrop for views, settings screens, and nested modules.
- **Level 1 (Card & Section):** `#FFFFFF` paired with a 1px continuous hairline outline (`#E6E9EB`) and an ambient micro-shadow: `0 1px 3px 0 rgba(18, 22, 25, 0.03), 0 1px 2px -1px rgba(18, 22, 25, 0.02)`.
- **Level 2 (Dropdowns, Popovers, & Sticky Controls):** `#FFFFFF` floating surface bordered by `#E6E9EB` with shadow: `0 4px 12px -2px rgba(18, 22, 25, 0.06), 0 2px 6px -1px rgba(18, 22, 25, 0.03)`.
- **Level 3 (Modals & Settlement Bottom Sheets):** `#FFFFFF` bordered at mobile top edges or perimeter with shadow: `0 20px 25px -5px rgba(18, 22, 25, 0.08), 0 8px 10px -6px rgba(18, 22, 25, 0.04)`.
- **Level -1 (Recessed / Inset Wells):** `#F4F5F6` with an optional 1px interior boundary, used for split calculation previews, ledger summaries, and segmented toggles.

## Shapes

The geometric framework balances human comfort with architectural restraint:
- **Base Controls & Inputs (`rounded` / 8px):** Applied to form fields, filter chips, action buttons, and segmented control segments. Retains precise structure while remaining soft to the touch.
- **Cards & Ledger Containers (`rounded-lg` / 12px):** Applied to grouped lists, envelope progress units, balance tiles, and analytics cards.
- **Sheets & Modals (`rounded-xl` / 16px):** Applied to full-scale payment dialogs, receipt inspection overlays, and mobile drawer sheets.
- **Avatars & Status Indicators (`rounded-full`):** Complete pills strictly reserved for participant user avatars, category icons, and binary status indicators.

## Components

### Buttons
- **Primary:** Background `#121619`, text `#FFFFFF`, 8px radius. Min-height 44px (touch) or 36px (compact desktop). Hover background `#2A3237`. Active scale 0.99.
- **Secondary:** Background `#FFFFFF`, border 1px solid `#E6E9EB`, text `#121619`, 8px radius. Hover background `#F4F5F6`.
- **Semantic / Settlement Actions:** Background `#0F6B46` (Mark Paid / Settle), text `#FFFFFF`. In negative debt context: `#A83824`.
- **Ghost:** Background transparent, text `#5E6A75`, hover text `#121619`, hover background `#F4F5F6`.

### Inputs & Keypad Fields
- **Standard Field:** Background `#FFFFFF`, 1px border `#E6E9EB`, 8px radius. Focus: 1px border `#121619` with a 2px outer ring in `rgba(18, 22, 25, 0.06)`.
- **Amount Entry (Large):** Displayed in `numeric-hero` font. Borderless, transparent background, centered or left-aligned with static primary ink prefix. Always pairs with tabular numerals.

### Chips & Filter Pills
- **Filter Chip:** Background `#F4F5F6`, text `#5E6A75`, 8px radius, height 32px. Active state: background `#121619`, text `#FFFFFF`.
- **Financial Status Badge:** Background `#E8F5EE` with text `#0F6B46` (Owed/Credit); background `#FDF0ED` with text `#A83824` (Owes/Due). 6px radius, padding 2px 8px, `label-sm` font.

### Lists & Ledger Rows
- **Item Cell:** Pure white `#FFFFFF` surface with hairline bottom divider `#E6E9EB`. Vertical padding 12px, horizontal padding 16px.
- **Structure:** Left side displays category icon container (36x36px, `#F4F5F6` background, 8px radius) followed by title and timestamp metadata. Right side displays tabular numeric amount: Evergreen if incoming/credit, Basalt if balanced, Terracotta if debt owed.

### Checkboxes, Radios, & Switches
- **Checkbox & Radio:** 18x18px box, 1px border `#5E6A75`, 4px radius (checkbox) or circular (radio). Checked state: `#121619` fill with white checkmark.
- **Mode Toggle (Bachelor vs. Family):** Dual-segmented rail on `#F4F5F6` with 8px radius. Active segment transitions with an opaque `#FFFFFF` pill and elevation level 1.

### Cards & Financial Envelopes
- **Budget Envelope Card:** 12px radius, `#FFFFFF` background, 1px `#E6E9EB` stroke. Contains envelope title, spent vs. total amount in `numeric-ledger`, and a 4px high progress track (`#F4F5F6` background with progress fill transitioning from `#0F6B46` to `#B45309` to `#A83824` at >90% burn).
- **Settlement Matrix Tile:** Highlighted debtor-to-creditor route container on `#FBFBFA` inset background, using directional arrow glyphs and direct "Settle Balance" secondary buttons.