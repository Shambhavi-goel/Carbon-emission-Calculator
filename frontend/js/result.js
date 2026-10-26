/**
 * Result Card & Range Bar Renderer
 * Renders the calculated emission metrics, range bar visualization,
 * confidence alerts, plastic disambiguation, overrides, and history integration.
 */

import { CLASS_DISPLAY_NAMES, CLASS_COLORS, CONF_HIGH, CONF_LOW } from "./config.js";
import { formatFootprint, formatSigDigits, formatPercent, escapeHtml } from "./utils.js";
import { EMISSION_FACTORS } from "./mock-data.js";
import { getSubclasses, calculate } from "./api.js";

export class ResultController {
  constructor({
    containerEl,
    liveAnnouncerEl,
    onAddToHistory
  }) {
    this.containerEl = containerEl;
    this.liveAnnouncerEl = liveAnnouncerEl;
    this.onAddToHistory = onAddToHistory;

    this.currentData = null;
    this.currentWeight = 0;
    this.currentUnit = "g";
    this.currentWeightKg = 0;
    this.currentThumb = null;
    this.isUserCorrected = false;
    this.isAddedToHistory = false;
    this.subclassesMap = {};
    this.selectedSubclass = null;
  }

  showEmpty() {
    this.containerEl.innerHTML = `
      <div class="result-empty-state">
        <svg class="result-empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p>Your result will appear here after you calculate.</p>
      </div>
    `;
    this.currentData = null;
  }

  showSkeleton() {
    this.containerEl.innerHTML = `
      <div class="card card-result" aria-busy="true">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-text" style="width: 50%;"></div>
        <div class="skeleton skeleton-number"></div>
        <div class="skeleton skeleton-box"></div>
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text" style="width: 70%;"></div>
      </div>
    `;
  }

  showError(message, retryCallback = null) {
    this.containerEl.innerHTML = `
      <div class="card card-result">
        <div class="alert-banner alert-banner-danger" role="alert">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <strong>Calculation Error</strong>
            <p style="margin-top: 4px;">${escapeHtml(message)}</p>
          </div>
        </div>
        ${retryCallback ? `<button type="button" class="btn btn-secondary btn-sm" id="btn-result-retry">Retry calculation</button>` : ""}
      </div>
    `;

    if (retryCallback) {
      const retryBtn = this.containerEl.querySelector("#btn-result-retry");
      if (retryBtn) retryBtn.addEventListener("click", retryCallback);
    }
  }

  async renderResult({
    predictionData,
    weight,
    unit,
    weightKg,
    thumbnailUrl,
    userCorrected = false
  }) {
    this.currentData = predictionData;
    this.currentWeight = weight;
    this.currentUnit = unit;
    this.currentWeightKg = weightKg;
    this.currentThumb = thumbnailUrl;
    this.isUserCorrected = userCorrected;
    this.isAddedToHistory = false;
    this.selectedSubclass = null;

    // Load available subclasses
    try {
      this.subclassesMap = await getSubclasses(predictionData.class);
    } catch {
      this.subclassesMap = {};
    }

    this.render();

    // Move focus to result heading & announce
    const heading = this.containerEl.querySelector("#result-heading");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus();
    }

