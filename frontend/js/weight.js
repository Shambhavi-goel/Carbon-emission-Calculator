/**
 * Weight Input Controller
 * Handles normalization, unit toggles, live kg preview, validation, and quick fills.
 */

import { convertToKg, normalizeDecimal, storage } from "./utils.js";
import { WEIGHT_MIN_KG, WEIGHT_MAX_KG } from "./config.js";

const STORAGE_UNIT_KEY = "cf_preferred_unit";

export class WeightController {
  constructor({
    inputEl,
    unitRadios,
    convertedPreviewEl,
    errorEl,
    chipButtons,
    helpTriggerEl,
    helpPopoverEl,
    onChange
  }) {
    this.inputEl = inputEl;
    this.unitRadios = unitRadios;
    this.convertedPreviewEl = convertedPreviewEl;
    this.errorEl = errorEl;
    this.chipButtons = chipButtons;
    this.helpTriggerEl = helpTriggerEl;
    this.helpPopoverEl = helpPopoverEl;
    this.onChange = onChange;

    this.currentUnit = storage.get(STORAGE_UNIT_KEY, "g");
    this.isValid = false;
    this.weightKg = 0;

    this.init();
  }

  init() {
    // Restore preferred unit
    this.setUnit(this.currentUnit, false);

    // Event listeners
    this.inputEl.addEventListener("input", () => this.handleInput());
    this.inputEl.addEventListener("blur", () => this.validate(true));

    this.unitRadios.forEach(radio => {
      radio.addEventListener("change", (e) => {
        if (e.target.checked) {
          this.setUnit(e.target.value, true);
        }
      });
    });

    // Quick fill chips
    if (this.chipButtons) {
      this.chipButtons.forEach(chip => {
        chip.addEventListener("click", () => {
          const val = chip.getAttribute("data-weight");
          const unit = chip.getAttribute("data-unit") || "g";
          this.setUnit(unit, true);
          this.inputEl.value = val;
          this.handleInput();
          this.inputEl.focus();
        });
      });
    }

    // Accessible help tooltip / popover
    if (this.helpTriggerEl && this.helpPopoverEl) {
      this.setupHelpPopover();
    }

    // Initial state check
    this.handleInput();
  }

  setupHelpPopover() {
    const togglePopover = (show) => {
      const isVisible = show ?? this.helpPopoverEl.hasAttribute("hidden");
      if (isVisible) {
        this.helpPopoverEl.removeAttribute("hidden");
        this.helpTriggerEl.setAttribute("aria-expanded", "true");
      } else {
        this.helpPopoverEl.setAttribute("hidden", "");
        this.helpTriggerEl.setAttribute("aria-expanded", "false");
      }
    };

    this.helpTriggerEl.addEventListener("click", (e) => {
      e.stopPropagation();
      const isHidden = this.helpPopoverEl.hasAttribute("hidden");
      togglePopover(isHidden);
    });

    document.addEventListener("click", (e) => {
      if (!this.helpPopoverEl.contains(e.target) && e.target !== this.helpTriggerEl) {
        togglePopover(false);
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !this.helpPopoverEl.hasAttribute("hidden")) {
        togglePopover(false);
        this.helpTriggerEl.focus();
      }
    });
  }

  setUnit(unit, triggerChange = true) {
    this.currentUnit = unit;
    storage.set(STORAGE_UNIT_KEY, unit);

    this.unitRadios.forEach(radio => {
      radio.checked = radio.value === unit;
    });

    if (triggerChange) {
      this.handleInput();
    }
  }

  handleInput() {
    const rawVal = this.inputEl.value;
    const normalized = normalizeDecimal(rawVal);
    
    // Live preview
    if (normalized && !isNaN(Number(normalized)) && Number(normalized) > 0) {
      const kg = convertToKg(Number(normalized), this.currentUnit);
      this.convertedPreviewEl.textContent = `= ${kg.toFixed(3)} kg`;
    } else {
      this.convertedPreviewEl.textContent = "= 0.000 kg";
    }

    // Run passive validation (clears error as soon as valid)
    this.validate(false);

    if (this.onChange) {
      this.onChange({
        isValid: this.isValid,
        weight: Number(normalized),
        unit: this.currentUnit,
        weightKg: this.weightKg
      });
    }
  }

  validate(showErrors = true) {
    const rawVal = this.inputEl.value.trim();
    const normalized = normalizeDecimal(rawVal);

    if (!rawVal) {
      this.isValid = false;
      this.weightKg = 0;
      if (showErrors) {
        this.setError("Enter a weight greater than 0.");
      } else {
        this.clearError();
      }
      return false;
    }

    const num = Number(normalized);
    if (isNaN(num)) {
      this.isValid = false;
      this.weightKg = 0;
      if (showErrors) {
        this.setError("Use numbers only.");
      }
      return false;
    }

    if (num <= 0) {
      this.isValid = false;
      this.weightKg = 0;
      if (showErrors) {
        this.setError("Enter a weight greater than 0.");
      }
      return false;
    }

    const kg = convertToKg(num, this.currentUnit);
    if (kg < WEIGHT_MIN_KG || kg > WEIGHT_MAX_KG) {
      this.isValid = false;
      this.weightKg = 0;
      if (showErrors) {
        this.setError("Weight must be between 1 g and 1000 kg.");
      }
      return false;
    }

    // Valid
    this.isValid = true;
    this.weightKg = kg;
    this.clearError();
    return true;
  }

  setError(msg) {
    this.inputEl.classList.add("is-invalid");
    this.inputEl.setAttribute("aria-invalid", "true");
    this.errorEl.textContent = msg;
  }

  clearError() {
    this.inputEl.classList.remove("is-invalid");
    this.inputEl.removeAttribute("aria-invalid");
    this.errorEl.textContent = "";
  }

  getValue() {
    const normalized = normalizeDecimal(this.inputEl.value);
    return {
      weight: Number(normalized),
      unit: this.currentUnit,
      weightKg: this.weightKg,
      isValid: this.isValid
    };
  }
}
