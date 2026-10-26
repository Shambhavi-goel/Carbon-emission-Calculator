# Prompt: Build the Frontend for an AI Waste-Classification Carbon Footprint Calculator



---

## 1. Your role and the goal

You are a senior front-end engineer and UI designer. Build a **complete, professional, production-quality website frontend** for a student/research project called a *Carbon Footprint Calculator using AI-driven waste classification*.

A visitor uploads a photo of a waste item and types its weight. A trained image-classification model (running on a backend that does **not exist yet**) identifies the material. The site then shows the material, the model's confidence, the emission factor, the carbon footprint and a min-max range.

**This task is frontend only.** The backend will be built later. You must build the frontend against a **mock API** with a single config flag to switch to the real backend later, without changing UI code.

Deliver working code, not a description of code.

---

## 2. Tech stack and hard constraints

- **Plain HTML, CSS and vanilla JavaScript (ES modules).** No React, no build step, no npm. It must run by opening `index.html` through VS Code Live Server (port 5500).
- **Chart.js** loaded from a CDN, **pinned to an exact version** (use `https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js`).
- **Fonts:** Google Fonts. Headings: **Bricolage Grotesque** (600/700). Body: **IBM Plex Sans** (400/500/600). Always include fallback stacks.
- **Icons:** inline SVG only (no icon fonts, no emoji as icons).
- **No images from external URLs.** Use inline SVG or local files in `assets/`. Where a sample photo is needed, use a clearly named placeholder file path and tell me what to put there.
- **Persistence:** `localStorage` for the last-used weight unit and the history. Wrap every `localStorage` call in try/catch and work correctly if it is empty or blocked.
- Responsive from **360 px** to wide desktop, mobile-first. Must meet **WCAG AA** contrast and be fully keyboard-operable.
- Code must be commented where logic is non-obvious, and each JS module must have a single clear responsibility.

### Required file structure

```
frontend/
|-- index.html
|-- css/
|   |-- tokens.css        (design tokens)
|   |-- base.css          (reset, typography, layout helpers)
|   |-- components.css    (buttons, inputs, cards, chips, range bar, toasts, tables)
|   `-- sections.css      (hero, calculator, how-it-works, materials, history, about, faq, footer)
|-- js/
|   |-- config.js         (API_BASE_URL, USE_MOCK, thresholds, display names)
|   |-- api.js            (real fetch calls + mock switch)
|   |-- mock-data.js      (factor table, fake predictions, dev switches)
|   |-- upload.js         (drag-drop, preview, validation, client-side resize)
|   |-- weight.js         (parsing, units, validation)
|   |-- result.js         (result card and range bar rendering)
|   |-- history.js        (state, localStorage, totals, CSV export)
|   |-- charts.js         (Chart.js setup and updates)
|   |-- utils.js          (formatting, significant digits, helpers)
|   `-- main.js           (boot and event wiring)
`-- assets/
    |-- logo.svg          (simple generated logo, inline-able)
    `-- sample/           (README listing the sample photos to add)
```

Output every file in full, each in its own code block headed by its path. Do not use "..." or "rest of the code here". Finish with a short list of how to run it and what to replace.

---

## 3. Design direction

### 3.1 Reference website

Use https://www.iitk.ac.in/ckc/carbon-calculator/ as a **reference for the kind of site this should feel like**: an institutional, credible, calculator-focused page that explains what it does and then lets people try it. If I have attached screenshots, study them for layout hierarchy, how the calculator is positioned, and how information is grouped. **Do not copy its branding, logo, text, colors, or code**, and do not use any institution's name or logo other than the ones I provide in section 1. Take structural inspiration only: clear information first, tool prominent, trustworthy tone.

### 3.2 Visual identity

The subject is environmental measurement, so the interface should feel like **a precise instrument**, not a generic green eco-startup. Calm, cool, well-spaced, with numbers as the main characters. Avoid: stock leaf/globe clip-art, gradient washes as decoration, a warm cream + terracotta look, near-black + neon look, identical rounded cards repeated everywhere, and all-caps eyebrow labels above every heading.

