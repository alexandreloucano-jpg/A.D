import { z } from "zod";
// Keep this schema independent of domain.ts to avoid a cyclic ESM import.
const safeUrl=z.string().url().max(4096).refine(v=>{
  try{const u=new URL(v);return ["https:","http:"].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}
},"HTTP(S) URL sans identifiants requis.");
const uuid=z.string().uuid();
export const evidenceReceiptSchema=z.object({
  id:uuid,
  url:safeUrl,
  publisher:z.string().trim().max(180),
  claimSupported:z.string().trim().max(2600),
  publishedAt:z.string().datetime().nullable(),
}).strict();
export const opportunityLinkSchema=z.object({
  id:uuid,
  projectId:uuid,
  opportunityId:uuid,
  signalId:uuid,
  companyId:uuid,
  companyName:z.string().trim().min(1).max(220),
  headline:z.string().trim().min(1).max(2200),
  reportedFact:z.string().max(3000),
  sourceUrl:safeUrl,
  publisher:z.string().max(180),
  unknowns:z.array(z.string().max(500)).max(12),
  evidence:z.array(evidenceReceiptSchema).max(12),
  capturedAt:z.string().datetime(),
  status:z.enum(["PENDING","LINKED"]),
  linkedAt:z.string().datetime().nullable(),
}).strict().superRefine((v,ctx)=>{
  if((v.status==="LINKED")!==!!v.linkedAt)
    ctx.addIssue({code:"custom",message:"Lien serveur non vérifié."});
  if(new Set(v.evidence.map(x=>x.id)).size!==v.evidence.length)
    ctx.addIssue({code:"custom",message:"Preuves dupliquées."});
});
export type EvidenceReceipt=z.infer<typeof evidenceReceiptSchema>;
export type OpportunityLink=z.infer<typeof opportunityLinkSchema>;
