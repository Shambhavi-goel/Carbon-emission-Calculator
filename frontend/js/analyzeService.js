import { ANALYSIS_TIMEOUT_MS, API_BASE_URL, USE_MOCK } from "./config.js";
import { getMaterial } from "./factors.js";
import { mockAnalyze } from "./mockAnalyze.js";

function getCandidateEndpoints() {
  const endpoints = [];
  if (API_BASE_URL) {
    endpoints.push(`${API_BASE_URL}/api/analyze`);
  }
  if (typeof window !== "undefined") {
    const isVercel = window.location.hostname.endsWith("vercel.app");
    if (!isVercel && window.location.port !== "8000") {
      endpoints.push("http://127.0.0.1:8000/api/analyze");
      endpoints.push("http://localhost:8000/api/analyze");
    }
    endpoints.push("/api/analyze");
  } else {
    endpoints.push("/api/analyze");
  }
  return Array.from(new Set(endpoints));
}

export async function analyze({ image, weightKg }) {
  if (USE_MOCK) return mockAnalyze(image);

  const endpoints = getCandidateEndpoints();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);
  let lastError = null;

  try {
    for (let i = 0; i < endpoints.length; i++) {
      const url = endpoints[i];
      try {
        const body = new FormData();
        body.append("image", image);
        body.append("weight", String(weightKg));
        body.append("unit", "kg");

        const response = await fetch(url, {
          method: "POST",
          body,
          signal: controller.signal
        });

        // 501 indicates the request hit python's static http.server (which does not support POST).
        // If there are other endpoints to try (such as the FastAPI backend at port 8000), proceed to next.
        if (response.status === 501 && i < endpoints.length - 1) {
          continue;
        }

        if (!response.ok) {
          throw new Error(`Analysis service returned ${response.status}. Try again.`);
        }

        const result = await response.json();
        const material = getMaterial(result.material);
        const factor = Number(result.emissionFactor);
        const confidence = Number(result.confidence);
        if (!material || !Number.isFinite(factor) || factor < 0 || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
          throw new Error("Analysis service returned an unsupported result. Try again.");
        }
        return { material: material.id, confidence, emissionFactor: factor, source: "api" };
      } catch (err) {
        lastError = err;
        if (err.name === "AbortError") throw err;
        // If this wasn't the last candidate, try next
        if (i < endpoints.length - 1) continue;
        throw err;
      }
    }
    if (lastError) throw lastError;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Analysis took too long. Check your connection and try again.");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
