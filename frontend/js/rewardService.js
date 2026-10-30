// ─── rewardService.js ─────────────────────────────────────────────────────────
// Pure calculation module — no DOM, no storage.
// Returns structured point breakdowns for any analysis event.

/** Points earned per kg of waste tracked, by material */
export const MATERIAL_RATES = Object.freeze({
  metal:        30,
  plastic_high: 30,
  plastic_mid:  25,
  plastic_low:  20,
  paper:        15,
  organic:      12,
  wood:         10
});

/** Flat base points for logging any item */
export const BASE_POINTS = 10;

/** Bonus definitions */
export const BONUSES = Object.freeze({
  DAILY_FIRST:  15,  // First analysis of the current calendar day
  HIGH_CONF:     5,  // Confidence >= HIGH_CONFIDENCE_THRESHOLD
  CORRECTION:    5,  // User manually corrected a low-confidence classification
});

/** Single-item points cap to guard against weight typos (e.g. 9999 kg) */
export const MAX_POINTS_PER_ITEM = 200;

/** Confidence threshold above which the high-confidence bonus is awarded */
export const HIGH_CONFIDENCE_THRESHOLD = 0.75;

/**
 * Calculate Eco-Points for a single analysis event.
 *
 * @param {object} params
 * @param {string}  params.material        - Material id (e.g. "plastic")
 * @param {number}  params.weightKg        - Weight in kilograms (already converted)
 * @param {number}  [params.confidence=0]  - Classification confidence 0–1
 * @param {boolean} [params.isFirstToday]  - True if this is the user's first log today
 * @param {boolean} [params.isCorrection]  - True if awarding a correction bonus
 * @returns {{ totalPoints: number, basePoints: number, materialPoints: number, bonusPoints: number, breakdown: string[] }}
 */
export function calculateReward({ material, weightKg, confidence = 0, isFirstToday = false, isCorrection = false }) {
  const rate = MATERIAL_RATES[material] ?? 10;
  const materialPoints = Math.round(weightKg * rate);

  let bonusPoints = 0;
  const breakdown = [`+${BASE_POINTS} base`];

  breakdown.push(`+${materialPoints} (${weightKg.toFixed(2)} kg × ${rate} pts/kg – ${material})`);

  if (isFirstToday) {
    bonusPoints += BONUSES.DAILY_FIRST;
    breakdown.push(`+${BONUSES.DAILY_FIRST} daily first-log bonus`);
  }
  if (confidence >= HIGH_CONFIDENCE_THRESHOLD) {
    bonusPoints += BONUSES.HIGH_CONF;
    breakdown.push(`+${BONUSES.HIGH_CONF} high-confidence bonus`);
  }
  if (isCorrection) {
    bonusPoints += BONUSES.CORRECTION;
    breakdown.push(`+${BONUSES.CORRECTION} material-correction bonus`);
  }

  const rawTotal = BASE_POINTS + materialPoints + bonusPoints;
  const totalPoints = Math.min(rawTotal, MAX_POINTS_PER_ITEM);

  if (rawTotal > MAX_POINTS_PER_ITEM) {
    breakdown.push(`(capped at ${MAX_POINTS_PER_ITEM} pts per item)`);
  }

  return {
    totalPoints,
    basePoints: BASE_POINTS,
    materialPoints,
    bonusPoints,
    breakdown
  };
}

/**
 * Given a total lifetime balance, return the tier name and progress to next tier.
 * Tiers: Eco Explorer → Green Guardian → Carbon Crusader → Zero Waste Hero
 */
export const TIERS = [
  { name: "Eco Explorer",    minPoints:    0, icon: "🌱" },
  { name: "Green Guardian",  minPoints:  150, icon: "🌿" },
  { name: "Carbon Crusader", minPoints:  400, icon: "🌳" },
  { name: "Zero Waste Hero", minPoints:  800, icon: "🏆" }
];

export function getTier(lifetimeEarned) {
  let current = TIERS[0];
  for (const tier of TIERS) {
    if (lifetimeEarned >= tier.minPoints) current = tier;
  }
  const nextTierIndex = TIERS.indexOf(current) + 1;
  const next = TIERS[nextTierIndex] ?? null;
  const progress = next
    ? Math.min(1, (lifetimeEarned - current.minPoints) / (next.minPoints - current.minPoints))
    : 1;
  return { current, next, progress };
}

