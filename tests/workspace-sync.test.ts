import { afterAll,beforeAll,beforeEach,describe,expect,it,vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { Store,digest } from "../server/store";
import { workspaceSyncRoute } from "../server/workspace-sync";
import { emptyWorkspace, type Workspace } from "../src/domain";
import type { Config } from "../server/security";
const c:Config={role:"app",app:"https://ad.example",gateway:"https://gateway.example",owner:"fixture-owner",githubClient:"",githubSecret:"",redirects:[]};
let pg:PGlite,s:Store;
beforeAll(async()=>{
  pg=new PGlite();
  await pg.exec(await readFile("sql/001-private-saver.sql","utf8"));
  await pg.exec(await readFile("sql/009-v3-workspace-sync.sql","utf8"));
  s=new Store(async(sql,p=[])=>(await pg.query(sql,p)).rows as Record<string,unknown>[]);
},30000);
beforeEach(async()=>{
  await pg.exec("TRUNCATE ad_workspace_head, ad_workspace_history, ad_records,ad_quota,ad_audit");
  vi.stubEnv("AD_WORKSPACE_SYNC_ENABLED","1");
  await s.put("session",digest("owner-session"),{owner:c.owner,csrf:"fixture-csrf"},3600);
});
afterAll(async()=>pg.close());
const local=(title="Maison indépendante"):Workspace=>{
  const a=emptyWorkspace();
  a.projects=[{id:"7acecbaa-b601-4023-a285-26b8a837e8f0",title,updatedAt:new Date().toISOString()}];
  return a;
};
function write(workspace=local(),revision=0,headers:Record<string,string>={}){
  return new Request(c.app+"/api/workspace/snapshot",{
    method:"POST",headers:{"content-type":"application/json",
      origin:c.app,cookie:"__Host-ad_session=owner-session",
      "x-ad-csrf":"fixture-csrf",...headers},
    body:JSON.stringify({workspace,expectedServerRevision:revision,explicitUserAction:true})
  });
}
function read(headers:Record<string,string>={}){
  return new Request(c.app+"/api/workspace/snapshot",{
    headers:{cookie:"__Host-ad_session=owner-session",...headers}
  });
}
describe("Private A.D V3 cloud snapshots",()=>{
  it("starts absent, never invents or auto-imports content",async()=>{
    const r=await workspaceSyncRoute(read(),s,c);
    expect(await r.json()).toMatchObject({exists:false,serverRevision:0,workspace:null});
    expect((await s.query("SELECT * FROM ad_workspace_head")).length).toBe(0);
  });
  it("preserves an immutable version after verified atomic first write",async()=>{
    const a=await workspaceSyncRoute(write(),s,c);
    const v=await a.json();
    expect(v.saved).toBe(true);expect(v.serverRevision).toBe(1);
    const readback=await (await workspaceSyncRoute(read(),s,c)).json();
    expect(readback.workspace.projects[0].title).toBe("Maison indépendante");
    const versions=await s.query("SELECT server_revision,workspace FROM ad_workspace_history ORDER BY server_revision");
    expect(versions).toHaveLength(1);
    expect(versions[0].workspace).toEqual(readback.workspace);
  });
  it("rejects stale device writers without deleting the newest version",async()=>{
    await workspaceSyncRoute(write(),s,c);
    const newer=await workspaceSyncRoute(write(local("Maison v2"),1),s,c);
    expect((await newer.json()).serverRevision).toBe(2);
    await expect(workspaceSyncRoute(write(local("Old device"),1),s,c)).rejects.toMatchObject({
      status:409,code:"workspace_cloud_conflict"
    });
    const current=await (await workspaceSyncRoute(read(),s,c)).json();
    expect(current.workspace.projects[0].title).toBe("Maison v2");
    const h=await s.query("SELECT workspace FROM ad_workspace_history ORDER BY server_revision");
    expect(h.map(v=>(v.workspace as Workspace).projects[0].title)).toEqual(["Maison indépendante","Maison v2"]);
  });
  it("requires owner auth, CSRF, same origin and human-initiated upload",async()=>{
    await expect(workspaceSyncRoute(new Request(c.app+"/api/workspace/snapshot"),s,c)).rejects.toMatchObject({status:401});
    await expect(workspaceSyncRoute(write(local(),0,{"x-ad-csrf":"bad"}),s,c)).rejects.toMatchObject({status:403});
    await expect(workspaceSyncRoute(write(local(),0,{origin:"https://attacker.example"}),s,c)).rejects.toMatchObject({status:403});
    const withoutConfirmation=new Request(c.app+"/api/workspace/snapshot",{
      method:"POST",headers:{origin:c.app,cookie:"__Host-ad_session=owner-session","x-ad-csrf":"fixture-csrf"},
      body:JSON.stringify({workspace:local(),expectedServerRevision:0,explicitUserAction:false})
    });
    await expect(workspaceSyncRoute(withoutConfirmation,s,c)).rejects.toThrow();
    expect((await s.query("SELECT * FROM ad_workspace_head"))).toHaveLength(0);
  });
  it("cannot replace an existing archive with an empty local workspace",async()=>{
    await workspaceSyncRoute(write(),s,c);
    await expect(workspaceSyncRoute(write(emptyWorkspace(),1),s,c)).rejects.toMatchObject({status:409});
    expect((await s.query("SELECT server_revision FROM ad_workspace_head"))[0].server_revision).toBe(1);
  });
  it("gates API until migration/configuration approved",async()=>{
    vi.stubEnv("AD_WORKSPACE_SYNC_ENABLED","0");
    await expect(workspaceSyncRoute(read(),s,c)).rejects.toMatchObject({status:503});
  });
  it("does not expose another owner's backup in owner route",async()=>{
    await workspaceSyncRoute(write(),s,c);
    const other={...c,owner:"another-owner"};
    await expect(workspaceSyncRoute(read(),s,other)).rejects.toMatchObject({status:401});
  });
});
