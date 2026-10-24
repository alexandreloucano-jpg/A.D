import { z } from "zod";
import { workspaceSchema } from "../src/domain.js";
import { owner, type Config } from "./security.js";
import { ServiceError, type Store } from "./store.js";

const MAX_BYTES = 8_000_000; // conservative API payload budget; local backup may be larger
const requestSchema = z.object({
  expectedServerRevision:z.number().int().min(0).max(100_000_000),
  workspace:workspaceSchema,
  explicitUserAction:z.literal(true),
}).strict();
const json = (body:unknown,status=200)=>new Response(JSON.stringify(body),{
  status,headers:{"content-type":"application/json","cache-control":"private, no-store"},
});
export async function workspaceSyncRoute(r:Request,s:Store,c:Config) {
  if(process.env.AD_WORKSPACE_SYNC_ENABLED!=="1")
    throw new ServiceError(503,"workspace_sync_not_configured");
  const session=await owner(r,s,c,r.method!=="GET");
  const path=new URL(r.url).pathname;
  if(path!=="/api/workspace/snapshot") throw new ServiceError(404,"not_found");
  if(r.method==="GET"){
    const [row]=await s.query(
      "SELECT server_revision,workspace,updated_at FROM ad_workspace_head WHERE owner_id=$1",
      [session.owner]);
    if(!row)return json({exists:false,serverRevision:0,workspace:null,updatedAt:null});
    return json({
      exists:true,
      serverRevision:Number(row.server_revision),
      workspace:workspaceSchema.parse(row.workspace),
      updatedAt:row.updated_at,
    });
  }
  if(r.method!=="POST")throw new ServiceError(405,"method_not_allowed");
  const raw=await r.text();
  if(Buffer.byteLength(raw,"utf8")>MAX_BYTES)throw new ServiceError(413,"workspace_too_large");
  let body:unknown;
  try{body=JSON.parse(raw)}catch{throw new ServiceError(400,"invalid_json");}
  const payload=requestSchema.parse(body);
  // Keep the server from accidentally wiping a nonempty work history via an empty client.
  // Empty initial workspaces are not worth uploading.
  if(payload.workspace.projects.length===0 &&
     payload.workspace.tasks.length===0 &&
     (payload.workspace.creativeBoards?.length??0)===0 &&
     payload.workspace.signals.length===0 &&
     payload.workspace.references.length===0)
    throw new ServiceError(409,"empty_workspace_would_erase_history");
  await s.quota("workspace-sync:"+session.owner,45,3600);
  const [write]=await s.query(
    `WITH advanced AS (
       INSERT INTO ad_workspace_head(owner_id,server_revision,workspace)
       VALUES($1,1,$3::jsonb)
       ON CONFLICT (owner_id) DO UPDATE
         SET server_revision=ad_workspace_head.server_revision+1,
             workspace=EXCLUDED.workspace,
             updated_at=now()
       WHERE ad_workspace_head.server_revision=$2
       RETURNING owner_id,server_revision,workspace,updated_at
     ), version AS (
       INSERT INTO ad_workspace_history(owner_id,server_revision,workspace)
       SELECT owner_id,server_revision,workspace FROM advanced
       RETURNING server_revision
     )
     SELECT a.server_revision,a.workspace,a.updated_at
     FROM advanced a JOIN version v USING(server_revision)`,
    [session.owner,payload.expectedServerRevision,JSON.stringify(payload.workspace)]
  );
  if(!write)throw new ServiceError(409,"workspace_cloud_conflict");
  const stored=workspaceSchema.parse(write.workspace);
  if(JSON.stringify(stored)!==JSON.stringify(payload.workspace))
    throw new ServiceError(503,"workspace_readback_mismatch");
  await s.audit(session.owner,"owner","workspace_snapshot_saved","verified");
  return json({
    saved:true,
    serverRevision:Number(write.server_revision),
    workspace:stored,
    updatedAt:write.updated_at,
  });
}
