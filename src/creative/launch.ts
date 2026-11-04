import { z } from "zod";
const note = (max: number) => z.string().trim().max(max);
export const launchPlanSchema = z.object({
  id:z.string().uuid(),projectId:z.string().uuid(),updatedAt:z.string().datetime(),
  audience:note(450),problem:note(750),differentiator:note(750),
  proofClaim:note(900),
  proofUrl:z.union([z.literal(""),z.url().max(4096)]).refine(value=>{
    if(!value)return true;
    try{const url=new URL(value);return["https:","http:"].includes(url.protocol)&&!url.username&&!url.password}
    catch{return false}
  },"La preuve exige un lien HTTP(S) sans identifiants."),
  demoPlan:note(1000),hooks:z.array(note(280)).length(5),
  distributionContacts:note(1500),successMetric:note(650),observedResults:note(800)
}).strict();
export type LaunchPlan=z.infer<typeof launchPlanSchema>;
export function newLaunchPlan(projectId:string):LaunchPlan{
  return launchPlanSchema.parse({id:crypto.randomUUID(),projectId,updatedAt:new Date().toISOString(),
    audience:"",problem:"",differentiator:"",proofClaim:"",proofUrl:"",demoPlan:"",
    hooks:["","","","",""],distributionContacts:"",successMetric:"",observedResults:""});
}
export function evaluateLaunchPlan(plan:LaunchPlan){
  const requirements={
    narrative:plan.audience.length>=8&&plan.problem.length>=15&&plan.differentiator.length>=15,
    proof:!!plan.proofUrl&&plan.proofClaim.length>=15&&plan.demoPlan.length>=15,
    hooks:plan.hooks.every(x=>x.length>=15),
    distribution:plan.distributionContacts.length>=12,
    measurement:plan.successMetric.length>=8,
  };
  const missing=Object.entries(requirements).filter(([,ok])=>!ok).map(([name])=>name);
  return {...requirements,readyForHumanReview:missing.length===0,missing};
}
export function exportLaunchPlan(plan:LaunchPlan){
  const gate=evaluateLaunchPlan(plan);
  return [
    "# A.D / Launch Research",
    "Projet : "+plan.projectId,"Édité : "+plan.updatedAt,
    "## Audience",plan.audience,"## Tension",plan.problem,
    "## Différence vraie",plan.differentiator,
    "## Preuve",plan.proofClaim,"Source à vérifier",plan.proofUrl||"Manquante",
    "## Démo",plan.demoPlan,"## Cinq angles",
    ...plan.hooks.map((s,i)=>(i+1)+". "+(s||"[à définir]")),
    "## Distribution",plan.distributionContacts,
    "## Conversion à mesurer",plan.successMetric,
    "## Résultats saisis",plan.observedResults||"Aucun",
    "## État",gate.readyForHumanReview?"Dossier complet pour relecture humaine, aucune publication automatique.":"Brouillon : "+gate.missing.join(", "),
    "Le lien de preuve n’est pas automatiquement validé. Aucun contact sollicité automatiquement."
  ].join("\n\n")
}

