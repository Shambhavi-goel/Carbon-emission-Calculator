/**
 * General Utilities & Numerical Formatting
 */

/**
 * Format a number to 2-3 significant figures without trailing zeros.
 * If the value is tiny (< 0.005 kg CO2e), converts and formats in grams.
 * @param {number} valKg - Footprint in kg CO2e
 * @param {boolean} includeUnit - Whether to append the unit
 * @returns {string} Formatted output string
 */
export function formatFootprint(valKg, includeUnit = true) {
  if (valKg === undefined || valKg === null || isNaN(valKg)) return "—";
  
  const num = Number(valKg);
  if (num === 0) return includeUnit ? "0 kg CO₂e" : "0";

  // If smaller than 0.005 kg (5 grams), switch to grams for legibility
  if (num < 0.005) {
    const valG = num * 1000;
    const formattedG = formatSigDigits(valG, 2);
    return includeUnit ? `${formattedG} g CO₂e` : `${formattedG} g`;
  }

  const formattedKg = formatSigDigits(num, 3);
  return includeUnit ? `${formattedKg} kg CO₂e` : formattedKg;
}

/**
 * Format a numeric factor or general float to 2-3 significant digits.
 * @param {number} num 
 * @param {number} precision (default 3)
 * @returns {string}
 */
export function formatSigDigits(num, precision = 3) {
  if (num === undefined || num === null || isNaN(num)) return "—";
  const val = Number(num);
  if (val === 0) return "0";

  // Use toPrecision then parse back to strip trailing scientific notation if standard decimal fits
  const precise = val.toPrecision(precision);
  // Strip unnecessary trailing zeros after decimal point
  if (precise.includes(".")) {
    const trimmed = precise.replace(/\.?0+$/, "");
    return trimmed;
  }
  return precise;
}

/**
 * Format confidence score (0 to 1) into percentage string (e.g. "93%")
 * @param {number} conf 
 * @returns {string}
 */
export function formatPercent(conf) {
  if (conf === undefined || conf === null || isNaN(conf)) return "0%";
  return `${Math.round(conf * 100)}%`;
}

/**
 * Normalise decimal input (converts European comma to standard dot).
 * @param {string|number} raw 
 * @returns {string}
 */
export function normalizeDecimal(raw) {
  if (typeof raw !== "string") return String(raw || "");
  return raw.trim().replace(",", ".");
}

/**
 * Convert weight in specified unit to kilograms.
 * @param {number} weight 
 * @param {"g"|"kg"|"lb"} unit 
 * @returns {number}
 */
export function convertToKg(weight, unit) {
  const val = Number(weight);
  if (isNaN(val) || val <= 0) return 0;
  
  switch (unit) {
    case "g":
      return val / 1000;
    case "lb":
      return val * 0.45359237;
    case "kg":
    default:
      return val;
  }
}

/**
 * Safe localStorage wrapper with try/catch.
 */
export const storage = {
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return defaultValue;
      return JSON.parse(item);
    } catch (e) {
      console.warn(`[Storage] Failed to read ${key}:`, e);
      return defaultValue;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn(`[Storage] Failed to write ${key}:`, e);
      return false;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.warn(`[Storage] Failed to remove ${key}:`, e);
      return false;
    }
  }
};

/**
 * Extract URL query parameters.
 * @param {string} param 
 * @returns {string|null}
 */
export function getQueryParam(param) {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get(param);
  } catch {
    return null;
  }
}

/**
 * HTML escape helper to prevent injection.
 * @param {string} str 
 * @returns {string}
 */
export function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
