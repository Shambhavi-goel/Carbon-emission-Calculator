# Master Frontend Implementation Plan: Waste Carbon Calculator & Eco-Reward System

**Tech Stack:** Pure HTML5, CSS3, Modern JavaScript (ES Modules).  
**Execution Environment:** Client-side only; zero frameworks, zero external build tools, zero backend runtime requirements.  
**Design System Foundation:** Governed by `THEME-AND-DESIGN-SYSTEM.md` and `css/tokens.css`.

---

## 1. Executive Summary & Product Architecture

The Waste Carbon Calculator is an interactive, browser-only web application designed to help individuals understand the embodied carbon footprints of their everyday waste items, learn waste reduction strategies, and build sustainable habits through a gamified **Eco-Points & Wallet System**.

### 1.1 Scope Boundaries
* **In Scope (Frontend Strictly):**
  * Landing page with educational content, live climate data citations, and responsive layout.
  * Client-side authentication simulation (Sign In, Sign Up, Quick Demo Access) using Web Crypto API.
  * Local image upload, client preview, and canvas-based thumbnail generation (no files sent to any server).
  * Weight conversion (grams and kilograms) with strict input validation.
  * Pluggable analysis service (ships with a keyword-based mock classifier; ready for external REST AI endpoint).
  * Carbon emission calculations with illustrative emission factors and transparent mathematical breakdowns.
  * Material-specific reduction tips and human-in-the-loop confidence correction.
  * User-scoped local storage history, live filter by material, and proportional CSS emission bar chart.
  * Complete Eco-Points reward engine, daily streak tracking, tier progression, interactive wallet modal, and floating toast notifications.
* **Out of Scope:**
  * Server-side infrastructure, database servers, and cloud auth backends (all state is browser-local and device-specific).

### 1.2 High-Level User Journey

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. LANDING & MAIN PAGE (index.html)                                         │
│    • Climate snapshot metrics (NASA anomaly, NOAA Mauna Loa CO₂)            │
│    • Educational foundations: Carbon emissions, warming impacts, materials │
│    • 1-Click Quick Demo Access OR Custom Browser-Stored Registration        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. AUTHENTICATION & SESSION GUARD (authService.js, authUI.js)               │
│    • SHA-256 Web Crypto hashed password storage in localStorage             │
│    • Session storage validation guarding dashboard.html                     │
│    • "Quick demo access" instant login for demo & testing purposes          │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. ANALYZER & EMISSION CALCULATION (dashboard.js, analyzeService.js)        │
│    • Local image upload & client-side thumbnail generation (no cloud upload)│
│    • Weight conversion (grams / kilograms)                                  │
│    • Material classification (Plastic, Paper, Metal, Organic, Wood)         │
│    • CO₂e emission calculation based on material factors                    │
│    • Human-in-the-loop material correction for low-confidence estimates     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. ECO-POINTS REWARD ENGINE & WALLET (rewardService.js, walletService.js)   │
│    • Formula: Base (10) + Material Multiplier + Bonuses (Daily / Conf / Fix)│
│    • Instant animated reward toast & result badge                           │
│    • Live header wallet pill (🪙 Balance) + Daily streak indicator (🔥)     │
│    • 4th Dashboard Summary metric card linked to interactive Wallet Modal   │
│    • Tier progression (🌱 Explorer → 🌿 Guardian → 🌳 Crusader → 🏆 Hero)   │
│    • 50-item persistent transaction ledger in localStorage                  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5. HISTORY & ANALYTICS VISUALIZATION (dashboard.js, storageService.js)      │
│    • Browser-local history table with thumbnails & earned points badges     │
│    • Filter by material category                                            │
│    • Proportional CSS bar chart of emissions across material types          │
│    • Individual entry deletion & storage quota fallback handling            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Theme, Design System & Style Tokens

The visual foundation is defined in [`frontend/THEME-AND-DESIGN-SYSTEM.md`](./frontend/THEME-AND-DESIGN-SYSTEM.md) and centrally declared as CSS custom properties in [`frontend/css/tokens.css`](./frontend/css/tokens.css). Component and section stylesheets consume these tokens exclusively without introducing unmanaged literal values.

