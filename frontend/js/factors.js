export const MATERIALS = Object.freeze([
  { id: "metal", label: "Metal", colorClass: "material-metal" },
  { id: "organic", label: "Organic", colorClass: "material-organic" },
  { id: "paper", label: "Paper", colorClass: "material-paper" },
  { id: "plastic_high", label: "Plastic (High Impact)", colorClass: "material-plastic-high" },
  { id: "plastic_low", label: "Plastic (Low Impact)", colorClass: "material-plastic-low" },
  { id: "plastic_mid", label: "Plastic (Mid Impact)", colorClass: "material-plastic-mid" },
  { id: "wood", label: "Wood", colorClass: "material-wood" }
]);

export const DEMO_EMISSION_FACTORS = Object.freeze({
  metal: 2.365,
  organic: 0.28,
  paper: 1.495,
  plastic_high: 5.68,
  plastic_low: 1.695,
  plastic_mid: 3.58,
  wood: 0.377915
});

export const MATERIAL_TIPS = Object.freeze({
  plastic_high: ["Check local rules for dense/composite plastics.", "High-impact plastics often require specialized recycling."],
  plastic_low: ["Recycle clean films and low-density containers where accepted.", "Avoid single-use wrappers when possible."],
  plastic_mid: ["Rinse rigid plastic bottles and jugs before recycling.", "Check for recycling resin identification codes (1, 2, 5)."],
  paper: ["Keep recyclable paper clean and dry where local services accept it.", "Reuse paper packaging when practical."],
  metal: ["Separate metal according to your local recycling guidance.", "Reusable containers can help avoid single-use items."],
  organic: ["Check whether local composting or food-waste collection is available.", "Meal planning can help prevent avoidable food waste."],
  wood: ["Reuse or repair suitable wood items before disposal.", "Check local guidance for treated or painted wood."]
});

export function getMaterial(materialId) {
  return MATERIALS.find((material) => material.id === materialId) ?? null;
}

export function getDemoFactor(materialId) {
  return DEMO_EMISSION_FACTORS[materialId] ?? null;
}

export function calculateDemoEmission(weightKg, emissionFactor) {
  if (!Number.isFinite(weightKg) || weightKg <= 0 || !Number.isFinite(emissionFactor) || emissionFactor < 0) {
    throw new Error("A valid weight and emission factor are required to calculate this estimate.");
  }
  return weightKg * emissionFactor;
}
