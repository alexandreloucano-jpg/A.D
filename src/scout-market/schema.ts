import { z } from "zod";
export const stages = [
  "discovered",
  "qualified",
  "contact_identified",
  "proposal_drafted",
  "contacted",
  "meeting",
  "negotiation",
  "won",
  "lost",
] as const;
export const stageSchema = z.enum(stages);
export const reviewSchema = z.enum([
  "new",
  "reviewing",
  "saved",
  "rejected",
  "snoozed",
]);
export type Factor = {
  value: 0 | 0.5 | 1 | null;
  weight: number;
  reason: string;
  evidenceIds: string[];
  assessedAt: string;
};
export interface Finding {
  id: string;
  companyId: string;
  signalId: string;
  evidenceId: string;
  companyName: string;
  sector: string;
  city: string | null;
  eventType: string;
  headline: string;
  reportedFact: string;
  canonicalUrl: string;
  publisher: string;
  sourceId: string;
  publishedAt: string | null;
  eventDate: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  sourceCount: number;
  sourceClass: "official" | "trade" | "press";
  status: "source_confirmed" | "corroborated" | "stale";
  excerpt: string;
  contentHash: string;
  whyNow: string;
  potentialNeed: string;
  services: string[];
  creativeAngle: string;
  knownUnknowns: string[];
  score: number | null;
  coverage: number;
  factors: Record<string, Factor>;
  confidence: "low" | "medium" | "high";
  budgetMinEur: null;
  budgetMaxEur: null;
  reviewState: z.infer<typeof reviewSchema>;
  stage: z.infer<typeof stageSchema>;
  projectId: string | null;
  updatedAt: string;
}
export interface MarketAction {
  id: string;
  opportunityId: string;
  proposalText: string;
  lane: "LATER" | "NOW" | "KILL";
  acceptedAt: string | null;
  completedAt: string | null;
}
export interface ScanRun {
  id: string;
  status: "running" | "succeeded" | "partial" | "failed";
  startedAt: string;
  finishedAt: string | null;
  sourceCount: number;
  itemsSeen: number;
  insertedCount: number;
  deduplicatedCount: number;
  analyzedCount: number;
  failures: { sourceId: string; error: string }[];
  cursor: number;
  paused: boolean;
  costEstimateEur: 0;
}
export const listQuery = z.object({
  q: z.string().max(200).default(""),
  status: reviewSchema.optional(),
  sector: z.string().max(80).optional(),
  city: z.string().max(80).optional(),
  eventType: z.string().max(80).optional(),
  confidence: z.enum(["low", "medium", "high"]).optional(),
  stage: stageSchema.optional(),
  minCoverage: z.coerce.number().min(0).max(1).optional(),
  days: z.coerce.number().int().min(1).max(365).default(45),
  after: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(50),
});