### 2.1 Design Philosophy & Visual Principles
* **Restrained Sustainability:** Conveys environmental purpose through calm, legible, data-oriented surfaces rather than oversaturated bright greens.
* **Functional Hierarchy:**
  * Page and section backgrounds remain pale and quiet (`--paper`), minimizing visual friction.
  * Content cards, input groups, and dialogs use clean white surfaces (`--surface`) with subtle neutral borders (`--line`) rather than heavy decorative treatments.
  * Brand action and primary affordances use Forest Teal (`--teal`, `--teal-dark`).
  * Gamification, points, and wallet elements use Amethyst Purple (`--demo`, `--demo-light`) to create distinct visual identity without clashing with data displays.
  * Numerical carbon metrics receive strong typographic emphasis, prominent font weights, and tabular numerals.
  * Elevation is used selectively—primarily on the active calculation result card, floating reward toasts, and modal dialog overlays.

### 2.2 Stylesheet Architecture & Cascade Order
All styles follow a strict 4-tier layer model loaded in exact order:
1. `tokens.css`: Design variables, CSS custom properties in `:root` (colors, typography, spacing, radii, shadows, motion).
2. `base.css`: CSS reset, global box-sizing, smooth scrolling, focus-visible outlines, skip link, container constraints, and reduced-motion media query overrides.
3. `components.css`: Reusable UI elements—buttons, cards, form inputs, tabs, notices/alerts, badges, upload zones, modal dialogs, and reward toasts.
4. `sections.css`: Layout orchestration—site header, hero banner, stats ticker, educational sections, FAQ accordion, dashboard analyzer grid, and footer.

---

### 2.3 Comprehensive Color Palette

#### 2.3.1 Brand & Interface Palette
| Token | Hex | Role and Usage |
| :--- | :--- | :--- |
| `--ink` | `#12202B` | Main text, primary headings, strong foregrounds, and footer background. |
| `--paper` | `#F3F6F5` | Default page background, table header strip, and formula detail insets. |
| `--surface` | `#FFFFFF` | Cards, forms, modal surfaces, and container backgrounds. |
| `--teal` | `#0F5C5C` | Primary brand & action color: primary CTA buttons, links, active tab underlines, focus rings, and badges. |
| `--teal-dark` | `#0A4444` | Hover and active states for buttons and links; text on pale teal backgrounds. |
| `--teal-mid` | `#1A7A7A` | Intermediate gradient stop for hero orbs and headers. |
| `--teal-light` | `#E7EFEB` | Soft brand tint for selected tabs, upload drag states, and info panels. |
| `--teal-xlight` | `#F0F7F4` | Very pale gradient wash for hero and dashboard header backgrounds. |
| `--muted` | `#5B6B75` | Supporting copy, form field hints, secondary metadata, and table column captions. |
| `--line` | `#D5DDDA` | Subtle card outlines, table borders, and section dividers. |
| `--line-strong`| `#A8B8B2` | Prominent boundaries: text input borders, active control outlines, and dashed upload zones. |

#### 2.3.2 Gamification & Eco-Wallet Palette
| Token | Hex | Role and Usage |
| :--- | :--- | :--- |
| `--demo` | `#5C3D9F` | Primary wallet token: wallet pill borders, tier progress fills, active tier item borders, and toast gradients. |
| `--demo-dark` | `#412D75` | Wallet text, prominent points values (`summary-value-pts`), and dark gradient stops. |
| `--demo-light` | `#EDE8FA` | Soft lavender background for wallet pills, quick demo access button, and points badges. |

#### 2.3.3 Status & Feedback Palette
| Token | Hex | Role and Usage |
| :--- | :--- | :--- |
| `--signal` | `#E3A21A` | Amber warning border, streak fire borders, and low-confidence classification badges. |
| `--signal-bg` | `#FCF5E6` | Pale amber background paired with warning text and streak badges. |
| `--alert` | `#B3402A` | Brick red for form validation errors, calculation failure notices, and destructive actions. |
| `--alert-bg` | `#FBECE8` | Pale red background paired with error notices and access error dialogs. |
| `--info` | `#1A6FA8` | Ocean blue indicator for informational notices and limitations banners. |
| `--info-bg` | `#E8F3FB` | Pale blue background paired with info icons and system limitation banners. |

