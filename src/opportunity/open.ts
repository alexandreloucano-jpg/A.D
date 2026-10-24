import type { Workspace } from "../domain";
import type { Finding } from "../scout-market/schema";
import {
  evidenceReceiptSchema, opportunityLinkSchema,
  type EvidenceReceipt, type OpportunityLink,
} from "./model";

export function stageOpportunity(
  workspace: Workspace,
  finding: Finding,
  evidence: EvidenceReceipt[],
  now=new Date().toISOString(),
): {workspace:Workspace;projectId:string;link:OpportunityLink;changed:boolean}{
  if(finding.reviewState!=="saved")throw Error("Enregistrez d'abord cette opportunité en pipeline.");
  const current=workspace.opportunityLinks?.find(l=>l.opportunityId===finding.id);
  if(current) return {workspace,projectId:current.projectId,link:current,changed:false};
  if(!evidence.length)throw Error("Dossier non créé : aucune preuve source vérifiée dans Radar.");
  if(evidence.length>12)throw Error("Trop de preuves à figer dans ce dossier.");
  const sourceEvidence=evidence.map(v=>evidenceReceiptSchema.parse(v));
  if(!sourceEvidence.some(v=>v.id===finding.evidenceId))
    throw Error("Dossier non créé : la preuve principale n'est pas disponible.");
  const assigned=finding.projectId;
  if(assigned && !workspace.projects.some(p=>p.id===assigned))
    throw Error("Cette opportunité appartient à un dossier d'un autre appareil. Restaurez d'abord sa sauvegarde.");
  const projectId=assigned||crypto.randomUUID();
  const link=opportunityLinkSchema.parse({
    id:crypto.randomUUID(),projectId,opportunityId:finding.id,
    signalId:finding.signalId,companyId:finding.companyId,
    companyName:finding.companyName.slice(0,220),
    headline:finding.headline.slice(0,2200),
    reportedFact:finding.reportedFact.slice(0,3000),
    sourceUrl:finding.canonicalUrl,
    publisher:finding.publisher.slice(0,180),
    unknowns:finding.knownUnknowns.slice(0,12).map(x=>x.slice(0,500)),
    evidence:sourceEvidence,capturedAt:now,status:"PENDING",linkedAt:null,
  });
  return {
    projectId,link,changed:true,
    workspace:{
      ...workspace,
      projects:assigned?workspace.projects:[...workspace.projects,
        {id:projectId,title:finding.companyName.slice(0,180)+" — Opportunity Room",updatedAt:now}],
      opportunityLinks:[...(workspace.opportunityLinks||[]),link],
    },
  };
}
export function markOpportunityLinked(
  workspace:Workspace,opportunityId:string,projectId:string,now=new Date().toISOString(),
):Workspace{
  const found=workspace.opportunityLinks?.find(l=>l.opportunityId===opportunityId);
  if(!found||found.projectId!==projectId)
    throw Error("Liaison locale introuvable : la confirmation serveur est suspendue.");
  return {...workspace,
    opportunityLinks:(workspace.opportunityLinks||[]).map(l=>
      l.opportunityId===opportunityId?
        {...l,status:"LINKED" as const,linkedAt:l.linkedAt||now}:l),
    projects:workspace.projects.map(p=>p.id===projectId?{...p,updatedAt:now}:p),
  };
}
