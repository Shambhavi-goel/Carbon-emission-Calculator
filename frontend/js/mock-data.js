/**
 * Mock Data and Simulation Engine
 * Matches backend contracts and factor specifications.
 */

import { convertToKg, getQueryParam } from "./utils.js";
import { CONF_LOW, CONF_HIGH } from "./config.js";

// Emission factors table (kg CO2e per kg)
export const EMISSION_FACTORS = {
  metal: { avg: 2.365, min: 0.93, max: 3.80 },
  organic: { avg: 0.28, min: 0.24, max: 0.32 },
  paper: { avg: 1.495, min: 0.49, max: 2.50 },
  plastic_low: { avg: 1.695, min: 1.31, max: 2.08 },
  plastic_mid: { avg: 3.58, min: 3.29, max: 3.87 },
  plastic_high: { avg: 5.68, min: 5.66, max: 5.70 },
  wood: { avg: 0.377915, min: 0.263, max: 0.49283 }
};

// Placeholder subclasses (values strictly within class min and max)
export const SUBCLASSES = {
  metal: {
    "Aluminium beverage can (placeholder)": 2.10,
    "Steel food tin (placeholder)": 2.45,
    "Mixed scrap metal (placeholder)": 3.20
  },
  organic: {
    "Fruit & vegetable scraps (placeholder)": 0.25,
    "Coffee grounds / tea waste (placeholder)": 0.28,
    "Garden trimmings (placeholder)": 0.30
  },
  paper: {
    "Cardboard corrugated box (placeholder)": 1.10,
    "Office / printer paper (placeholder)": 1.65,
    "Newsprint / magazine (placeholder)": 1.35
  },
  plastic_low: {
    "PET transparent bottles (placeholder)": 1.55,
    "HDPE milk jugs & bottles (placeholder)": 1.80,
    "PP food containers (placeholder)": 1.95
  },
  plastic_mid: {
    "LDPE thin films & bags (placeholder)": 3.40,
    "Polystyrene foam packaging (placeholder)": 3.65,
    "Rigid thermoformed plastic (placeholder)": 3.75
  },
  plastic_high: {
    "PVC pipes & vinyl sheets (placeholder)": 5.67,
    "Multi-layer barrier laminates (placeholder)": 5.69,
    "Complex fluoropolymer scrap (placeholder)": 5.68
  },
  wood: {
    "Untreated pine offcut (placeholder)": 0.32,
    "Hardwood sawdust / shavings (placeholder)": 0.41,
    "Particleboard / MDF scrap (placeholder)": 0.47
  }
};

/**
 * Simulate the /predict backend call with dev switches and realistic confidence tiers.
 */
export async function mockPredict(blob, weight, unit, signal) {
  const mockSwitch = getQueryParam("mock");

  // Dev switch: Network error
  if (mockSwitch === "error") {
    await wait(600, signal);
    throw new Error("Network connection lost. Backend unreachable.");
  }

  // Dev switch: HTTP 422 Unprocessable Entity
  if (mockSwitch === "422") {
    await wait(500, signal);
    const err = new Error("Validation error: image resolution below acceptable threshold.");
    err.status = 422;
    err.detail = "Image too blurry or distorted for reliable feature extraction.";
    throw err;
  }

  // Dev switch: Slow response (triggers timeout)
  if (mockSwitch === "slow") {
    await wait(20000, signal);
  } else {
    await wait(800, signal);
  }

  const weightKg = convertToKg(weight, unit);
  const classes = Object.keys(EMISSION_FACTORS);

  // Dev switch: Plastic confusion (top-2 are different plastic grades with gap < 0.2)
  if (mockSwitch === "plastics") {
    const class1 = "plastic_low";
    const class2 = "plastic_mid";
    const conf1 = 0.52;
    const conf2 = 0.43;
    const factor = EMISSION_FACTORS[class1].avg;
    
    return {
      class: class1,
      confidence: conf1,
      top3: [
        [class1, conf1],
        [class2, conf2],
        ["paper", 0.05]
      ],
      weight_kg: weightKg,
      low_confidence: true,
      emission_factor: factor,
      footprint_kg_co2e: factor * weightKg,
      range_kg_co2e: [
        EMISSION_FACTORS[class1].min * weightKg,
        EMISSION_FACTORS[class1].max * weightKg
      ]
    };
  }

  // Determine confidence & top class
  let predictedClass = "metal";
  let confidence = 0.93;

  if (mockSwitch === "lowconf") {
    predictedClass = "wood";
    confidence = 0.45;
  } else if (mockSwitch === "midconf") {
    predictedClass = "paper";
    confidence = 0.72;
  } else {
    // Weighted natural distribution
    // Pick random class
    predictedClass = classes[Math.floor(Math.random() * classes.length)];
    const roll = Math.random();
    if (roll < 0.75) {
      // 75% chance: high confidence (0.85 - 0.98)
      confidence = +(0.85 + Math.random() * 0.13).toFixed(2);
    } else if (roll < 0.90) {
      // 15% chance: medium confidence (0.60 - 0.80)
      confidence = +(0.60 + Math.random() * 0.20).toFixed(2);
    } else {
      // 10% chance: low confidence (< 0.60)
      confidence = +(0.35 + Math.random() * 0.24).toFixed(2);
    }
  }

  // Construct plausible top3
  const remaining = classes.filter(c => c !== predictedClass);
  const second = remaining[Math.floor(Math.random() * remaining.length)];
  const remaining2 = remaining.filter(c => c !== second);
  const third = remaining2[Math.floor(Math.random() * remaining2.length)];

  const remProb = +(1 - confidence).toFixed(3);
  const conf2 = +(remProb * 0.7).toFixed(2);
  const conf3 = +(remProb - conf2).toFixed(2);

  const factorData = EMISSION_FACTORS[predictedClass];
  const factor = factorData.avg;
  const footprint = factor * weightKg;
  const rangeMin = factorData.min * weightKg;
  const rangeMax = factorData.max * weightKg;

  return {
    class: predictedClass,
    confidence: confidence,
    top3: [
      [predictedClass, confidence],
      [second, conf2],
      [third, conf3]
    ],
    weight_kg: weightKg,
    low_confidence: confidence < CONF_LOW,
    emission_factor: factor,
    footprint_kg_co2e: footprint,
    range_kg_co2e: [rangeMin, rangeMax]
  };
}

/**
 * Simulate /calculate without rerunning the model.
 */
export async function mockCalculate(cls, weight, unit, subclass = null) {
  const factorData = EMISSION_FACTORS[cls] || EMISSION_FACTORS.metal;
  const weightKg = convertToKg(weight, unit);

  let factor = factorData.avg;
  if (subclass && SUBCLASSES[cls] && SUBCLASSES[cls][subclass]) {
    factor = SUBCLASSES[cls][subclass];
  }

  const footprint = factor * weightKg;
  const rangeMin = factorData.min * weightKg;
  const rangeMax = factorData.max * weightKg;

  return {
    emission_factor: factor,
    footprint_kg_co2e: footprint,
    range_kg_co2e: [rangeMin, rangeMax]
  };
}

/**
 * Helper to sleep with abort signal support
 */
function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new DOMException("Aborted", "AbortError"));
    }
    const timer = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      });
    }
  });
}