#### 2.3.4 Material Category Colors
Category identifiers used in classification badges, material chips, and the emissions bar chart:
| Token | Hex | Waste Category |
| :--- | :--- | :--- |
| `--mat-metal` | `#6B7380` | Metal (Aluminum, steel, cans) |
| `--mat-organic` | `#5E9B4E` | Organic (Food scraps, peels, garden waste) |
| `--mat-paper` | `#7A8FA6` | Paper & Cardboard (Cartons, newspapers, boxes) |
| `--mat-plastic-low` | `#3E9CB5` | Low-impact plastics |
| `--mat-plastic-mid` | `#2F6FB0` | Standard plastics (PET, packaging, wrappers) |
| `--mat-plastic-high`| `#5B4B9A` | High-impact polymers |
| `--mat-wood` | `#A0703F` | Wood & Timber (Sticks, furniture, pallets) |

#### 2.3.5 Color Application Rules
* **Primary Button:** `--teal` background, `#FFFFFF` text; transitions to `--teal-dark` on hover.
* **Secondary Button:** `--surface` background, `--line-strong` border, `--ink` text; hover transitions to `--teal` border and `--teal-dark` text.
* **Demo / Wallet Button:** `--demo-light` background, transparent border, `--demo-dark` text; hover transitions to `--demo` background with `#FFFFFF` text.
* **Form Field Focus:** `2px solid var(--teal)` with a 2px offset.
* **Invalid Field State:** Border turns to `--alert` with inline error message in `--alert`.
* **Elevated Cards:** `--surface` background, `--line` border; elevated items receive `--shadow-result` or `--shadow-popover`.

---

### 2.4 Typography System

#### 2.4.1 Font Families & Remote Loading
* **`--font-heading`:** `"Bricolage Grotesque", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
  * Applied to: Display titles, H1–H4 headlines, brand mark, large result numbers, and metric values.
  * Loaded from Google Fonts in `<head>` at weights `600` and `700` (`opsz,wght@12..96,600;12..96,700`).
* **`--font-body`:** `"IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
  * Applied to: Body text, navigation links, form controls, button labels, table records, and tooltips.
  * Loaded from Google Fonts in `<head>` at weights `400`, `500`, and `600`.