**The one memorable element is the range bar** (section 6.6): every result is drawn as a marker on a min-to-max scale. Spend your visual boldness there; keep everything else quiet and disciplined.

### 3.3 Design tokens (put these in `tokens.css`)

| Token | Value | Use |
|---|---|---|
| `--ink` | `#12202B` | Text, headings |
| `--paper` | `#F3F6F5` | Page background |
| `--surface` | `#FFFFFF` | Cards, inputs |
| `--teal` | `#0F5C5C` | Primary buttons, links, focus ring |
| `--teal-dark` | `#0A4444` | Button hover |
| `--signal` | `#E3A21A` | Estimate marker on range bar |
| `--alert` | `#B3402A` | Errors, low-confidence banner |
| `--line` | `#D5DDDA` | Borders, dividers |
| `--muted` | `#5B6B75` | Secondary text |

Material colors (always shown together with a text label, never color alone):

```
metal #6B7380 | organic #5E9B4E | paper #7A8FA6 | plastic_low #3E9CB5
plastic_mid #2F6FB0 | plastic_high #5B4B9A | wood #A0703F
```

- **Type scale (rem):** 0.875 / 1 / 1.125 / 1.5 / 2 / 3. Body line-height 1.6, line length under 75 characters. Use `font-variant-numeric: tabular-nums` on all numeric output.
- **Spacing:** 8 px grid. Section padding 80 px desktop / 48 px mobile. Max content width 1120 px.
- **Shape:** two radii only: 8 px (inputs, buttons) and 16 px (cards). One soft shadow level, used only on the result card.
- **Motion:** only in response to user actions (preview fade-in, result reveal, range-marker slide, 300-400 ms). No scroll-triggered entrance animations on every section. Respect `prefers-reduced-motion`.
- **Copy style:** sentence case, plain verbs, no filler. Buttons say exactly what they do. Errors say what went wrong and what to do; they do not apologise.

---

## 4. Project facts the UI must use

### 4.1 Classes (the model's output labels; these exact strings come from the backend)

`metal`, `organic`, `paper`, `plastic_high`, `plastic_low`, `plastic_mid`, `wood`

Display names (put in `config.js`):

| Key | Display name |
|---|---|
| metal | Metal |
| organic | Organic waste |
| paper | Paper |
| plastic_low | Plastic (low-emission grade) |
| plastic_mid | Plastic (medium-emission grade) |
| plastic_high | Plastic (high-emission grade) |
| wood | Wood |

### 4.2 Emission factors (kg CO2e per kg of material). Use these in the mock and the Materials table.

| Class | avg | min | max |
|---|---|---|---|
| metal | 2.365 | 0.93 | 3.80 |
| organic | 0.28 | 0.24 | 0.32 |
| paper | 1.495 | 0.49 | 2.50 |
| plastic_low | 1.695 | 1.31 | 2.08 |
| plastic_mid | 3.58 | 3.29 | 3.87 |
| plastic_high | 5.68 | 5.66 | 5.70 |
| wood | 0.377915 | 0.263 | 0.49283 |

### 4.3 Model and data facts (for the About section)

- Model: EfficientNetB0, ImageNet transfer learning, two-stage training (frozen feature extraction, then fine-tuning).
- Images: 7 classes, about 20,000 images after cleaning. Split: 13,967 train / 3,054 validation / 2,996 test.
- **94.4% accuracy and 0.944 macro F1 on the held-out test split.** Always word this as "on our held-out test images". **Never** present it as real-world accuracy.

### 4.4 Core formula

`Footprint (kg CO2e) = emission factor (kg CO2e per kg) x weight (kg)`

- Main estimate = `avg x weight_kg`; lower bound = `min x weight_kg`; upper bound = `max x weight_kg`.
- If a subclass is chosen: refined estimate = `subclass_factor x weight_kg` (the range still uses the class min/max).
- Session total = sum of the main estimates in the history; total range = sum of the mins and sum of the maxes.

