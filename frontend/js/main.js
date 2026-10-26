/**
 * Main Application Bootstrapper & Event Orchestrator
 * Connects Upload, Weight, Result, History and Charts modules.
 */

import { UploadController } from "./upload.js";
import { WeightController } from "./weight.js";
import { ResultController } from "./result.js";
import { HistoryController } from "./history.js";
import { ChartsController } from "./charts.js";
import { predict, ApiError } from "./api.js";

document.addEventListener("DOMContentLoaded", () => {
  // 1. Navigation & Mobile Drawer
  setupNavigation();

  // 2. DOM element references for Calculator
  const calcBtn = document.getElementById("btn-calculate");
  const calcStatusHint = document.getElementById("calc-status-hint");
  const resultContainer = document.getElementById("result-column-container");
  const liveAnnouncer = document.getElementById("calc-live-announcer");

  let currentAbortController = null;
  let slowTimerId = null;

  // 3. Initialize Result Controller
  const resultCtrl = new ResultController({
    containerEl: resultContainer,
    liveAnnouncerEl: liveAnnouncer,
    onAddToHistory: (historyEntry) => {
      historyCtrl.addItem(historyEntry);
    }
  });
  resultCtrl.showEmpty();

  // 4. Initialize Charts Controller
  const chartsCtrl = new ChartsController({});

  // 5. Initialize History Controller
  const historyCtrl = new HistoryController({
    tableBodyEl: document.getElementById("history-table-body"),
    emptyStateEl: document.getElementById("history-empty-state"),
    totalsBarEl: document.getElementById("history-totals-bar"),
    totalFootprintEl: document.getElementById("history-total-footprint"),
    totalRangeEl: document.getElementById("history-total-range"),
    totalCountEl: document.getElementById("history-total-count"),
    clearBtnEl: document.getElementById("btn-clear-history"),
    exportBtnEl: document.getElementById("btn-export-csv"),
    onHistoryUpdated: (items) => {
      chartsCtrl.update(items);
    }
  });

  // Load existing history into charts on boot
  chartsCtrl.update(historyCtrl.getItems());

  // 6. Initialize Weight Controller
  const weightInput = document.getElementById("input-weight");
  const weightCtrl = new WeightController({
    inputEl: weightInput,
    unitRadios: document.querySelectorAll("input[name='weight-unit']"),
    convertedPreviewEl: document.getElementById("weight-converted-preview"),
    errorEl: document.getElementById("weight-error-msg"),
    chipButtons: document.querySelectorAll(".chip[data-weight]"),
    helpTriggerEl: document.getElementById("btn-weight-help"),
    helpPopoverEl: document.getElementById("popover-weight-help"),
    onChange: () => updateFormState()
  });

  // 7. Initialize Upload Controller
  const uploadCtrl = new UploadController({
    dropzoneEl: document.getElementById("upload-dropzone"),
    fileInputEl: document.getElementById("input-file-browse"),
    cameraInputEl: document.getElementById("input-file-camera"),
    previewContainerEl: document.getElementById("upload-preview-box"),
    previewImgEl: document.getElementById("upload-preview-img"),
    previewNameEl: document.getElementById("upload-preview-name"),
    previewSizeEl: document.getElementById("upload-preview-size"),
    removeBtnEl: document.getElementById("btn-upload-remove"),
    replaceBtnEl: document.getElementById("btn-upload-replace"),
    exampleBtnEl: document.getElementById("btn-try-example"),
    errorEl: document.getElementById("upload-error-msg"),
    onFileSelected: () => {
      // Gently nudge focus / highlight weight if empty
      if (!weightCtrl.getValue().isValid) {
        weightInput.focus();
      }
      updateFormState();
    },
    onFileRemoved: () => {
      updateFormState();
    }
  });

  // Helper to validate and manage Calculate button state
  function updateFormState() {
    const hasImage = uploadCtrl.hasFile();
    const weightVal = weightCtrl.getValue();

    if (hasImage && weightVal.isValid) {
      calcBtn.disabled = false;
      calcStatusHint.textContent = "";
    } else {
      calcBtn.disabled = true;
      if (!hasImage && !weightVal.isValid) {
        calcStatusHint.textContent = "Add a photo and a weight to continue";
      } else if (!hasImage) {
        calcStatusHint.textContent = "Upload a photo to continue";
      } else {
        calcStatusHint.textContent = "Enter a valid weight to continue";
      }
    }
  }

  // 8. Wire Calculate Action
  calcBtn.addEventListener("click", async () => {
    await performCalculation();
  });

  async function performCalculation() {
    const uploadData = uploadCtrl.getData();
    const weightVal = weightCtrl.getValue();

    if (!uploadData.blob || !weightVal.isValid) {
      weightCtrl.validate(true);
      return;
    }

    // Set loading state
    setLoadingState(true);
    resultCtrl.showSkeleton();

    currentAbortController = new AbortController();

    // 15 second slow response indicator
    slowTimerId = setTimeout(() => {
      calcStatusHint.innerHTML = `
        This is taking longer than usual. 
        <button type="button" class="btn-ghost btn-sm" id="btn-cancel-request" style="padding: 2px 6px; text-decoration: underline;">
          Cancel
        </button>
      `;
      const cancelBtn = document.getElementById("btn-cancel-request");
      if (cancelBtn) {
        cancelBtn.addEventListener("click", () => {
          if (currentAbortController) {
            currentAbortController.abort();
          }
        });
      }
    }, 15000);

    try {
      const result = await predict(
        uploadData.blob,
        weightVal.weight,
        weightVal.unit,
        currentAbortController.signal
      );

      clearTimeout(slowTimerId);
      setLoadingState(false);

      await resultCtrl.renderResult({
        predictionData: result,
        weight: weightVal.weight,
        unit: weightVal.unit,
        weightKg: result.weight_kg || weightVal.weightKg,
        thumbnailUrl: uploadData.thumbnailUrl,
        userCorrected: false
      });
    } catch (err) {
      clearTimeout(slowTimerId);
      setLoadingState(false);

      console.error("[App] Calculation failed:", err);

      if (err instanceof ApiError) {
        if (err.status === 400 || err.status === 413 || err.status === 422) {
          uploadCtrl.setError(err.detail || err.message);
          resultCtrl.showError(err.detail || err.message, () => performCalculation());
        } else if (err.status === 408) {
          resultCtrl.showError("The calculation timed out. Please verify your connection and try again.", () => performCalculation());
        } else {
          resultCtrl.showError(
            "Could not reach the server. Check that the backend is running, then try again.",
            () => performCalculation()
          );
        }
      } else {
        resultCtrl.showError(
          "Could not reach the server. Check that the backend is running, then try again.",
          () => performCalculation()
        );
      }
    }
  }

  function setLoadingState(isLoading) {
    if (isLoading) {
      calcBtn.disabled = true;
      calcBtn.innerHTML = `
        <span class="btn-spinner" aria-hidden="true"></span>
        <span>Analysing...</span>
      `;
      weightInput.disabled = true;
      calcStatusHint.textContent = "Processing image classification...";
    } else {
      calcBtn.innerHTML = `
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        <span>Calculate footprint</span>
      `;
      weightInput.disabled = false;
      calcStatusHint.textContent = "";
      updateFormState();
    }
  }

  // 9. Navigation Setup & Scroll Spy
  function setupNavigation() {
    const mobileMenuBtn = document.getElementById("btn-mobile-menu");
    const mobileNavDrawer = document.getElementById("mobile-nav-drawer");
    const navLinks = document.querySelectorAll(".nav-link, .mobile-nav-link");

    if (mobileMenuBtn && mobileNavDrawer) {
      mobileMenuBtn.addEventListener("click", () => {
        const isOpen = mobileNavDrawer.classList.toggle("is-open");
        mobileMenuBtn.setAttribute("aria-expanded", String(isOpen));
      });

      // Close mobile drawer on link click
      navLinks.forEach(link => {
        link.addEventListener("click", () => {
          mobileNavDrawer.classList.remove("is-open");
          mobileMenuBtn.setAttribute("aria-expanded", "false");
        });
      });
    }

    // Scroll spy for active section highlight
    const sections = document.querySelectorAll("section[id], header[id]");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute("id");
          navLinks.forEach(link => {
            const href = link.getAttribute("href");
            if (href === `#${id}`) {
              link.classList.add("active");
              link.setAttribute("aria-current", "page");
            } else {
              link.classList.remove("active");
              link.removeAttribute("aria-current");
            }
          });
        }
      });
    }, {
      rootMargin: "-20% 0px -70% 0px"
    });

    sections.forEach(sec => observer.observe(sec));
  }
});