* **`--font-mono`:** `"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
  * Applied to: Machine-readable data, formula tokens, transaction identifiers.

#### 2.4.2 Type Scale Specification
Root font size is fixed at `16px` (`1rem`):

| Token | Rem Value | Pixel Value | Typical Application |
| :--- | :--- | :--- | :--- |
| `--text-xs` | `0.75rem` | 12px | Metadata, input hints, footnotes, badges, table captions. |
| `--text-sm` | `0.875rem` | 14px | Form labels, button text, secondary copy, navigation links. |
| `--text-base` | `1.00rem` | 16px | Standard body paragraphs, form inputs, table data cells. |
| `--text-md` | `1.125rem` | 18px | Lead paragraphs, card headings, sub-metrics, large labels. |
| `--text-lg` | `1.50rem` | 24px | Subsection titles, card H2s, stat values, modal titles. |
| `--text-xl` | `2.00rem` | 32px | Section-level headings, climate anomaly stats, modal balance figures. |
| `--text-2xl` | `3.00rem` | 48px | Maximum display ceiling for the main H1 headline. |

#### 2.4.3 Fluid Typography & Reading Dynamics
* **Responsive Heading Clamp:**
  * `h1`: `font-size: clamp(2.25rem, 4vw + 1rem, var(--text-2xl));` with tight tracking (`letter-spacing: -0.03em`) and `line-height: 1.25`.
  * `h2`: `font-size: clamp(1.75rem, 2.5vw + 0.5rem, var(--text-xl));` with tracking `-0.015em`.
* **Body Line Height:** Base body text uses `line-height: 1.6` with `max-width: 72ch` to maintain optimal reading cadence.
* **Tabular Digits:** All financial, carbon emission, and point statistics apply `font-variant-numeric: tabular-nums` to guarantee vertical column alignment across dynamic updates.

---

### 2.5 Layout Rhythm, Spacing Scale & Shape

#### 2.5.1 Spacing Scale (8px Base Rhythm)
| Token | Pixel Value | Application |
| :--- | :--- | :--- |
| `--space-1` | 4px | Micro gaps, badge inner padding, border offsets. |
| `--space-2` | 8px | Button vertical padding, form label gaps, icon spacing. |
| `--space-3` | 12px | Form field spacing, table cell padding, card inner margins. |
| `--space-4` | 16px | Container mobile padding, card padding, standard layout gaps. |
| `--space-5` | 20px | Auth card padding, summary card padding, impact icon margins. |
| `--space-6` | 24px | Desktop container padding, modal header padding, section sub-gaps. |
| `--space-8` | 32px | Section header bottom margins, dashboard block spacing. |
| `--space-10` | 40px | Major desktop grid gaps, mission panel inner padding. |
| `--space-12` | 48px | Mobile & tablet section vertical padding (`padding-block`). |
| `--space-16` | 64px | Desktop section vertical spacing (`padding-block`). |
| `--space-20` | 80px | Large desktop section vertical padding. |

#### 2.5.2 Layout Boundaries & Shape Radii
* **Max Content Width:** `--max-content-width: 1120px` (centered horizontally via `margin-inline: auto`).
* **Corner Radii:**
  * `--radius-sm: 8px` (Buttons, form controls, chips, image preview thumbnails).
  * `--radius-lg: 16px` (Cards, auth box, summary cards, dialog modals, mission panel).
  * `border-radius: 999px` (Pills, badges, wallet trigger chips, avatar circles).

---

### 2.6 Elevation, Shadows & Depth

| Token | Value | Applied Elements |
| :--- | :--- | :--- |
| `--shadow-card` | `0 2px 8px -1px rgba(18, 32, 43, 0.06), 0 1px 4px -1px rgba(18, 32, 43, 0.04)` | Subtle lift for hoverable cards and interactive summary blocks. |
| `--shadow-result` | `0 10px 30px -5px rgba(18, 32, 43, 0.08), 0 4px 12px -2px rgba(18, 32, 43, 0.04)` | Pronounced elevation for the primary result card and auth card. |
| `--shadow-popover` | `0 8px 24px -4px rgba(18, 32, 43, 0.12)` | Floating modal dialogs (`#wallet-modal`), floating reward toasts (`#reward-toast`). |

---

### 2.7 Motion, Animations & Transitions

#### 2.7.1 Timing Tokens & Easing Curves
* `--transition-fast: 150ms cubic-bezier(0.16, 1, 0.3, 1)` (Button hovers, link color changes, input focus transitions).
* `--transition-normal: 300ms cubic-bezier(0.16, 1, 0.3, 1)` (Modal open, tab switching, card hover shifts).
* `--transition-marker: 400ms cubic-bezier(0.16, 1, 0.3, 1)` (Emissions chart fill animation, tier progress bar fill).

#### 2.7.2 Keyframe Animations
* **`@keyframes pulse-dot`:** Gentle 2-second scale and opacity loop on the hero live eyebrow dot.
* **`@keyframes pts-pop`:** Spring-loaded scale pop (`cubic-bezier(0.34, 1.56, 0.64, 1)`) when displaying newly earned Eco-Points on the result card.
* **`@keyframes toast-in` / `@keyframes toast-out`:** Bottom-right slide-up and fade transitions for the floating reward notification.
* **`@keyframes modal-slide-in`:** Elegant upward scale translation (`translateY(24px) scale(0.97) -> translateY(0) scale(1)`) for `#wallet-modal`.
* **`@keyframes spin`:** Linear continuous rotation for the analysis button spinner icon.

#### 2.7.3 Accessibility Override (Reduced Motion)
When `prefers-reduced-motion: reduce` is detected:
* All CSS animations are clamped to `0.01ms` duration and `1` iteration.
* `scroll-behavior: smooth` is reverted to `auto`.
* Transition durations are clamped to `0.01ms`, guaranteeing accessibility for users sensitive to vestibular motion.

---

## 3. Main Page Specifications (`index.html`)