---

## 5. Page structure (single page, anchor navigation)

**Header (sticky):** logo + project name; links **Calculator**, **How it works**, **Materials**, **History**, **About**; on mobile a menu button with an accessible disclosure menu. Highlight the current section while scrolling.

| # | Section id | Content |
|---|---|---|
| 1 | `#top` Hero | H1 with the tagline, one-sentence description, primary button **Calculate a footprint** (scrolls to calculator), secondary link **How it works**. On the right, a static non-interactive example result showing the range bar with sample numbers, so visitors see the output format immediately. |
| 2 | `#calculator` | The tool (section 6). Directly below the hero. |
| 3 | `#how` How it works | Four steps in a real sequence (numbering is appropriate here): 1) Upload a photo, 2) The model identifies the material, 3) The matching emission factor is looked up, 4) It is multiplied by the weight you enter. Below: a "How is this calculated?" formula block with a worked example (250 g of metal = 0.25 kg x 2.365 = 0.591 kg CO2e). Explain in two sentences why the user enters the weight: a photo cannot reveal mass. |
| 4 | `#materials` Materials | A table of the 7 classes: color tag + display name, average factor, min, max, and unit. A note on units (kg CO2e per kg) and a placeholder line for the data source and system boundary. A small note that range = lowest and highest factors among items of that class. |
| 5 | `#history` History | Running total with range, entries table, three charts, Export CSV, Clear history (section 7). |
| 6 | `#about` About the project | Project goal and motivation, the team and guide, the institution, the model facts from 4.3, and a "Technology" list (EfficientNetB0, TensorFlow/Keras, FastAPI, Chart.js). |
| 7 | `#faq` Limitations and FAQ | Accordion (accessible `<details>` or ARIA disclosure). Items: Why do I need to enter the weight? / What if my photo has mixed waste? / Why is there a range? / Why might plastic grades be confused? / How accurate is it? (use the 94.4% test-split wording) / Are these results exact? (No, they are estimates.) |
| 8 | Footer | Project name, institution, GitHub, contact, one-line disclaimer: "Estimates for awareness and education; not an official carbon audit." |

---

## 6. The calculator (most important section)

### 6.1 Layout

Two columns on desktop (inputs left, result right), stacked on mobile in this order: photo, weight, button, result.

```
+--------------------------------------+-----------------------------------+
| Step 1: Photo                        |  Result                           |
| +----------------------------------+ |  Empty state: "Your result will   |
| |  Drop a photo here or browse     | |  appear here after you calculate" |
| |  [Use camera] (mobile)           | |                                   |
| +----------------------------------+ |  Material: Metal    Confidence 93%|
|   [Try an example]                   |  Intensity: 2.37 kg CO2e per kg   |
|                                      |  Footprint: 0.59 kg CO2e          |
| Step 2: Weight                       |  [min -----|--o------- max]        |
| [ 250 ] [ g | kg | lb ]   = 0.250 kg |  Top 3 predictions                |
|   Quick fills (edit if different)    |  Change class [v]  Refine [v]     |
|                                      |  [Add to history]                 |
| [ Calculate footprint ]              |  How is this calculated? (expand) |
+--------------------------------------+-----------------------------------+
```

Keep the weight field visually adjacent to the photo so users cannot miss it. The Calculate button is **disabled until a valid image is loaded and a valid weight is entered**, and a short line beneath it states what is missing ("Add a photo and a weight to continue").

### 6.2 Upload (`upload.js`)

