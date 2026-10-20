import type { DealStage } from "../deals/engine";

/** Pure planning for a future server-side worker. Does NOT schedule, call APIs or mutate data. */
export type WorkAgent = "VERIFY" | "COMMERCIAL" | "STRATEGY" | "TASTE" |
  "CREATIVE" | "PRODUCER" | "FINANCE" | "DEAL_ARCHITECT" |
  "LEGAL_DRAFTER" | "CONTROLLER" | "DELIVERY" | "MEMORY";
export type ControlContext = {
  sourceVerified: boolean;
  ownerApprovedCreative: boolean;
  verifiedFinancials: boolean;
  verifiedCapTable: boolean;
  ownerApprovedCommercialTerms: boolean;
  signedAgreementVerified: boolean;
  externalRightsCleared: boolean;
  budgetCapEuro: number;
  expectedJobCostEuro: number;
};
export type TaskPlan =
  | {status:"PLAN"; agents: WorkAgent[]; mode:"RUN_PRIVATE"|"DRAFT"; reason:string}
  | {status:"HOLD"; agents: []; mode:null; reason:string};

/**
 * No agent may approve itself. Holds block model-generated signatures,
 * invented contacts and unsupported financial claims.
 */
export function planNextStage(stage:DealStage, ctx:ControlContext):TaskPlan {
  if (!Number.isFinite(ctx.expectedJobCostEuro) || ctx.expectedJobCostEuro<0 ||
      !Number.isFinite(ctx.budgetCapEuro) || ctx.budgetCapEuro<0 ||
      ctx.expectedJobCostEuro>ctx.budgetCapEuro)
    return {status:"HOLD",agents:[],mode:null,reason:"Le budget d'exécution n'est pas autorisé."};
  if(stage==="CAPTURED")
    return {status:"PLAN",agents:["VERIFY"],mode:"RUN_PRIVATE",reason:"Vérifier le fait de marché avant d'envisager un prospect."};
  if(stage==="VERIFIED")
    return {status:"PLAN",agents:["COMMERCIAL"],mode:"DRAFT",reason:"Qualifier l'entreprise, sans sollicitation externe."};
  if(stage==="QUALIFIED") {
    if(!ctx.sourceVerified) return {status:"HOLD",agents:[],mode:null,reason:"Source principale non vérifiée."};
    return {status:"PLAN",agents:["TASTE","STRATEGY"],mode:"DRAFT",reason:"Construire deux hypothèses créatives sourcées."};
  }
  if(stage==="CREATIVE_DRAFT") {
    if(!ctx.sourceVerified) return {status:"HOLD",agents:[],mode:null,reason:"La proposition créative n'est pas correctement sourcée."};
    return {status:"PLAN",agents:["CREATIVE","PRODUCER","CONTROLLER"],mode:"DRAFT",reason:"Préparer une proposition artistique et son coût, pour arbitrage fondateur."};
  }
  if(stage==="FINANCIAL_REVIEW") {
    if(!ctx.ownerApprovedCreative) return {status:"HOLD",agents:[],mode:null,reason:"La D.A. doit être validée par le fondateur avant l'offre."};
    return {status:"PLAN",agents:["FINANCE","DEAL_ARCHITECT","CONTROLLER"],mode:"DRAFT",
      reason:ctx.verifiedFinancials&&ctx.verifiedCapTable?
        "Comparer les structures économiques à partir de données documentées.":
        "Comparaison cash prioritaire ; l'equity reste non évaluable et ne doit pas être recommandée."};
  }
  if(stage==="OFFER_DRAFT") {
    if(!ctx.ownerApprovedCommercialTerms) return {status:"HOLD",agents:[],mode:null,reason:"Les termes commerciaux ne sont pas approuvés."};
    return {status:"PLAN",agents:["LEGAL_DRAFTER","CONTROLLER"],mode:"DRAFT",reason:"Préparer un brouillon sans le transmettre."};
  }
  if(stage==="LEGAL_REVIEW")
    return {status:"HOLD",agents:[],mode:null,reason:"Revue juridique et validation humaine requises avant contrat."};
  if(stage==="READY_FOR_APPROVAL"||stage==="APPROVED"||stage==="WON")
    return {status:"HOLD",agents:[],mode:null,reason:"Effet externe ou engagement : contrôle humain explicite requis."};
  if(stage==="DELIVERY") {
    if(!ctx.signedAgreementVerified || !ctx.externalRightsCleared)
      return {status:"HOLD",agents:[],mode:null,reason:"Contrat signé ou droits d'utilisation non vérifiés."};
    return {status:"PLAN",agents:["DELIVERY","CONTROLLER"],mode:"DRAFT",reason:"Préparer le suivi interne des livrables approuvés."};
  }
  if(stage==="OUTCOME")
    return {status:"PLAN",agents:["MEMORY","CONTROLLER"],mode:"RUN_PRIVATE",reason:"Archiver les faits et les incertitudes, sans déduire une causalité."};
  return {status:"HOLD",agents:[],mode:null,reason:"Aucune action autonome pour ce statut."};
}
