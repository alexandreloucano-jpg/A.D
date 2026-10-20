import { z } from "zod";

/**
 * A.D canonical contract, pure domain only.
 * Does not read, write, send, schedule, publish, approve, or sign anything.
 * Production storage/authorization must be implemented separately.
 */
export const evidenceState = z.enum(["OBSERVED", "VERIFIED", "DERIVED", "HYPOTHESIS", "UNKNOWN"]);
export const dealStage = z.enum([
  "CAPTURED", "VERIFIED", "QUALIFIED", "CREATIVE_DRAFT", "FINANCIAL_REVIEW",
  "OFFER_DRAFT", "LEGAL_REVIEW", "READY_FOR_APPROVAL", "APPROVED",
  "WON", "LOST", "PAUSED", "NO_DEAL", "DELIVERY", "OUTCOME",
]);
export const businessModel = z.enum([
  "CASH", "CASH_PLUS_EQUITY", "BRAND_JV", "IP_LICENCE", "SOFTWARE", "NO_DEAL",
]);
export const sourceClaim = z.object({
  statement: z.string().min(1).max(3000),
  state: evidenceState,
  sourceUrl: z.string().url().optional(),
  observedAt: z.string().datetime().optional(),
  uncertainty: z.string().max(1000).default(""),
}).strict().superRefine((claim,ctx) => {
  if (claim.state === "VERIFIED" && !claim.sourceUrl)
    ctx.addIssue({code: "custom",message: "Une information vérifiée nécessite une source.",path: ["sourceUrl"]});
});
export const dealRecord = z.object({
  id: z.string().uuid(),
  ownerId: z.string().min(1),
  companyId: z.string().uuid().nullable(),
  name: z.string().min(1).max(160),
  relationship: z.enum(["NEW", "EXISTING"]),
  stage: dealStage,
  model: businessModel.nullable(),
  claims: z.array(sourceClaim).max(1000),
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();
export type DealRecord = z.infer<typeof dealRecord>;
export type DealStage = z.infer<typeof dealStage>;
export type BusinessModel = z.infer<typeof businessModel>;

const stageTransitions: Record<DealStage, readonly DealStage[]> = {
  CAPTURED: ["VERIFIED", "PAUSED", "NO_DEAL"],
  VERIFIED: ["QUALIFIED", "PAUSED", "NO_DEAL"],
  QUALIFIED: ["CREATIVE_DRAFT", "PAUSED", "NO_DEAL"],
  CREATIVE_DRAFT: ["FINANCIAL_REVIEW", "PAUSED", "NO_DEAL"],
  FINANCIAL_REVIEW: ["OFFER_DRAFT", "PAUSED", "NO_DEAL"],
  OFFER_DRAFT: ["LEGAL_REVIEW", "PAUSED", "NO_DEAL"],
  LEGAL_REVIEW: ["READY_FOR_APPROVAL", "PAUSED", "NO_DEAL"],
  READY_FOR_APPROVAL: ["APPROVED", "LEGAL_REVIEW", "PAUSED", "NO_DEAL"],
  APPROVED: ["WON", "LOST", "PAUSED"],
  WON: ["DELIVERY", "PAUSED"],
  LOST: [],
  PAUSED: ["CAPTURED", "VERIFIED", "QUALIFIED", "CREATIVE_DRAFT", "FINANCIAL_REVIEW", "OFFER_DRAFT", "LEGAL_REVIEW"],
  NO_DEAL: [],
  DELIVERY: ["OUTCOME", "PAUSED"],
  OUTCOME: [],
};
export function mayTransition(current: DealStage, next: DealStage, byOwner: boolean): boolean {
  if (!stageTransitions[current].includes(next)) return false;
  return !["APPROVED", "WON", "DELIVERY", "OUTCOME"].includes(next) || byOwner;
}
export const authority = z.enum(["RUN_PRIVATE", "DRAFT", "OWNER_APPROVAL", "SPECIALIST_REVIEW"]);
export const agentAction = z.enum([
  "READ_PUBLIC_ALLOWED", "INDEX_PRIVATE_OPTED_IN", "DEDUPE", "DRAFT_CREATIVE",
  "DRAFT_OUTREACH", "DRAFT_FINANCE", "DRAFT_CONTRACT", "SEND_EXTERNAL",
  "PUBLISH_PUBLIC", "SPEND_MONEY", "HIRE", "SIGN", "BUY_SECURITIES", "ISSUE_CONTRACT",
]);
export type AgentAction = z.infer<typeof agentAction>;
const autonomous = new Set<AgentAction>([
  "READ_PUBLIC_ALLOWED", "INDEX_PRIVATE_OPTED_IN", "DEDUPE",
  "DRAFT_CREATIVE", "DRAFT_OUTREACH", "DRAFT_FINANCE", "DRAFT_CONTRACT",
]);
/** Approval proof is checked server side, never trusted from an agent or client field. */
export function autonomousAllowed(action: AgentAction): boolean { return autonomous.has(action); }

export const agentArtifact = z.object({
  artifactId: z.string().uuid(),
  dealId: z.string().uuid(),
  agentId: z.enum(["SCOUT","VERIFY","COMMERCIAL","TASTE","STRATEGY","CREATIVE",
    "PRODUCER","FINANCE","DEAL_ARCHITECT","LEGAL_DRAFTER","DELIVERY","CONTROLLER","MEMORY"]),
  agentVersion: z.string().min(1),
  status: z.enum(["DRAFT", "NEEDS_REVIEW", "REJECTED", "APPROVED"]),
  claims: z.array(sourceClaim),
  missingData: z.array(z.string().min(1)).default([]),
  documentRef: z.string().optional(),
  createdAt: z.string().datetime(),
}).strict();
export const money = z.number().finite().nonnegative().max(1e15);
export const equityScenario = z.object({
  foregoneCashEuro: money,
  equityExitValueEuro: money, // NOT enterprise value, already net debt
  initialStakePct: z.number().finite().min(0).max(100),
  totalFurtherDilutionPct: z.number().finite().min(0).max(100),
  yearsUntilExit: z.number().int().min(1).max(40),
  annualDiscountPct: z.number().finite().min(0).max(100),
  probabilityOfExitPct: z.number().finite().min(0).max(100).nullable(),
}).strict();
export type EquityScenario = z.infer<typeof equityScenario>;
export function projectEquity(input: EquityScenario) {
  const p = equityScenario.parse(input);
  const finalStakePct = p.initialStakePct * (1-p.totalFurtherDilutionPct/100);
  const grossExitEuro = p.equityExitValueEuro * finalStakePct / 100;
  const possibleExpectedEuro = p.probabilityOfExitPct === null
    ? null : grossExitEuro*p.probabilityOfExitPct/100;
  const expectedPresentEuro = possibleExpectedEuro === null
    ? null : possibleExpectedEuro / Math.pow(1+p.annualDiscountPct/100,p.yearsUntilExit);
  return {finalStakePct,grossExitEuro,expectedPresentEuro,
    foregoneCashEuro:p.foregoneCashEuro,
    hypotheticalOnly:true as const,
    note:"Illustration avant impôts, liquidation préférentielle, frais, dettes non incluses et liquidité. La probabilité, si présente, est fournie par l'utilisateur et non validée."};
}
export type RouteInput = {
  opportunityVerified: boolean;
  financialStatementsVerified: boolean;
  capTableVerified: boolean;
  rightsVerified: boolean;
  funded: boolean;
  scalable: boolean;
  contributionBeyondServices: boolean;
  ethicalOrLegalBlocker: boolean;
};
export function preliminaryRoute(x: RouteInput): {model: BusinessModel; reason: string} {
  if(x.ethicalOrLegalBlocker) return {model:"NO_DEAL",reason:"Blocage juridique ou éthique : vérification spécialisée nécessaire."};
  if(!x.opportunityVerified) return {model:"NO_DEAL",reason:"Opportunité insuffisamment corroborée ; conserver en qualification, sans offre."};
  if(!x.financialStatementsVerified || !x.capTableVerified || !x.rightsVerified)
    return {model:"CASH",reason:"Participation non évaluable : comptes, cap table ou droits non vérifiés."};
  if(!x.funded) return {model:"CASH",reason:"Ne pas remplacer un budget inexistant par une promesse de titres."};
  if(x.scalable && x.contributionBeyondServices)
    return {model:"CASH_PLUS_EQUITY",reason:"Mandat hybride à examiner par le fondateur, avec avocat et fiscaliste."};
  return {model:"CASH",reason:"Mandat de services sans contribution de cofondateur démontrée."};
}