- Drag-and-drop zone that is also a keyboard-operable button, plus **Browse** and, on mobile, **Use camera** (`capture="environment"`).
- Accept JPEG, PNG, WebP. If the type is HEIC/HEIF, or the file fails to load in an `<img>`, show: "This format is not supported. Please upload a JPG or PNG." Do not trust the file extension alone: confirm the image actually decodes before enabling Calculate.
- Reject files over 10 MB with a clear message.
- **Resize in the browser** before upload: draw to a canvas with the long side at most 1024 px, re-encode as JPEG quality 0.9, and send that Blob. This keeps requests small and handles EXIF rotation.
- Preview with file name and **Remove** / **Replace** actions. Generate a 64 px thumbnail data URL for the history.
- **Try an example** button loads a bundled sample (`assets/sample/example-1.jpg`; if missing, show a friendly message).

### 6.3 Weight (`weight.js`)

| Rule | Behaviour |
|---|---|
| Required | No calculation without a valid weight |
| Units | Segmented control **g / kg / lb**. Remember the last unit in `localStorage` |
| Decimals | Accept both `.` and `,` (normalise `,` to `.` before parsing) |
| Validation | Must be a number greater than 0. After conversion to kg it must be between **0.001 and 1000** |
| Messages | Under the field, linked with `aria-describedby`, not alerts: "Enter a weight greater than 0." / "Use numbers only." / "Weight must be between 1 g and 1000 kg." Validate on blur and on submit; clear as soon as valid |
| Converted preview | Show "= 0.250 kg" live next to the field so unit mistakes are caught early. Conversions: g / 1000, lb x 0.45359237 |
| Help | An info button with a tooltip/popover: "Weight of the waste item itself, not its contents. Use a kitchen scale, or weigh several items of the same material together and enter the total." The popover must work with keyboard and touch |
| Quick fills | 3-4 small chips (e.g. "Small bottle 25 g", "Drink can 15 g", "A4 sheet 5 g") that put a value in the field. Label the group "Typical values, edit if different". They only fill the field; they are never applied silently |

### 6.4 Request flow and states (`api.js`, `main.js`)

| State | UI |
|---|---|
| Initial | Empty drop zone, disabled button, empty-state text on the right |
| Image only | Preview shown, weight field gently highlighted |
| Valid | Button enabled |
| Loading | Button shows a spinner and "Analysing...", inputs disabled, result column shows a skeleton |
| Success | Result card reveals; **move focus to the result heading**; announce via an `aria-live="polite"` region |
| Low confidence | See 6.7 |
| Network error | In the result column: "Could not reach the server. Check that the backend is running, then try again." + **Retry** |
| Server validation error (400/413/422) | Show the server's `detail` message next to the relevant field |
| Over 15 s | "This is taking longer than usual." + **Cancel** (use `AbortController`) |

### 6.5 Result card (`result.js`), in this order

1. **Material**: display name with its colored tag.
2. **Confidence**: horizontal bar + percentage.
3. **Intensity**: "2.37 kg CO2e per kg (range 0.93 to 3.80)".
4. **Footprint**: the largest text on the card, e.g. "0.59 kg CO2e", with the range beneath: "Range 0.23 to 0.95 kg CO2e".
5. **Range bar** (6.6).
6. **Top 3 predictions** as a compact list with percentages.
7. **Change class** dropdown (all 7 classes). Choosing one recalculates through `calculate()` **without re-running the model**, and flags the entry "user-corrected".
8. **Refine (optional)** dropdown of subclasses loaded from `getSubclasses(class)`. Choosing one swaps the main factor for the subclass factor and relabels the number "Refined estimate". If subclasses fail to load or are empty, hide the dropdown quietly.
9. **Add to history** button (disabled after adding the same result, with "Added" confirmation).
10. Collapsible **How is this calculated?** showing the formula with the user's actual numbers substituted.

Number formatting: show **2-3 significant digits**, never more. If a value would show as 0.00, switch to grams ("12 g CO2e"). Use real unicode subscripts or `CO<sub>2</sub>e` in visible text.

### 6.6 The range bar (signature element)

A horizontal track from the class **min** footprint to the class **max** footprint for the entered weight, with a marker (`--signal`) at the estimate. Label both ends and the marker with kg CO2e values, and the factor values beneath.