### 3.1 Structure & Layout
* **Sticky Navigation Header:** Logo with branded typography, section anchor links (`#about`, `#impact`, `#how-it-works`, `#faq`), and direct jump buttons (`Sign in`, `Get started`) that focus the Auth card.
* **Hero Section (Two-Column Desktop `1.5fr : 1fr`):**
  * **Left Column:** Live pulsing status indicator eyebrow, prominent gradient headline, value proposition copy, primary CTA button (`Create your account`), secondary CTA (`Learn how it works`), and privacy trust badges (`Browser-only`, `Free to use`).
  * **Right Column (Sticky Card):** Tabbed Authentication Card (Sign In / Sign Up) featuring the **Quick Demo Access** button for instant evaluation without typing.
* **Climate Snapshot Ticker:** Three responsive stat cards linking directly to scientific data sources:
  1. *Global Temperature Anomaly:* 1.19°C (NASA Earth Indicators, 1951–1980 baseline).
  2. *Atmospheric CO₂:* 426.07 ppm (NOAA Global Monitoring Laboratory, Mauna Loa).
  3. *Longest Observation Record:* Continuous monitoring since 1958.
* **Educational Modules:**
  * **"What are carbon emissions?"** Side-by-side informational panel explaining greenhouse gases, methane vs. carbon dioxide, and why emissions are unified as $\text{CO}_2\text{e}$.
  * **"Why it matters" Grid:** 4 structured impact cards covering Rising Temperatures, Weather Extremes, Rising Seas, and Ecosystem Health.
  * **"Why waste matters" Breakdown:** Material stories with color-coded chips for Metal, Organic, Paper, Plastic, and Wood.
  * **"How it works" Workflow:** 3 sequential cards detailing account creation, uploading/weighing, and estimate review.
  * **"What you get" Benefits Grid:** 4 checkmarked benefit items with unit clarity and reduction tips.
  * **Mission Panel:** Branded forest teal container with high-contrast text and animated circular $\text{CO}_2\text{e}$ ring.
  * **Accordion FAQ (`<details>/<summary>`):** 7 comprehensive questions covering calculation methodology, accuracy expectations, photo privacy, accepted materials, weight precision, pricing, and terms of use.
* **Footer:** Deep `--ink` background with citation links, privacy terms, and copyright declarations.

---

## 4. Authentication, Sessions & Quick Access

### 4.1 Client-Side Account Simulation (`authService.js`, `authUI.js`)

#### Storage Schema (`cfc_users`):
Stored in `localStorage` as an array of user objects:
```json
{
  "id": "uuid-v4",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "passwordHash": "hex-encoded-sha256",
  "salt": "hex-encoded-salt",
  "createdAt": "2026-10-29T10:00:00.000Z",
  "wallet": {
    "balance": 0,
    "lifetimeEarned": 0,
    "currentStreak": 0,
    "lastActiveDate": null,
    "transactions": []
  }
}
```

#### Session Schema (`cfc_session`):
Stored in `localStorage` for the active session:
```json
{
  "userId": "uuid-v4",
  "name": "Jane Doe",
  "email": "jane@example.com"
}
```

### 4.2 Cryptography & Validation Rules
* **Password Hashing:** Implemented with Web Crypto API (`window.crypto.subtle.digest("SHA-256", salt + password)`).
* **Per-User Salt:** 16 cryptographically random bytes generated via `window.crypto.getRandomValues()`.
* **Field Validation Rules:**
  * *Name:* Required, 2 to 60 characters, trimmed.
  * *Email:* Required, verified with regex `^[^\s@]+@[^\s@]+\.[^\s@]+$`, case-normalized.
  * *Password:* Required, minimum 8 characters, must contain at least one letter and one numeral.
  * *Password Show/Hide Toggle:* Accessible button toggles `type="password"` / `type="text"` with `aria-pressed`.
* **Duplicate Detection:** Prevents duplicate registrations with an inline switch link ("Sign in instead") that auto-fills the entered email into the Sign In tab.
* **Navigation Guards:**
  * `requireAuth()`: Automatically redirects unauthenticated visits on `dashboard.html` to `index.html#account-access`.
  * `redirectIfSignedIn()`: Automatically redirects authenticated visits on `index.html` to `dashboard.html`.
