/**
 * Chart.js Integration & Updates
 * Renders three analytical charts:
 * 1. Footprint by material (Doughnut)
 * 2. Footprint timeline per entry (Line)
 * 3. Total weight by material (Bar)
 */

import { CLASS_DISPLAY_NAMES, CLASS_COLORS } from "./config.js";
import { formatFootprint, formatSigDigits } from "./utils.js";

export class ChartsController {
  constructor({
    footprintCanvasId = "chart-footprint-material",
    timelineCanvasId = "chart-footprint-timeline",
    weightCanvasId = "chart-weight-material",
    footprintSummaryId = "summary-footprint-material",
    timelineSummaryId = "summary-footprint-timeline",
    weightSummaryId = "summary-weight-material"
  }) {
    this.footprintCanvas = document.getElementById(footprintCanvasId);
    this.timelineCanvas = document.getElementById(timelineCanvasId);
    this.weightCanvas = document.getElementById(weightCanvasId);

    this.footprintSummary = document.getElementById(footprintSummaryId);
    this.timelineSummary = document.getElementById(timelineSummaryId);
    this.weightSummary = document.getElementById(weightSummaryId);

    this.chartFootprint = null;
    this.chartTimeline = null;
    this.chartWeight = null;

    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  update(historyItems) {
    if (!window.Chart) {
      console.warn("[Charts] Chart.js library is not loaded.");
      return;
    }

    if (!historyItems || historyItems.length === 0) {
      this.clear();
      return;
    }

    this.renderFootprintByMaterial(historyItems);
    this.renderTimeline(historyItems);
    this.renderWeightByMaterial(historyItems);
  }

  clear() {
    if (this.chartFootprint) { this.chartFootprint.destroy(); this.chartFootprint = null; }
    if (this.chartTimeline) { this.chartTimeline.destroy(); this.chartTimeline = null; }
    if (this.chartWeight) { this.chartWeight.destroy(); this.chartWeight = null; }

    if (this.footprintSummary) this.footprintSummary.textContent = "No data available to display.";
    if (this.timelineSummary) this.timelineSummary.textContent = "No entries recorded yet.";
    if (this.weightSummary) this.weightSummary.textContent = "No data available to display.";
  }

  renderFootprintByMaterial(items) {
    if (!this.footprintCanvas) return;

    // Aggregate footprint by class
    const totals = {};
    items.forEach(item => {
      totals[item.class] = (totals[item.class] || 0) + Number(item.footprint);
    });

    const labels = Object.keys(totals).map(cls => CLASS_DISPLAY_NAMES[cls] || cls);
    const dataValues = Object.values(totals);
    const bgColors = Object.keys(totals).map(cls => CLASS_COLORS[cls] || "#7A8FA6");

    if (this.chartFootprint) this.chartFootprint.destroy();

    this.chartFootprint = new window.Chart(this.footprintCanvas, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [{
          data: dataValues,
          backgroundColor: bgColors,
          borderWidth: 2,
          borderColor: "#FFFFFF"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: !this.reducedMotion,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              boxWidth: 12,
              padding: 12,
              font: { family: "IBM Plex Sans", size: 12 }
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const val = context.raw || 0;
                return ` ${context.label}: ${formatFootprint(val)}`;
              }
            }
          }
        }
      }
    });

    // Update accessible summary
    if (this.footprintSummary) {
      const highest = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
      const highestName = CLASS_DISPLAY_NAMES[highest[0]];
      this.footprintSummary.textContent = `Emissions distributed across ${labels.length} materials. Highest contributor: ${highestName} (${formatFootprint(highest[1])}).`;
    }
  }

  renderTimeline(items) {
    if (!this.timelineCanvas) return;

    // Timeline in chronological order
    const chronItems = [...items].reverse();
    const labels = chronItems.map((_, idx) => `#${idx + 1}`);
    const dataValues = chronItems.map(item => Number(item.footprint));

    if (this.chartTimeline) this.chartTimeline.destroy();

    this.chartTimeline = new window.Chart(this.timelineCanvas, {
      type: "line",
      data: {
        labels: labels,
        datasets: [{
          label: "Carbon Footprint (kg CO₂e)",
          data: dataValues,
          borderColor: "#0F5C5C",
          backgroundColor: "rgba(15, 92, 92, 0.08)",
          fill: true,
          tension: 0.2,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: "#0F5C5C"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: !this.reducedMotion,
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { family: "IBM Plex Sans", size: 11 } }
          },
          y: {
            beginAtZero: true,
            ticks: {
              font: { family: "IBM Plex Sans", size: 11 },
              callback: (val) => `${val} kg`
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` Footprint: ${formatFootprint(ctx.raw)}`
            }
          }
        }
      }
    });

    if (this.timelineSummary) {
      this.timelineSummary.textContent = `Shows sequential carbon footprints for all ${chronItems.length} logged items in order of calculation.`;
    }
  }

  renderWeightByMaterial(items) {
    if (!this.weightCanvas) return;

    // Aggregate weight by class
    const totals = {};
    items.forEach(item => {
      totals[item.class] = (totals[item.class] || 0) + Number(item.weightKg);
    });

    const labels = Object.keys(totals).map(cls => CLASS_DISPLAY_NAMES[cls] || cls);
    const dataValues = Object.values(totals);
    const bgColors = Object.keys(totals).map(cls => CLASS_COLORS[cls] || "#7A8FA6");

    if (this.chartWeight) this.chartWeight.destroy();

    this.chartWeight = new window.Chart(this.weightCanvas, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: "Weight (kg)",
          data: dataValues,
          backgroundColor: bgColors,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: !this.reducedMotion,
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { family: "IBM Plex Sans", size: 11 } }
          },
          y: {
            beginAtZero: true,
            ticks: {
              font: { family: "IBM Plex Sans", size: 11 },
              callback: (val) => `${val} kg`
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` Weight: ${formatSigDigits(ctx.raw)} kg`
            }
          }
        }
      }
    });

    if (this.weightSummary) {
      const totalWeightKg = Object.values(totals).reduce((a, b) => a + b, 0);
      this.weightSummary.textContent = `Total weight across all materials: ${formatSigDigits(totalWeightKg)} kg.`;
    }
  }
}
