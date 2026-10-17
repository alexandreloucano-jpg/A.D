import type { Factor } from "./schema.js";
export const weights = {
  service_fit: 30,
  time_relevance: 25,
  budget_evidence: 20,
  decision_maker_access: 15,
  trigger_strength: 10,
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
        ? Math.round(known.reduce((n, f) => n + f.weight * f.value!, 0))
        : null,
  };
}
