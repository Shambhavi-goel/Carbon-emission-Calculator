const RESULT_KEY_PREFIX = "cfc_results_";

function resultKey(userId) {
  return `${RESULT_KEY_PREFIX}${userId}`;
}

function createResultId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (!globalThis.crypto?.getRandomValues) throw new Error("Browser ID generation is unavailable. Use localhost or HTTPS to continue.");
  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function readResults(userId) {
  const raw = window.localStorage.getItem(resultKey(userId));
  if (raw === null) return [];
  let results;
  try {
    results = JSON.parse(raw);
  } catch (error) {
    throw new Error("Saved analysis history is invalid. Clear this site's saved data to continue.", { cause: error });
  }
  if (!Array.isArray(results) || results.some((result) =>
    !result || typeof result.id !== "string" || typeof result.createdAt !== "string" ||
    typeof result.material !== "string" || !Number.isFinite(result.weightKg) ||
    !Number.isFinite(result.emissionFactor) || !Number.isFinite(result.co2eKg)
  )) {
    throw new Error("Saved analysis history is not in the expected format. Clear this site's saved data to continue.");
  }
  return results;
}

export function getResults(userId) {
  return readResults(userId).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function saveResult(userId, result) {
  const results = readResults(userId);
  const record = { ...result, id: result.id ?? createResultId(), createdAt: result.createdAt ?? new Date().toISOString() };
  results.unshift(record);
  try {
    window.localStorage.setItem(resultKey(userId), JSON.stringify(results));
    return { result: record, thumbnailSaved: Boolean(record.thumbnail) };
  } catch (error) {
    if (!(error instanceof DOMException) || !["QuotaExceededError", "NS_ERROR_DOM_QUOTA_REACHED"].includes(error.name)) {
      throw error;
    }
    record.thumbnail = "";
    results[0] = record;
    try {
      window.localStorage.setItem(resultKey(userId), JSON.stringify(results));
      return { result: record, thumbnailSaved: false };
    } catch (retryError) {
      throw new Error("Browser storage is full. Delete some history and try again.", { cause: retryError });
    }
  }
}

export function updateResult(userId, resultId, updates) {
  const results = readResults(userId);
  const index = results.findIndex((result) => result.id === resultId);
  if (index < 0) throw new Error("This history entry is no longer available.");
  results[index] = { ...results[index], ...updates };
  window.localStorage.setItem(resultKey(userId), JSON.stringify(results));
  return results[index];
}

export function deleteResult(userId, resultId) {
  const results = readResults(userId);
  const nextResults = results.filter((result) => result.id !== resultId);
  if (nextResults.length === results.length) return false;
  window.localStorage.setItem(resultKey(userId), JSON.stringify(nextResults));
  return true;
}

export function getSummary(userId) {
  const results = getResults(userId);
  const total = results.reduce((sum, result) => sum + result.co2eKg, 0);
  const counts = results.reduce((summary, result) => {
    summary[result.material] = (summary[result.material] ?? 0) + 1;
    return summary;
  }, {});
  const commonMaterial = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return { total, count: results.length, commonMaterial, results };
}