* **Quick Demo Access:**
  * Provided in both Sign In and Sign Up tabs via `#demo-access-signin` and `#demo-access-signup`.
  * Automatically provisions or signs into a seeded `Demo User` (`demo@wasteimpact.app` / `Demo@2026`) and navigates straight to `dashboard.html`.

---

## 5. Waste Analyzer & Emission Calculation

### 5.1 Image Upload & Processing (`upload.js`)
* Supports Drag-and-Drop and native file browsing via hidden `<input type="file">`.
* Accepts `image/jpeg`, `image/png`, and `image/webp` up to 5 MB.
* Generates an in-memory Object URL for immediate local preview (no server transmission).
* Canvas-based client thumbnail generation (maximum 96×96 pixels, JPEG 70% quality) for lightweight storage in history.
* Clear actions: "Replace" and "Remove" options to reset the image state.

### 5.2 Weight Input & Validation (`validators.js`)
* Accepts positive numbers with min `0.01` and step `any`.
* Unit selector: Grams (`g`) and Kilograms (`kg`).
* Automatically converts user input to kilograms for all calculations:
  $$\text{weightKg} = \text{unit} === \text{'g'} \;?\; (\text{weight} / 1000) \;:\; \text{weight}$$
* Hard ceiling safeguard of $500\text{ kg}$ to prevent accidental entry errors.

### 5.3 Classification & Calculation Pipeline (`factors.js`, `analyzeService.js`, `mockAnalyze.js`)
* **Pluggable Architecture:** Managed by `config.js` via `USE_MOCK_CLASSIFICATION` (default: `true`) and `API_ENDPOINT`. When configured, smoothly transitions to external inference without UI alterations.
* **Mock Classifier (`mockAnalyze.js`):**
  * Matches filename substrings to detect categories:
    * `metal`: "metal", "can", "tin", "aluminum", "foil", "iron", "steel"
    * `organic`: "food", "apple", "banana", "bread", "fruit", "peel", "waste", "leaf"
    * `paper`: "paper", "cardboard", "box", "newspaper", "book", "carton"
    * `plastic`: "plastic", "bottle", "wrapper", "bag", "container", "cup"
    * `wood`: "wood", "stick", "board", "timber", "pallet"
  * Fallback: Defaults to `plastic` with a low confidence score ($0.45$).
* **Emission Factor Lookup Table (`factors.js`):**
  * Plastic: $2.40\text{ kg CO}_2\text{e / kg}$
  * Paper: $1.10\text{ kg CO}_2\text{e / kg}$
  * Metal: $1.80\text{ kg CO}_2\text{e / kg}$
  * Organic: $0.70\text{ kg CO}_2\text{e / kg}$
  * Wood: $0.50\text{ kg CO}_2\text{e / kg}$
* **Calculation:** $\text{Emissions (kg CO}_2\text{e)} = \text{weightKg} \times \text{factor}$.

### 5.4 Result Display & Interactive Correction
* **Hero Result Metric:** Prominently formatted to 3 decimal places (`0.000 kg CO₂e`).
* **Formula Transparency:** Explicitly displays the calculation steps: `weight (kg) × factor = total`.
* **Low-Confidence Recalculation:** If confidence $< 70\%$, a prominent warning reveals a dropdown allowing the user to select the correct material. Recalculation runs instantly, updates storage, and awards a correction bonus.
* **Contextual Material Tips:** Displays 2 actionable reduction and recycling recommendations tailored to the identified material.

---

## 6. Eco-Points Reward & User Wallet System

### 6.1 Mathematical Formulation (`rewardService.js`)

Every analysis generates Eco-Points crediting the user's wallet:

$$\text{Points Awarded} = \min\left(200, \text{Base Points (10)} + \lfloor \text{Weight (kg)} \times \text{Multiplier} \rceil + \text{Bonuses}\right)$$