```
 0.23 kg                    0.59 kg                     0.95 kg
  |-------------------------[ o ]---------------------------|
 min factor 0.93        estimate 2.37                max factor 3.80
```

- Pure HTML/CSS: marker `left: calc(((est - min) / (max - min)) * 100%)`, animated from 0 on reveal (400 ms ease-out, disabled under reduced motion).
- `role="img"` with an `aria-label` saying the same in words ("Estimated 0.59 kg CO2e, range 0.23 to 0.95").
- **Edge cases:** (a) if `(max - min) / avg < 0.05` (this happens for `plastic_high`), do not draw a bar; show "Narrow range: factors for this material vary very little." (b) If the estimate is outside min-max (a subclass factor or a class average can sit outside), clamp the marker to the nearest end and show the true number in the label.

### 6.7 Confidence behaviour (thresholds in `config.js`: `CONF_HIGH = 0.8`, `CONF_LOW = 0.6`)

| Confidence | Behaviour |
|---|---|
| >= 80% | Normal result |
| 60-80% | Amber note "Please check this material"; top-3 expanded by default |
| < 60% | `--alert` banner; **footprint hidden** until the user confirms the predicted class or picks another from the dropdown |
| Top-2 are two different plastic grades (any two of `plastic_low`, `plastic_mid`, `plastic_high`) with a gap under 0.2 | Show both footprints side by side with "Which one is it?" buttons; the chosen one becomes the result and is flagged user-corrected |

---

## 7. History and charts (`history.js`, `charts.js`)

- Entries store: id, timestamp, thumbnail data URL (64 px), class, subclass (or null), weight as entered + unit, weight in kg, factor used, footprint, min/max footprint, confidence, `userCorrected` flag.
- Table columns: thumbnail, material, weight, intensity, footprint, range, user-corrected badge, delete button.
- **Running total** above the table: sum of footprints with total range and item count.
- Persist to `localStorage` (cap at 100 entries). **Clear history** requires a confirmation.
- Charts (Chart.js, update live when history changes, accessible text summary beneath each):
  1. Footprint by material (doughnut or bar, using material colors, legend with labels).
  2. Footprint per entry over time (line).
  3. Weight by material (bar).
- Empty state: "No items yet. Add your first result from the calculator." with a button that scrolls to it.
- **Export CSV**: client-side Blob download with a header row; values quoted; opens correctly in Excel.

---

## 8. API layer and mock mode

### 8.1 `config.js`

```js
export const USE_MOCK = true;                  // set false once the backend exists
export const API_BASE_URL = "http://localhost:8000";
export const REQUEST_TIMEOUT_MS = 15000;
export const CONF_HIGH = 0.8, CONF_LOW = 0.6;
export const MAX_UPLOAD_MB = 10, RESIZE_MAX_PX = 1024;
export const WEIGHT_MIN_KG = 0.001, WEIGHT_MAX_KG = 1000;
// plus CLASS_DISPLAY_NAMES and CLASS_COLORS from section 3.3 / 4.1
```

### 8.2 Contract the real backend will provide (build to this exactly)

`POST /predict` (multipart form: `file`, `weight`, `unit`) returns:

```json
{
  "class": "metal",
  "confidence": 0.93,
  "top3": [["metal", 0.93], ["plastic_mid", 0.04], ["wood", 0.01]],
  "weight_kg": 0.25,
  "low_confidence": false,
  "emission_factor": 2.365,
  "footprint_kg_co2e": 0.591,
  "range_kg_co2e": [0.2325, 0.95]
}
```

- `POST /calculate` (form: `cls`, `weight`, `unit`, optional `subclass`) returns `emission_factor`, `footprint_kg_co2e`, `range_kg_co2e`.
- `GET /classes` returns `{ "<class>": { "avg": n, "min": n, "max": n } }`.
- `GET /subclasses/{class}` returns `{ "<subclass name>": factor }`.
- `GET /health` returns server and model status.
- Errors: HTTP 400/413/422 with `{ "detail": "message" }`.

