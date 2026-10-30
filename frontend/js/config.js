// When deployed on Vercel, leaving API_BASE_URL empty automatically uses the current domain (e.g. /api/analyze)
export const API_BASE_URL = "";
export const USE_MOCK = false;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_WEIGHT_KG = 1000;
export const LOW_CONFIDENCE_THRESHOLD = 0.7;
export const ANALYSIS_TIMEOUT_MS = 30_000;
