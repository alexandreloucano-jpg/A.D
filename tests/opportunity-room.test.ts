import {describe,it,expect} from "vitest";
import { emptyWorkspace,workspaceSchema } from "../src/domain";
import { stageOpportunity,markOpportunityLinked } from "../src/opportunity/open";
import type { Finding } from "../src/scout-market/schema";
import type { EvidenceReceipt } from "../src/opportunity/model";
const ids={
  opportunity:"5cbaf1a6-04db-455c-a0a3-cd886ff32290",
  signal:"d0b2e61e-fc1d-4c4b-8acb-ec9c220ea45f",
  company:"01d687c9-fd22-4ac3-b5bf-3be160d12352",
  evidence:"cce3edb4-037e-4c4b-91b3-e4f54da5b625",
  project:"a8ad4f0e-348e-4b8e-8039-d4f209791cca",
};
const finding={
 id:ids.opportunity,signalId:ids.signal,companyId:ids.company,
 evidenceId:ids.evidence,companyName:"Maison indépendante",headline:"Maison indépendante ouvre un nouveau lieu",
 reportedFact:"L'ouverture du lieu a été annoncée publiquement.",
 canonicalUrl:"https://example.org/news/opening",publisher:"Journal test",
 knownUnknowns:["Budget marketing non vérifié."],
 reviewState:"saved",projectId:null,
} as Finding;
const evidence:EvidenceReceipt[]=[{
 id:ids.evidence,url:finding.canonicalUrl,publisher:"Journal test",
 claimSupported:finding.reportedFact,publishedAt:"2026-10-20T08:00:00.000Z",
}];
describe("A.D V3 / Opportunity Room",()=>{
 it("creates one dossier and preserves original source plus unknowns",()=>{
   const staged=stageOpportunity(emptyWorkspace(),finding,evidence);
   expect(staged.changed).toBe(true);
   expect(staged.workspace.projects).toHaveLength(1);
   expect(staged.workspace.opportunityLinks).toHaveLength(1);
   expect(staged.link.evidence[0].url).toBe(finding.canonicalUrl);
   expect(staged.link.unknowns).toEqual(finding.knownUnknowns);
   expect(staged.link.status).toBe("PENDING");
   expect(workspaceSchema.parse(staged.workspace)).toBeTruthy();
 });
 it("avoids duplicate dossier if network linking fails and user retries",()=>{
   const one=stageOpportunity(emptyWorkspace(),finding,evidence);
   const two=stageOpportunity(one.workspace,finding,evidence);
   expect(two.changed).toBe(false);
   expect(two.projectId).toBe(one.projectId);
   expect(two.workspace.projects).toHaveLength(1);
 });
 it("links only after explicit verified acknowledgement",()=>{
   const one=stageOpportunity(emptyWorkspace(),finding,evidence);
   const verified=markOpportunityLinked(one.workspace,finding.id,one.projectId);
   expect(verified.opportunityLinks?.[0].status).toBe("LINKED");
   expect(verified.opportunityLinks?.[0].linkedAt).toBeTruthy();
   expect(one.workspace.opportunityLinks?.[0].status).toBe("PENDING");
   expect(workspaceSchema.parse(verified)).toBeTruthy();
 });
 it("refuses missing primary evidence and an already attached remote project",()=>{
   expect(()=>stageOpportunity(emptyWorkspace(),finding,[])).toThrow("aucune preuve");
   expect(()=>stageOpportunity(emptyWorkspace(),{...finding,projectId:ids.project},evidence)).toThrow("autre appareil");
 });
 it("never creates a dossier for an opportunity not approved in pipeline",()=>{
   expect(()=>stageOpportunity(emptyWorkspace(),{...finding,reviewState:"new"},evidence)).toThrow("pipeline");
 });
 it("rejects inconsistent imported LINKED status without server timestamp",()=>{
   const one=stageOpportunity(emptyWorkspace(),finding,evidence);
   const broken={...one.workspace,opportunityLinks:[{...one.link,status:"LINKED" as const,linkedAt:null}]};
   expect(()=>workspaceSchema.parse(broken)).toThrow();
 });
 it("retains backward compatibility for v1 workspaces without opportunity links",()=>{
   const w=emptyWorkspace();delete w.opportunityLinks;
   expect(workspaceSchema.parse(w).opportunityLinks).toBeUndefined();
 });
});
