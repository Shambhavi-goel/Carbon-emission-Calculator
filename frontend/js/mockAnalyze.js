import { getDemoFactor, getMaterial, MATERIALS } from "./factors.js";

const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

export async function mockAnalyze(image) {
  await wait(800);
  const filename = image.name.toLowerCase();
  const material = MATERIALS.find((candidate) => filename.includes(candidate.id)) ?? MATERIALS[0];
  const confidence = filename.includes(material.id) ? 0.82 : 0.58;
  return {
    material: material.id,
    confidence,
    emissionFactor: getDemoFactor(material.id),
    source: "mock"
  };
}
