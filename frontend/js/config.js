/**
 * Configuration and Global Constants
 * Switch USE_MOCK to false when connecting to the real backend.
 */

export const USE_MOCK = true;
export const API_BASE_URL = "http://localhost:8000";
export const REQUEST_TIMEOUT_MS = 15000;

// Confidence thresholds
export const CONF_HIGH = 0.8;
export const CONF_LOW = 0.6;

// Image upload and processing constraints
export const MAX_UPLOAD_MB = 10;
export const RESIZE_MAX_PX = 1024;

// Weight validation limits in kilograms
export const WEIGHT_MIN_KG = 0.001;
export const WEIGHT_MAX_KG = 1000.0;

// Model class display names
export const CLASS_DISPLAY_NAMES = {
  metal: "Metal",
  organic: "Organic waste",
  paper: "Paper",
  plastic_low: "Plastic (low-emission grade)",
  plastic_mid: "Plastic (medium-emission grade)",
  plastic_high: "Plastic (high-emission grade)",
  wood: "Wood"
};

// Material colors for indicators and charts
export const CLASS_COLORS = {
  metal: "#6B7380",
  organic: "#5E9B4E",
  paper: "#7A8FA6",
  plastic_low: "#3E9CB5",
  plastic_mid: "#2F6FB0",
  plastic_high: "#5B4B9A",
  wood: "#A0703F"
};
