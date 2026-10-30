import { ANALYSIS_TIMEOUT_MS, API_BASE_URL, USE_MOCK } from "./config.js";
import { getMaterial } from "./factors.js";
import { mockAnalyze } from "./mockAnalyze.js";

export async function analyze({ image, weightKg }) {
  if (USE_MOCK) return mockAnalyze(image);
  if (API_BASE_URL === undefined || API_BASE_URL === null) {
    throw new Error("The analysis API is not configured. Configure the API endpoint before analyzing items.");
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);
  try {
    const body = new FormData();
    body.append("image", image);
    body.append("weight", String(weightKg));
    body.append("unit", "kg");
    const response = await fetch(`${API_BASE_URL}/api/analyze`, {
      method: "POST",
      body,
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Analysis service returned ${response.status}. Try again.`);
    const result = await response.json();
    const material = getMaterial(result.material);
    const factor = Number(result.emissionFactor);
    const confidence = Number(result.confidence);
    if (!material || !Number.isFinite(factor) || factor < 0 || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      throw new Error("Analysis service returned an unsupported result. Try again.");
    }
    return { material: material.id, confidence, emissionFactor: factor, source: "api" };
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Analysis took too long. Check your connection and try again.");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