    if (this.liveAnnouncerEl) {
      const matName = CLASS_DISPLAY_NAMES[predictionData.class] || predictionData.class;
      const footStr = formatFootprint(predictionData.footprint_kg_co2e);
      this.liveAnnouncerEl.textContent = `Calculation complete. Identified material: ${matName}. Carbon footprint: ${footStr}.`;
    }
  }

  render() {
    const data = this.currentData;
    if (!data) return;

    const cls = data.class;
    const displayName = CLASS_DISPLAY_NAMES[cls] || cls;
    const factorInfo = EMISSION_FACTORS[cls] || { avg: data.emission_factor, min: data.range_kg_co2e[0] / this.currentWeightKg, max: data.range_kg_co2e[1] / this.currentWeightKg };
    const conf = data.confidence;
    
    // Check plastic confusion edge-case
    const isPlasticDisambiguation = this.detectPlasticConfusion(data.top3);

    // Confidence tiers
    const isLowConf = conf < CONF_LOW && !this.isUserCorrected;
    const isMidConf = conf >= CONF_LOW && conf < CONF_HIGH;

    let confStatusClass = "";
    if (conf < CONF_LOW) confStatusClass = "alert";
    else if (conf < CONF_HIGH) confStatusClass = "warning";

    const formattedFootprint = formatFootprint(data.footprint_kg_co2e);
    const minFootprint = formatFootprint(data.range_kg_co2e[0]);
    const maxFootprint = formatFootprint(data.range_kg_co2e[1]);

    const html = `
      <div class="card card-result" id="result-card-inner">
        <!-- 1. Header: Material Tag & Status -->
        <div class="result-header-row">
          <div class="material-tag">
            <span class="material-dot mat-${cls}"></span>
            <span id="result-heading" style="font-weight: 700;">${escapeHtml(displayName)}</span>
            ${this.isUserCorrected ? `<span class="badge badge-corrected">User-corrected</span>` : ""}
          </div>
          <div style="font-size: var(--text-xs); color: var(--muted);">
            Confidence: <strong class="num">${formatPercent(conf)}</strong>
          </div>
        </div>

        <!-- 2. Confidence meter -->
        <div class="confidence-container" aria-label="Confidence score: ${formatPercent(conf)}">
          <div class="confidence-track">
            <div class="confidence-fill ${confStatusClass}" style="width: ${Math.round(conf * 100)}%;"></div>
          </div>
        </div>

        <!-- Low Confidence Alert Banner -->
        ${isLowConf ? `
          <div class="alert-banner alert-banner-danger" role="alert">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <strong>Low identification confidence (${formatPercent(conf)})</strong>
              <p>The model is uncertain. Confirm this material or choose the correct one below before viewing the carbon footprint.</p>
              <div style="margin-top: 8px;">
                <button type="button" class="btn btn-secondary btn-sm" id="btn-confirm-lowconf">Confirm as ${escapeHtml(displayName)}</button>
              </div>
            </div>
          </div>
        ` : ""}

        <!-- Mid Confidence Amber Banner -->
        ${isMidConf && !this.isUserCorrected ? `
          <div class="alert-banner alert-banner-warning">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Please check this material. The model has moderate confidence (${formatPercent(conf)}). Verify the top predictions below.</span>
          </div>
        ` : ""}

        <!-- Plastic Disambiguation Side-by-Side (Section 6.7) -->
        ${isPlasticDisambiguation ? this.renderPlasticChoiceHtml(data.top3) : ""}

        <!-- 3 & 4. Footprint & Intensity (Hidden if low confidence until confirmed) -->
        ${!isLowConf ? `
          <div class="result-big-footprint">
            <div style="font-size: var(--text-xs); color: var(--muted); text-transform: uppercase; font-weight: 600;">
              ${this.selectedSubclass ? "Refined Carbon Footprint" : "Estimated Carbon Footprint"}
            </div>
            <div class="footprint-lead-number">
              ${escapeHtml(formattedFootprint)}
            </div>
            <div class="footprint-range-text">
              Range ${escapeHtml(minFootprint)} to ${escapeHtml(maxFootprint)}
            </div>
          </div>

          <div style="font-size: var(--text-sm); color: var(--muted);">
            Intensity: <strong class="num" style="color: var(--ink);">${formatSigDigits(data.emission_factor)} kg CO₂e per kg</strong>
            (range ${formatSigDigits(factorInfo.min)} to ${formatSigDigits(factorInfo.max)})
          </div>

          <!-- 5. The Range Bar (Signature Component) -->
          ${this.renderRangeBarHtml(data, factorInfo)}
        ` : ""}

        <!-- 6. Top 3 Predictions -->
        <div class="top3-section">
          <div class="top3-title">Top 3 predictions</div>
          <ul class="top3-list">
            ${data.top3.map(([predCls, predConf]) => `
              <li class="top3-item">
                <div class="top3-item-left">
                  <span class="material-dot mat-${predCls}"></span>
                  <span>${escapeHtml(CLASS_DISPLAY_NAMES[predCls] || predCls)}</span>
                </div>
                <span class="num" style="font-weight: 600;">${formatPercent(predConf)}</span>
              </li>
            `).join("")}
          </ul>
        </div>

        <!-- 7 & 8. Change Class & Refine Dropdowns -->
        <div class="result-controls-grid">
          <div>
            <label for="select-change-class" style="font-size: var(--text-xs); font-weight: 600; color: var(--muted); display: block; margin-bottom: 4px;">
              Change class
            </label>
            <select id="select-change-class" class="form-control" style="font-size: var(--text-sm); min-height: 38px;">
              ${Object.keys(EMISSION_FACTORS).map(c => `
                <option value="${c}" ${c === cls ? "selected" : ""}>${escapeHtml(CLASS_DISPLAY_NAMES[c])}</option>
              `).join("")}
            </select>
          </div>

          <div id="subclass-wrapper" style="${Object.keys(this.subclassesMap).length > 0 ? "" : "display: none;"}">
            <label for="select-refine-subclass" style="font-size: var(--text-xs); font-weight: 600; color: var(--muted); display: block; margin-bottom: 4px;">
              Refine (optional)
            </label>
            <select id="select-refine-subclass" class="form-control" style="font-size: var(--text-sm); min-height: 38px;">
              <option value="">Standard average (${formatSigDigits(factorInfo.avg)} kg)</option>
              ${Object.keys(this.subclassesMap).map(sub => `
                <option value="${sub}" ${sub === this.selectedSubclass ? "selected" : ""}>
                  ${escapeHtml(sub)} (${formatSigDigits(this.subclassesMap[sub])} kg)
                </option>
              `).join("")}
            </select>
          </div>
        </div>

        <!-- 9. Add to History -->
        <div>
          <button type="button" class="btn btn-primary" id="btn-add-history" ${isLowConf || this.isAddedToHistory ? "disabled" : ""}>
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            ${this.isAddedToHistory ? "Added to history" : "Add to history"}
          </button>
        </div>

        <!-- 10. Collapsible "How is this calculated?" -->
        <details class="faq-accordion" style="margin-top: var(--space-2);">
          <summary class="faq-summary" style="font-size: var(--text-sm); padding: 12px 16px;">
            <span>How is this calculated?</span>
            <svg class="faq-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div class="faq-content" style="padding-top: 8px;">
            <p>Calculated using the core environmental intensity formula:</p>
            <div class="formula-math">
              Footprint = Factor × Weight(kg)<br>
              ${data.footprint_kg_co2e.toFixed(4)} kg CO₂e = ${data.emission_factor} × ${this.currentWeightKg.toFixed(4)} kg
            </div>
            <p style="margin-top: 8px; font-size: var(--text-xs); color: var(--muted);">
              Range bounds: [${data.range_kg_co2e[0].toFixed(4)} kg, ${data.range_kg_co2e[1].toFixed(4)} kg CO₂e] based on min/max factors for ${escapeHtml(displayName)}.
            </p>
          </div>
        </details>
      </div>
    `;

    this.containerEl.innerHTML = html;
    this.wireEvents();
  }

  detectPlasticConfusion(top3) {
    if (!top3 || top3.length < 2) return false;
    const [first, second] = top3;
    const plasticClasses = ["plastic_low", "plastic_mid", "plastic_high"];
    
    if (plasticClasses.includes(first[0]) && plasticClasses.includes(second[0])) {
      const gap = Math.abs(first[1] - second[1]);
      return gap < 0.2;
    }
    return false;
  }

  renderPlasticChoiceHtml(top3) {
    const p1 = top3[0][0];
    const p2 = top3[1][0];
    const fp1 = formatFootprint(EMISSION_FACTORS[p1].avg * this.currentWeightKg);
    const fp2 = formatFootprint(EMISSION_FACTORS[p2].avg * this.currentWeightKg);

    return `
      <div class="plastic-choice-container">
        <div class="plastic-choice-title">Plastic Grade Ambiguity: Which one is it?</div>
        <div class="plastic-choice-grid">
          <div class="plastic-choice-card">
            <strong>${escapeHtml(CLASS_DISPLAY_NAMES[p1])}</strong>
            <span style="font-size: var(--text-xs); color: var(--muted);">Est: ${fp1}</span>
            <button type="button" class="btn btn-secondary btn-sm btn-plastic-pick" data-pick="${p1}">
              Select this grade
            </button>
          </div>
          <div class="plastic-choice-card">
            <strong>${escapeHtml(CLASS_DISPLAY_NAMES[p2])}</strong>
            <span style="font-size: var(--text-xs); color: var(--muted);">Est: ${fp2}</span>
            <button type="button" class="btn btn-secondary btn-sm btn-plastic-pick" data-pick="${p2}">
              Select this grade
            </button>
          </div>
        </div>
      </div>
    `;
  }

  renderRangeBarHtml(data, factorInfo) {
    const minFp = data.range_kg_co2e[0];
    const maxFp = data.range_kg_co2e[1];
    const estFp = data.footprint_kg_co2e;

    // Edge case A: Narrow range ((max - min) / avg < 0.05, such as plastic_high)
    const factorVariation = (factorInfo.max - factorInfo.min) / factorInfo.avg;
    if (factorVariation < 0.05) {
      return `
        <div class="range-bar-wrapper">
          <div class="range-bar-header">
            <span>Emission Factor Range</span>
            <span>Tight Tolerance</span>
          </div>
          <div class="narrow-range-notice">
            Narrow range: factors for this material vary very little across grades.
          </div>
        </div>
      `;
    }

    // Calculate marker percentage
    let percentage = 50;
    if (maxFp > minFp) {
      percentage = ((estFp - minFp) / (maxFp - minFp)) * 100;
    }

    // Clamp marker to [0, 100] if factor sits outside
    const clampedPercentage = Math.max(0, Math.min(100, percentage));

    const ariaLabel = `Estimated ${formatFootprint(estFp)}, range ${formatFootprint(minFp)} to ${formatFootprint(maxFp)}`;

    return `
      <div class="range-bar-wrapper">
        <div class="range-bar-header">
          <span>Footprint Range on Scale</span>
          <span>${formatFootprint(estFp)} estimate</span>
        </div>

        <div class="range-bar-component" role="img" aria-label="${escapeHtml(ariaLabel)}">
          <div class="range-track"></div>
          
          <!-- Animated Pin -->
          <div class="range-marker-pin" style="left: ${clampedPercentage}%;"></div>
          
          <!-- Top Tooltip Callout -->
          <div class="range-marker-callout" style="left: ${clampedPercentage}%;">
            ${formatFootprint(estFp)}
          </div>

          <!-- Bottom Factor Indicator -->
          <div class="range-marker-subtext" style="left: ${clampedPercentage}%;">
            factor ${formatSigDigits(data.emission_factor)}
          </div>
        </div>

        <!-- Range Boundaries -->
        <div class="range-labels-row">
          <div class="range-end-label">
            <span class="range-end-val">${formatFootprint(minFp)}</span>
            <span class="range-end-factor">min factor ${formatSigDigits(factorInfo.min)}</span>
          </div>
          <div class="range-end-label right">
            <span class="range-end-val">${formatFootprint(maxFp)}</span>
            <span class="range-end-factor">max factor ${formatSigDigits(factorInfo.max)}</span>
          </div>
        </div>
      </div>
    `;
  }

  wireEvents() {
    // Confirm low confidence
    const confirmBtn = this.containerEl.querySelector("#btn-confirm-lowconf");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", () => {
        this.isUserCorrected = true;
        this.render();
      });
    }

    // Plastic choice buttons
    const plasticPickBtns = this.containerEl.querySelectorAll(".btn-plastic-pick");
    plasticPickBtns.forEach(btn => {
      btn.addEventListener("click", async () => {
        const pickedClass = btn.getAttribute("data-pick");
        await this.handleClassOverride(pickedClass);
      });
    });

    // Change class dropdown
    const changeClassSelect = this.containerEl.querySelector("#select-change-class");
    if (changeClassSelect) {
      changeClassSelect.addEventListener("change", async (e) => {
        const newClass = e.target.value;
        if (newClass !== this.currentData.class) {
          await this.handleClassOverride(newClass);
        }
      });
    }

    // Refine subclass dropdown
    const refineSelect = this.containerEl.querySelector("#select-refine-subclass");
    if (refineSelect) {
      refineSelect.addEventListener("change", async (e) => {
        const sub = e.target.value || null;
        this.selectedSubclass = sub;
        await this.handleSubclassChange(sub);
      });
    }

    // Add to history button
    const addHistoryBtn = this.containerEl.querySelector("#btn-add-history");
    if (addHistoryBtn) {
      addHistoryBtn.addEventListener("click", () => {
        if (this.onAddToHistory && !this.isAddedToHistory) {
          this.isAddedToHistory = true;
          addHistoryBtn.disabled = true;
          addHistoryBtn.textContent = "Added to history";
          this.onAddToHistory({
            class: this.currentData.class,
            subclass: this.selectedSubclass,
            weight: this.currentWeight,
            unit: this.currentUnit,
            weightKg: this.currentWeightKg,
            emissionFactor: this.currentData.emission_factor,
            footprint: this.currentData.footprint_kg_co2e,
            range: this.currentData.range_kg_co2e,
            confidence: this.currentData.confidence,
            userCorrected: this.isUserCorrected,
            thumbnailUrl: this.currentThumb
          });
        }
      });
    }
  }

  async handleClassOverride(newClass) {
    this.isUserCorrected = true;
    try {
      const calcResult = await calculate(newClass, this.currentWeight, this.currentUnit, null);
      this.currentData = {
        ...this.currentData,
        class: newClass,
        emission_factor: calcResult.emission_factor,
        footprint_kg_co2e: calcResult.footprint_kg_co2e,
        range_kg_co2e: calcResult.range_kg_co2e,
        low_confidence: false
      };
      this.subclassesMap = await getSubclasses(newClass);
      this.selectedSubclass = null;
      this.render();
    } catch (e) {
      console.error("[Result] Class override failed:", e);
    }
  }

  async handleSubclassChange(subclass) {
    try {
      const calcResult = await calculate(this.currentData.class, this.currentWeight, this.currentUnit, subclass);
      this.currentData = {
        ...this.currentData,
        emission_factor: calcResult.emission_factor,
        footprint_kg_co2e: calcResult.footprint_kg_co2e,
        range_kg_co2e: calcResult.range_kg_co2e
      };
      this.render();
    } catch (e) {
      console.error("[Result] Subclass refinement failed:", e);
    }
  }
}
