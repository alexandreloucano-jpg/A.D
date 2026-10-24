import { beforeAll,beforeEach,afterAll,afterEach,it,expect,vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { Store,digest } from "../server/store";
import { studioInquiryRoute,studioInquirySchema } from "../server/studio";
import type { Config } from "../server/security";
let pg:PGlite,s:Store;
const cfg:Config={role:"app",app:"https://app.example",gateway:"https://gateway.example",owner:"test-owner",githubClient:"",githubSecret:"",redirects:[]};
const lead={name:"Alexis Martin",email:"alexis@example.org",brand:"Maison de test",website:"",
  sector:"Mode / beauté / lifestyle",challenge:"Nous lançons une première collection et cherchons un accompagnement de direction artistique structurant.",
  privacyAcknowledged:true,marketingOptIn:false,verificationToken:"this-is-a-fixture-turnstile-token",trap:"",sourcePath:"/studio"};
const uri=cfg.app+"/api/studio/inquiries";
beforeAll(async()=>{
  pg=new PGlite();
  await pg.exec(await readFile("sql/001-private-saver.sql","utf8"));
  await pg.exec(await readFile("sql/008-studio-inquiries.sql","utf8"));
  s=new Store(async(q,p=[])=> (await pg.query(q,p)).rows as Record<string,unknown>[]);
},30000);
beforeEach(async()=>{
  await pg.exec("TRUNCATE ad_records,ad_quota,ad_audit,ad_studio_inquiries");
  vi.stubEnv("AD_PUBLIC_ENQUIRIES_ENABLED","1");
  vi.stubEnv("AD_TURNSTILE_SECRET_KEY","test-secret");
  vi.stubEnv("VITE_AD_STUDIO_TURNSTILE_SITE_KEY","test-site-key");
  vi.stubEnv("AD_PRIVACY_NOTICE_URL","https://app.example/privacy");
  vi.stubEnv("AD_BUSINESS_LEGAL_NAME","Alexis Martin EI");
  vi.stubEnv("AD_BUSINESS_LEGAL_FORM","EI");
  vi.stubEnv("AD_BUSINESS_SIRET","12345678901234");
  vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({success:true,hostname:"app.example"}))));
  await s.put("session",digest("owner-session"),{owner:cfg.owner,csrf:"fixture-csrf"},600);
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
afterAll(async()=>pg.close());
function post(payload=lead, origin=cfg.app) {
  return new Request(uri,{method:"POST",headers:{"content-type":"application/json",origin},body:JSON.stringify(payload)});
}
it("rejects payment or CRM capabilities not granted to public visitors",async()=>{
  expect(studioInquirySchema.safeParse({...lead,stage:"WON"}).success).toBe(false);
  await expect(studioInquiryRoute(new Request(uri),s,cfg)).rejects.toMatchObject({status:401});
  await expect(studioInquiryRoute(post(lead,"https://elsewhere.example"),s,cfg)).rejects.toMatchObject({status:403});
});
it("stays disabled with a missing verified legal/public anti-bot configuration",async()=>{
  vi.stubEnv("AD_PUBLIC_ENQUIRIES_ENABLED","0");
  const status=await studioInquiryRoute(new Request(cfg.app+"/api/studio/availability"),s,cfg);
  expect((await status.json()).available).toBe(false);
  await expect(studioInquiryRoute(post(),s,cfg)).rejects.toMatchObject({status:503});
});
it("does not infer VAT regime or enable public intake without EI and a valid-length SIRET",async()=>{
  vi.stubEnv("AD_BUSINESS_SIRET","unconfirmed");
  const status=await studioInquiryRoute(new Request(cfg.app+"/api/studio/availability"),s,cfg);
  expect((await status.json()).available).toBe(false);
  await expect(studioInquiryRoute(post(),s,cfg)).rejects.toMatchObject({status:503});
});
it("rejects spoofed captcha host and stores no lead",async()=>{
  vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({success:true,hostname:"other.example"}))));
  await expect(studioInquiryRoute(post(),s,cfg)).rejects.toMatchObject({status:403});
  expect((await s.query("SELECT id FROM ad_studio_inquiries")).length).toBe(0);
});
it("accepts a verified application, records it privately, and never fabricates a booking/payment",async()=>{
  const response=await studioInquiryRoute(post(),s,cfg);
  const body=await response.json();
  expect(response.status).toBe(202);
  expect(body.received).toBe(true);
  const rows=await s.query("SELECT stage,brand,marketing_opt_in FROM ad_studio_inquiries");
  expect(rows[0]).toMatchObject({stage:"NEW",brand:"Maison de test",marketing_opt_in:false});
  const inbox=await studioInquiryRoute(new Request(uri,{headers:{cookie:"__Host-ad_session=owner-session"}}),s,cfg);
  const data=await inbox.json();
  expect(data.items).toHaveLength(1);
  expect(data.items[0].id).toBe(body.reference);
  expect(data.items[0].stage).toBe("NEW");
  expect(data.items[0]).not.toHaveProperty("payment_status");
});
it("owner stage transition needs CSRF and exact expected previous state",async()=>{
  const response=await studioInquiryRoute(post(),s,cfg);
  const id=(await response.json()).reference as string;
  const input={id,expectedStage:"NEW",stage:"QUALIFIED",note:"Contact confirmé"};
  const ownerRequest=(csrf:string)=>new Request(uri,{method:"PATCH",headers:{
    "content-type":"application/json",origin:cfg.app,cookie:"__Host-ad_session=owner-session",
    "x-ad-csrf":csrf},body:JSON.stringify(input)});
  await expect(studioInquiryRoute(ownerRequest("invalid"),s,cfg)).rejects.toMatchObject({status:403});
  const change=await studioInquiryRoute(ownerRequest("fixture-csrf"),s,cfg);
  expect((await change.json()).item.stage).toBe("QUALIFIED");
  await expect(studioInquiryRoute(ownerRequest("fixture-csrf"),s,cfg)).rejects.toMatchObject({status:409});
});
it("honours global/email rate limit without saving a fourth enquiry",async()=>{
  for(let i=0;i<3;i++)expect((await studioInquiryRoute(post(),s,cfg)).status).toBe(202);
  await expect(studioInquiryRoute(post(),s,cfg)).rejects.toMatchObject({status:429});
  expect((await s.query("SELECT id FROM ad_studio_inquiries")).length).toBe(3);
});
