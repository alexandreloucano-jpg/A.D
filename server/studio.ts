import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Store, ServiceError, digest } from "./store.js";
import { owner, requireSameOrigin, type Config } from "./security.js";

const message = z.string().trim().min(10).max(1200);
const inquiry = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().max(180),
  brand: z.string().trim().min(2).max(120),
  website: z.union([z.literal(""),z.url().max(200)]),
  sector: z.enum(["Hospitality / restauration","Hôtel / nightlife","Mode / beauté / lifestyle","Autre marque indépendante"]),
  challenge: message,
  privacyAcknowledged: z.literal(true),
  marketingOptIn: z.boolean().default(false),
  verificationToken: z.string().min(20).max(3500),
  trap: z.string().max(100).default(""),
  sourcePath: z.literal("/studio"),
}).strict();
export const studioInquirySchema = inquiry;
const stages = z.enum(["NEW","REVIEWING","QUALIFIED","DISCOVERY","PROPOSAL","WON","LOST","CLOSED"]);
const decision = z.object({
  id:z.uuid(),
  expectedStage:stages,
  stage:stages,
  note:z.string().max(1000).default(""),
}).strict();

function json(body:unknown,status=200) {
  return new Response(JSON.stringify(body),{status,headers:{
    "content-type":"application/json","cache-control":"no-store",
    "x-content-type-options":"nosniff","referrer-policy":"no-referrer",
  }});
}
export function studioReady() {
  return process.env.AD_PUBLIC_ENQUIRIES_ENABLED==="1" &&
    !!process.env.AD_TURNSTILE_SECRET_KEY &&
    !!process.env.VITE_AD_STUDIO_TURNSTILE_SITE_KEY &&
    !!process.env.AD_PRIVACY_NOTICE_URL &&
    !!process.env.AD_BUSINESS_LEGAL_NAME;
}
async function verifyTurnstile(token:string, c:Config) {
  const secret=process.env.AD_TURNSTILE_SECRET_KEY;
  if(!secret) throw new ServiceError(503,"verification_not_configured");
  let result:Response;
  try {
    result=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{
      method:"POST",body:new URLSearchParams({secret,response:token}),
      signal:AbortSignal.timeout(7000),
    });
  } catch {throw new ServiceError(503,"verification_unavailable");}
  if(!result.ok) throw new ServiceError(503,"verification_unavailable");
  const proof = z.object({success:z.boolean(),hostname:z.string().optional()}).passthrough()
    .safeParse(await result.json());
  if(!proof.success || !proof.data.success ||
      proof.data.hostname !== new URL(c.app).hostname)
    throw new ServiceError(403,"verification_failed");
}
export async function studioInquiryRoute(request:Request,store:Store,c:Config) {
  if(c.role!=="app") throw new ServiceError(404,"not_found");
  const path=new URL(request.url).pathname;
  if(path==="/api/studio/availability" && request.method==="GET")
    return json({available:studioReady(),privacyUrl:studioReady()?process.env.AD_PRIVACY_NOTICE_URL:null});
  if(path==="/api/studio/inquiries" && request.method==="GET"){
    const session=await owner(request,store,c);
    const rows=await store.query(
      "SELECT id,name,email,brand,website,sector,challenge,stage,created_at,updated_at,notes,source_path FROM ad_studio_inquiries WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 100",
      [session.owner]);
    return json({items:rows,source:"owner_private"});
  }
  if(path==="/api/studio/inquiries" && request.method==="PATCH"){
    const session=await owner(request,store,c,true);
    const data=decision.parse(await request.json());
    const rows=await store.query(
      "UPDATE ad_studio_inquiries SET stage=$1,notes=$2,updated_at=now() WHERE owner_id=$3 AND id=$4 AND stage=$5 RETURNING id,stage,updated_at",
      [data.stage,data.note,session.owner,data.id,data.expectedStage],
    );
    if(!rows.length) throw new ServiceError(409,"inquiry_changed_or_not_found");
    await store.audit(session.owner,"owner","studio_inquiry_updated",data.stage);
    return json({item:rows[0]});
  }
  if(path!=="/api/studio/inquiries" || request.method!=="POST")
    throw new ServiceError(405,"method_not_allowed");
  if(!studioReady()) throw new ServiceError(503,"inquiries_not_configured");
  requireSameOrigin(request,c);
  const raw=await request.text();
  if(Buffer.byteLength(raw)>12000) throw new ServiceError(413,"request_too_large");
  let input:unknown;
  try{input=JSON.parse(raw)}catch{throw new ServiceError(400,"invalid_json")}
  const data=inquiry.parse(input);
  // Tarpit basic form bots without exposing any database side effects.
  if(data.trap) return json({received:true},202);
  await store.quota("studio:global",60,3600);
  await store.quota("studio:email:"+digest(data.email.trim().toLowerCase()),3,86400);
  await verifyTurnstile(data.verificationToken,c);
  const id=randomUUID();
  await store.query(
    "INSERT INTO ad_studio_inquiries(owner_id,id,name,email,brand,website,sector,challenge,stage,marketing_opt_in,source_path) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'NEW',$9,$10)",
    [c.owner,id,data.name,data.email.toLowerCase(),data.brand,data.website||null,data.sector,data.challenge,data.marketingOptIn,data.sourcePath],
  );
  await store.audit(c.owner,"public-form","studio_inquiry_received","new_unqualified");
  return json({received:true,reference:id},202);
}
