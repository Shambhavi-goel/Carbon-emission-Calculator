// In local development (e.g. running frontend via http.server on port 5500), target the FastAPI backend at port 8000.
// In production (e.g. Vercel), leave empty to use relative paths (/api/analyze).
export const API_BASE_URL =
  typeof window !== "undefined" &&
  !window.location.hostname.endsWith("vercel.app") &&
  window.location.port !== "8000"
    ? "http://127.0.0.1:8000"
    : "";
export const USE_MOCK = false;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_WEIGHT_KG = 1000;
export const LOW_CONFIDENCE_THRESHOLD = 0.7;
export const ANALYSIS_TIMEOUT_MS = 30_000;
