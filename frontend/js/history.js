/**
 * History State & Table Management
 * Manages calculations history, running totals, localStorage persistence,
 * deletions, and CSV export.
 */

import { storage, formatFootprint, formatSigDigits, escapeHtml } from "./utils.js";
import { CLASS_DISPLAY_NAMES } from "./config.js";

const STORAGE_HISTORY_KEY = "cf_calculator_history";
const MAX_HISTORY_ITEMS = 100;

export class HistoryController {
  constructor({
    tableBodyEl,
    emptyStateEl,
    totalsBarEl,
    totalFootprintEl,
    totalRangeEl,
    totalCountEl,
    clearBtnEl,
    exportBtnEl,
    onHistoryUpdated
  }) {
    this.tableBodyEl = tableBodyEl;
    this.emptyStateEl = emptyStateEl;
    this.totalsBarEl = totalsBarEl;
    this.totalFootprintEl = totalFootprintEl;
    this.totalRangeEl = totalRangeEl;
    this.totalCountEl = totalCountEl;
    this.clearBtnEl = clearBtnEl;
    this.exportBtnEl = exportBtnEl;
    this.onHistoryUpdated = onHistoryUpdated;

    this.items = [];
    this.init();
  }

  init() {
    this.load();

    if (this.clearBtnEl) {
      this.clearBtnEl.addEventListener("click", () => this.handleClear());
    }

    if (this.exportBtnEl) {
      this.exportBtnEl.addEventListener("click", () => this.exportCsv());
    }

    this.render();
  }

  load() {
    this.items = storage.get(STORAGE_HISTORY_KEY, []);
    if (!Array.isArray(this.items)) {
      this.items = [];
    }
  }

  save() {
    // Cap at 100 items
    if (this.items.length > MAX_HISTORY_ITEMS) {
      this.items = this.items.slice(0, MAX_HISTORY_ITEMS);
    }
    storage.set(STORAGE_HISTORY_KEY, this.items);
  }

  addItem(entry) {
    const item = {
      id: "entry_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      timestamp: new Date().toISOString(),
      thumbnailUrl: entry.thumbnailUrl || null,
      class: entry.class,
      subclass: entry.subclass || null,
      weight: entry.weight,
      unit: entry.unit,
      weightKg: entry.weightKg,
      factor: entry.emissionFactor,
      footprint: entry.footprint,
      rangeMin: entry.range[0],
      rangeMax: entry.range[1],
      confidence: entry.confidence,
      userCorrected: !!entry.userCorrected,
      pointsEarned: Number(entry.pointsEarned) || 20
    };

    // Prepend item
    this.items.unshift(item);
    this.save();
    this.render();

    if (this.onHistoryUpdated) {
      this.onHistoryUpdated(this.items);
    }
  }

  deleteItem(id) {
    this.items = this.items.filter(item => item.id !== id);
    this.save();
    this.render();

    if (this.onHistoryUpdated) {
      this.onHistoryUpdated(this.items);
    }
  }

  handleClear() {
    if (this.items.length === 0) return;
    const confirmed = window.confirm("Are you sure you want to clear your calculation history?");
    if (confirmed) {
      this.items = [];
      this.save();
      this.render();
      if (this.onHistoryUpdated) {
        this.onHistoryUpdated(this.items);
      }
    }
  }