#### 6.1.1 Material Multipliers:
* **Metal:** $30\text{ pts/kg}$ (Reflects ~95% energy savings from aluminum recycling)
* **Plastic:** $25\text{ pts/kg}$ (Incentivizes diverting non-biodegradable polymers)
* **Paper:** $15\text{ pts/kg}$ (Encourages recyclable pulp recovery)
* **Organic:** $12\text{ pts/kg}$ (Diverts biomass from methane-generating landfill decay)
* **Wood:** $10\text{ pts/kg}$ (Encourages biomass reuse)

#### 6.1.2 Bonus Modifiers:
* **First Activity of the Day (Streak Bonus):** $+15\text{ pts}$ (awarded once per calendar day).
* **High-Confidence Classification ($\ge 75\%$):** $+5\text{ pts}$ (rewards clean, unambiguous photos).
* **Material Correction Bonus:** $+5\text{ pts}$ (rewards human verification of low-confidence estimates).

#### 6.1.3 Safeguards:
* **Single-Item Cap:** Points are capped at $200\text{ pts}$ per transaction to prevent runaway rewards from weight input typos.

### 6.2 Tier Milestone Progression
Progression is based on **lifetime earned points** (unaffected by potential future redemptions):

| Tier Level | Name | Icon | Minimum Lifetime Points |
| :---: | :--- | :---: | :---: |
| 1 | **Eco Explorer** | 🌱 | 0 pts |
| 2 | **Green Guardian** | 🌿 | 150 pts |
| 3 | **Carbon Crusader** | 🌳 | 400 pts |
| 4 | **Zero Waste Hero** | 🏆 | 800 pts |

### 6.3 Wallet Architecture & Ledger Management (`walletService.js`)
* **Encapsulation:** The user's wallet lives directly on their account in `cfc_users`.
* **Consecutive Day Streak:** Evaluates `lastActiveDate`. If yesterday, `currentStreak++`; if today, unchanged; if older than yesterday, resets to `1`.
* **Rolling Transaction Ledger:** Records up to the 50 most recent transactions with timestamp, unique ID, points, material, weight, description, and formula breakdown.

### 6.4 Dashboard Gamification UI Components
1. **Header Wallet Pill:** Live interactive chip displaying balance (`🪙 185 pts`) and day streak (`🔥 3`). Clicking opens the wallet modal.
2. **4th Dashboard Summary Card:** Prominent clickable card displaying current Eco-Points balance and tier badge.
3. **Interactive Wallet Modal (`#wallet-modal`):**
   * Accessible dialog containing:
     * Balance strip (Current points, lifetime points, active streak days).
     * Animated tier progress bar with percentage indicator toward next milestone.
     * 4-card tier roadmap indicating unlocked status.
     * Chronological transaction ledger with descriptive event icons.
   * Fully keyboard-navigable (closes on `Escape`, traps focus).
4. **Floating Reward Toast (`#reward-toast`):** Animated bottom-right pop-up confirming points credited with custom streak messaging.
5. **History Table Points Column:** Inline badge display for each entry showing points earned (`+pts`).

---

## 7. Analysis History, Visualizations & Data Safety

### 7.1 History Table & Summary Statistics (`storageService.js`)
* **Storage Key:** User-isolated under `cfc_results_{userId}` in `localStorage`.
* **Summary Metrics:**
  * Total estimated emissions ($\sum \text{kg CO}_2\text{e}$).
  * Total items analyzed count.
  * Most common material identified.
  * Active Eco-Points balance.
* **History Table Columns:** Date, Item Thumbnail + Name, Material Badge, Weight, Estimated CO₂e, Points Earned, and Delete action.
* **Material Filter:** Dynamic dropdown filter (`All`, `Plastic`, `Paper`, `Metal`, `Organic`, `Wood`) updating the table in real time.
* **Deletion Lifecycle:** Deleting an entry updates the live table, recalculates the summary cards, adjusts the chart, and clears the active result card if the deleted item was currently displayed.

### 7.2 Emission Distribution Chart
* Dynamic CSS-based bar chart rendering emission totals per material.
* Each bar's width is proportionally scaled to the highest contributing category:
  $$\text{width} = \left(\frac{\text{materialTotal}}{\max(\text{allMaterialTotals})}\right) \times 100\%$$
* Colors correspond directly to material category tokens (`--mat-metal`, `--mat-plastic-mid`, etc.).

