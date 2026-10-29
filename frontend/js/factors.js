export const MATERIALS = Object.freeze([
  { id: "plastic", label: "Plastic", colorClass: "material-plastic" },
  { id: "paper", label: "Paper", colorClass: "material-paper" },
  { id: "metal", label: "Metal", colorClass: "material-metal" },
  { id: "organic", label: "Organic", colorClass: "material-organic" },
  { id: "wood", label: "Wood", colorClass: "material-wood" }
]);

export const DEMO_EMISSION_FACTORS = Object.freeze({
  plastic: 2.4,
  paper: 1.1,
  metal: 1.8,
  organic: 0.7,
  wood: 0.5
});

export const MATERIAL_TIPS = Object.freeze({
  plastic: ["Check local rules for accepted plastic types.", "Consider whether the item can be reused before disposal."],
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
