/**
 * API Client Layer
 * Encapsulates backend communication and mock fallback.
 */

import { USE_MOCK, API_BASE_URL, REQUEST_TIMEOUT_MS } from "./config.js";
import { mockPredict, mockCalculate, EMISSION_FACTORS, SUBCLASSES } from "./mock-data.js";

/**
 * Custom API Error containing HTTP status and server error detail.
 */
export class ApiError extends Error {
  constructor(status, message, detail = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

/**
 * Wrapper to fetch with a timeout via AbortController.
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const parentSignal = options.signal;

  if (parentSignal) {
    parentSignal.addEventListener("abort", () => controller.abort());
  }

  const timeoutId = setTimeout(() => {
    controller.abort(new DOMException("Request timed out", "TimeoutError"));
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Perform waste classification and carbon footprint prediction.
 * @param {Blob} blob - Compressed JPEG image blob
 * @param {number|string} weight - Entered weight
 * @param {string} unit - Weight unit ("g"|"kg"|"lb")
 * @param {AbortSignal} [signal]
 */
export async function predict(blob, weight, unit, signal) {
  if (USE_MOCK) {
    return mockPredict(blob, weight, unit, signal);
  }

  const formData = new FormData();
  formData.append("file", blob, "upload.jpg");
  formData.append("weight", String(weight));
  formData.append("unit", unit);

  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/predict`, {
      method: "POST",
      body: formData,
      signal
    });

    if (!res.ok) {
      let detail = null;
      try {
        const errorJson = await res.json();
        detail = errorJson.detail;
      } catch {}
      throw new ApiError(res.status, `Server returned ${res.status}`, detail);
    }

    return await res.json();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err.name === "AbortError") {
      throw new ApiError(408, "The request was cancelled or timed out.");
    }
    throw new ApiError(0, "Could not reach the server. Check that the backend is running, then try again.");
  }
}

/**
 * Calculate carbon footprint for a specified class/subclass without re-running classification.
 */
export async function calculate(cls, weight, unit, subclass = null, signal) {
  if (USE_MOCK) {
    return mockCalculate(cls, weight, unit, subclass);
  }

  const formData = new URLSearchParams();
  formData.append("cls", cls);
  formData.append("weight", String(weight));
  formData.append("unit", unit);
  if (subclass) {
    formData.append("subclass", subclass);
  }

  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
      signal
    });

    if (!res.ok) {
      let detail = null;
      try {
        const errorJson = await res.json();
        detail = errorJson.detail;
      } catch {}
      throw new ApiError(res.status, `Calculate failed with status ${res.status}`, detail);
    }

    return await res.json();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(0, "Failed to calculate footprint.");
  }
}

/**
 * Fetch factor dictionary for all classes.
 */
export async function getClasses(signal) {
  if (USE_MOCK) {
    return EMISSION_FACTORS;
  }

  const res = await fetchWithTimeout(`${API_BASE_URL}/classes`, { signal });
  if (!res.ok) throw new ApiError(res.status, "Failed to fetch classes");
  return await res.json();
}

/**
 * Fetch available refined subclasses for a material class.
 */
export async function getSubclasses(cls, signal) {
  if (USE_MOCK) {
    return SUBCLASSES[cls] || {};
  }

  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/subclasses/${cls}`, { signal });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

/**
 * Health check endpoint.
 */
export async function health(signal) {
  if (USE_MOCK) {
    return { status: "ok", model: "mock-v1" };
  }

  const res = await fetchWithTimeout(`${API_BASE_URL}/health`, { signal }, 5000);
  if (!res.ok) throw new ApiError(res.status, "Backend service unhealthy");
  return await res.json();
}