### 7.3 Storage Quota Protection
* Catches browser `DOMException` (`QuotaExceededError` / `NS_ERROR_DOM_QUOTA_REACHED`).
* If quota is exceeded, automatically drops the base64 thumbnail string and re-attempts storing the numerical/textual record.
* Displays a user-facing warning if storage is full without breaking core calculation functionality.

---

## 8. Accessibility & Technical Quality Standards

* **Keyboard Navigation:**
  * Skip-to-main-content link (`.skip-link`) at page top.
  * Full tablist ARIA implementation on the Auth card (`role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, Arrow key navigation).
  * Modal focus management (`role="dialog"`, `aria-modal="true"`, focus trapped inside `[data-modal-inner]`, `Escape` key close).
  * Summary wallet card operates with keyboard `Enter` and `Space`.
* **Screen Reader Support:**
  * Screen-reader-only labels (`.sr-only`) on icon-only buttons and table captions.
  * Live status announcements (`aria-live="polite"`, `role="alert"`, `role="status"`) for field errors, calculation results, and save statuses.
* **Responsive Breakpoints:**
  * Mobile ($< 640\text{px}$): Single-column hero, card-based history view, compact header.
  * Tablet ($640\text{px} - 1023\text{px}$): 2-column grid cards, scrollable table.
  * Desktop ($\ge 1024\text{px}$): 2-column sticky hero, 4-column summary metric cards, side-by-side analyzer and result layout.

---

## 9. File Structure Summary

```
Carbon-emission-Calculator/
├── IMPLEMENTATION-PLAN.md                       <-- Combined Master Plan (This Document)
├── reward_system_calculation.md                 <-- Reward Engine Deep-Dive & Checklist
├── frontend/
│   ├── index.html                               <-- Main landing page & Auth Card
│   ├── dashboard.html                           <-- Personal Analyzer & Wallet Dashboard
│   ├── assets/
│   │   └── logo.svg                             <-- Vector branding
│   ├── css/
│   │   ├── tokens.css                           <-- Design tokens (colors, typography, spacing)
│   │   ├── base.css                             <-- Reset, typography, skip link
│   │   ├── components.css                       <-- Buttons, cards, modals, toast, wallet pills
│   │   └── sections.css                         <-- Section-specific layouts & responsive grids
│   └── js/
│       ├── config.js                            <-- Configurable endpoints & constants
│       ├── validators.js                        <-- Input validation & normalization
│       ├── factors.js                           <-- Material constants & emission calculation
│       ├── rewardService.js                     <-- Reward math, tiers & bonuses
│       ├── walletService.js                     <-- Wallet balance, streak & ledger management
│       ├── authService.js                       <-- Client-side user auth & Web Crypto hashing
│       ├── authUI.js                            <-- Form event handling & demo login trigger
│       ├── upload.js                            <-- Image drag-drop & canvas thumbnailing
│       ├── analyzeService.js                    <-- Classification orchestrator (mock/API)
│       ├── mockAnalyze.js                       <-- Simulated filename classifier
│       ├── storageService.js                    <-- History persistence & summary statistics
│       ├── ui.js                                <-- Generic UI notices & busy states
│       ├── main.js                              <-- Main page bootstrap
│       └── dashboard.js                         <-- Dashboard bootstrap & wallet wiring
```

---

## 10. Verification & Quality Checklist

- [x] All interactions, calculations, and state persistence operate **strictly on the frontend**.
- [x] Quick Demo Access seamlessly logs into the dashboard without typing credentials.
- [x] Eco-Points properly calculate based on weight and material multipliers.
- [x] Daily streak and first-activity bonuses calculate accurately.
- [x] Wallet modal displays correct balance, lifetime total, tier progress, and transaction ledger.
- [x] Summary card 4th metric is interactive and accessible via keyboard (`Enter`/`Space`) and mouse click.
- [x] Responsive layout scales across mobile (single-column), tablet (2-column), and desktop (4-column grid).
- [x] Client-side image previews and canvas thumbnails respect browser storage limitations.
- [x] Human-in-the-loop material corrections recalculate emissions and award accuracy bonus points.