Export clean async functions from `api.js`: `predict(blob, weight, unit)`, `calculate(cls, weight, unit, subclass)`, `getClasses()`, `getSubclasses(cls)`, `health()`. All return the shapes above; all throw an `ApiError(status, message)` on failure. Every function must support an `AbortSignal`.

### 8.3 Mock behaviour (`mock-data.js`)

- `predict()` waits about 800 ms, then returns a random class (weighted: 75% chance of confidence 0.85-0.98, 15% chance 0.6-0.8, 10% chance below 0.6), a plausible top-3, and computes footprint and range from the factor table in 4.2 and the weight.
- `calculate()` computes locally. `getSubclasses()` returns 3-4 placeholder subclasses per class with factors between that class's min and max (clearly named as placeholders, since the real names come from the spreadsheet later).
- **Dev switches via URL query**, so every state can be tested: `?mock=lowconf` (confidence 0.45), `?mock=midconf` (0.7), `?mock=plastics` (top-2 are two plastic grades), `?mock=error` (network failure), `?mock=slow` (20 s delay), `?mock=422` (validation error).

---

## 9. Accessibility and quality bar

- Semantic landmarks (`header`, `nav`, `main`, `section`, `footer`), exactly one `h1`, logical heading order, a "Skip to main content" link.
- Every control has a visible label. Focus ring: 2 px `--teal` outline with 2 px offset. Tap targets at least 44 px.
- Color is never the only carrier of meaning (tags always carry text).
- The result is announced through an `aria-live` region; focus moves to the result heading on success.
- `prefers-reduced-motion` disables the marker slide and reveal animation.
- No console errors or warnings. No layout shift when the result appears (reserve space). Print stylesheet is optional.
- Images have `alt` text; decorative SVGs are `aria-hidden="true"`.

---

## 10. Acceptance tests (the build is done only when all pass)

1. 250 g of metal gives **0.591 kg CO2e**, range **0.2325 to 0.95**, displayed to 2-3 significant digits.
2. Weight edge cases behave: `0`, `-5`, `abc`, empty, `1,5`, `1.5`, `0.0001 kg`, `5000 kg`. Each unit converts correctly (500 g = 0.5 kg; 2 lb = 0.907 kg).
3. A non-image file, a HEIC file, an oversized file and a corrupt image are each rejected with a clear message and do not enable Calculate.
4. All `?mock=` switches produce the correct UI state from section 6.4 and 6.7.
5. `plastic_high` shows the "Narrow range" message instead of a bar.
6. Changing the class re-computes without a new predict call; the history entry is flagged user-corrected.
7. History survives a page reload; totals equal a manual sum; deleting and clearing work; the CSV opens in Excel with correct columns.
8. Keyboard-only run-through of the whole flow is possible (upload, weight, calculate, override, add to history, delete).
9. Layout is correct at 360 px, 768 px and 1280 px with no horizontal scrolling.
10. Changing `USE_MOCK` to `false` requires **no other code change** (only that the backend is running with CORS allowing `http://localhost:5500`).

---

## 11. How to respond

1. First, give a **very short design plan**: your color/type choices as applied, the layout idea for the hero, and anything you changed from this prompt and why. Keep it under 150 words.
2. Then output **all files in full**, in the order: `index.html`, CSS files, JS files (`config.js`, `utils.js`, `mock-data.js`, `api.js`, `weight.js`, `upload.js`, `result.js`, `history.js`, `charts.js`, `main.js`), `assets/logo.svg`, `assets/sample/README.md`.
3. End with: (a) how to run it, (b) a list of every placeholder I need to replace, (c) the one thing you would improve next.

Do not ask me questions before building; make reasonable assumptions and state them at the end. Do not skip files, do not abbreviate, and do not invent accuracy numbers, sources or team details beyond what is given above.
