import type { Factor } from "./schema.js";
export const weights = {
  service_fit: 30,
  trigger_strength: 20,
  time_relevance: 15,
  creative_opportunity: 15,
  decision_maker_access: 10,
  taste_fit: 10,
};
export function scoreFactors(factors: Record<string, Factor>) {
  const known = Object.values(factors).filter((f) => f.value !== null);
  const coverage = known.reduce((n, f) => n + f.weight, 0) / 100;
  return {
    coverage,
    score:
      coverage >= 0.6 &&
      factors.service_fit?.value != null &&
      factors.trigger_strength?.value != null
        ? Math.round(
            known.reduce((n, f) => n + f.weight * f.value!, 0) / coverage,
          )
        : null,
  };
}