  render() {
    const hasItems = this.items.length > 0;

    if (!hasItems) {
      if (this.emptyStateEl) this.emptyStateEl.style.display = "block";
      if (this.tableBodyEl) this.tableBodyEl.innerHTML = "";
      if (this.totalsBarEl) this.totalsBarEl.style.display = "none";
      if (this.clearBtnEl) this.clearBtnEl.disabled = true;
      if (this.exportBtnEl) this.exportBtnEl.disabled = true;
      return;
    }

    if (this.emptyStateEl) this.emptyStateEl.style.display = "none";
    if (this.totalsBarEl) this.totalsBarEl.style.display = "grid";
    if (this.clearBtnEl) this.clearBtnEl.disabled = false;
    if (this.exportBtnEl) this.exportBtnEl.disabled = false;

    // Calculate totals
    let sumFootprint = 0;
    let sumMin = 0;
    let sumMax = 0;

    this.items.forEach(item => {
      sumFootprint += Number(item.footprint) || 0;
      sumMin += Number(item.rangeMin) || 0;
      sumMax += Number(item.rangeMax) || 0;
    });

    if (this.totalFootprintEl) {
      this.totalFootprintEl.textContent = formatFootprint(sumFootprint);
    }
    if (this.totalRangeEl) {
      this.totalRangeEl.textContent = `${formatFootprint(sumMin)} – ${formatFootprint(sumMax)}`;
    }
    if (this.totalCountEl) {
      this.totalCountEl.textContent = `${this.items.length} ${this.items.length === 1 ? "item" : "items"}`;
    }

    // Render table rows
    if (this.tableBodyEl) {
      this.tableBodyEl.innerHTML = this.items.map(item => {
        const matName = CLASS_DISPLAY_NAMES[item.class] || item.class;
        const subInfo = item.subclass ? `<br><small style="color: var(--muted);">${escapeHtml(item.subclass)}</small>` : "";
        const badge = item.userCorrected ? `<span class="badge badge-corrected">Corrected</span>` : "";

        return `
          <tr data-id="${item.id}">
            <td style="width: 72px;">
              ${item.thumbnailUrl ? `
                <img src="${item.thumbnailUrl}" alt="${escapeHtml(matName)}" class="preview-thumb" style="width: 48px; height: 48px;" />
              ` : `
                <div style="width: 48px; height: 48px; background: var(--paper); border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: var(--muted);">No img</div>
              `}
            </td>
            <td>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span class="material-dot mat-${item.class}"></span>
                <strong>${escapeHtml(matName)}</strong>
              </div>
              ${subInfo}
            </td>
            <td class="numeric num">
              ${item.weight} ${item.unit}
              <br><small style="color: var(--muted);">= ${item.weightKg.toFixed(3)} kg</small>
            </td>
            <td class="numeric num">${formatSigDigits(item.factor)}</td>
            <td class="numeric num">
              <strong>${formatFootprint(item.footprint)}</strong>
              <div style="font-size: var(--text-xs); color: var(--teal); font-weight: 600;">+${item.pointsEarned || 20} pts</div>
            </td>
            <td class="numeric num" style="color: var(--muted); font-size: var(--text-xs);">
              ${formatFootprint(item.rangeMin)} – ${formatFootprint(item.rangeMax)}
            </td>
            <td style="text-align: center;">${badge}</td>
            <td style="text-align: right;">
              <button type="button" class="btn btn-ghost btn-sm btn-delete-row" aria-label="Delete entry" data-id="${item.id}">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </td>
          </tr>
        `;
      }).join("");

      // Bind delete buttons
      this.tableBodyEl.querySelectorAll(".btn-delete-row").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          this.deleteItem(id);
        });
      });
    }
  }

  exportCsv() {
    if (this.items.length === 0) return;

    const headers = [
      "ID",
      "Timestamp",
      "Material Class",
      "Subclass",
      "Entered Weight",
      "Entered Unit",
      "Weight (kg)",
      "Emission Factor (kg CO2e/kg)",
      "Carbon Footprint (kg CO2e)",
      "Range Min (kg CO2e)",
      "Range Max (kg CO2e)",
      "Green Points Earned",
      "Confidence",
      "User Corrected"
    ];

    const rows = this.items.map(item => [
      item.id,
      item.timestamp,
      CLASS_DISPLAY_NAMES[item.class] || item.class,
      item.subclass || "",
      item.weight,
      item.unit,
      item.weightKg.toFixed(4),
      item.factor,
      item.footprint.toFixed(4),
      item.rangeMin.toFixed(4),
      item.rangeMax.toFixed(4),
      item.pointsEarned || 20,
      (item.confidence * 100).toFixed(1) + "%",
      item.userCorrected ? "Yes" : "No"
    ]);

    // Format CSV with proper quoting
    const escapeCsv = (val) => {
      const str = String(val ?? "");
      return `"${str.replace(/"/g, '""')}"`;
    };

    const csvContent = [
      headers.map(escapeCsv).join(","),
      ...rows.map(row => row.map(escapeCsv).join(","))
    ].join("\r\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `carbon-footprint-history-${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  getItems() {
    return this.items;
  }
}
