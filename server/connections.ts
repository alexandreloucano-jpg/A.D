import { Store, ServiceError } from "./store.js";
import { owner, resource, type Config, type Client } from "./security.js";
import { GROK_CALLBACK } from "./registration.js";
export async function grokConnection(r: Request, s: Store, c: Config) {
  const session = await owner(r, s, c, r.method !== "GET");
  const clients = await s.query(
    "SELECT key,data FROM ad_records WHERE namespace='client' AND data->>'owner'=$1 AND data->>'resource'=$2 AND data->'redirects' ? $3 AND COALESCE((data->>'revoked')::boolean,false)=false",
    [session.owner, resource(c), GROK_CALLBACK],
  );
  if (r.method === "DELETE") {
    for (const row of clients) {
      const client = row.data as Client;
      await s.put("client", String(row.key), { ...client, revoked: true });
    }
    await s.query(
      "DELETE FROM ad_records WHERE namespace IN ('token','refresh') AND data->>'owner'=$1 AND data->>'resource'=$2 AND data->>'clientId'=ANY($3::text[])",
      [session.owner, resource(c), clients.map((row) => String(row.key))],
    );
    await s.audit(session.owner, "owner", "grok_disconnect", "revoked");
    return Response.json(
      { disconnected: true, referencesPreserved: true },
      { headers: { "cache-control": "no-store" } },
    );
  }
  if (r.method !== "GET") throw new ServiceError(405, "method_not_allowed");
  const rows = await s.query(
    "SELECT count(*)::int AS active FROM ad_records WHERE namespace IN ('token','refresh') AND data->>'owner'=$1 AND data->>'resource'=$2 AND expires_at>now() AND data->>'clientId'=ANY($3::text[])",
    [session.owner, resource(c), clients.map((row) => String(row.key))],
  );
  return Response.json(
    {
      connected: Number(rows[0]?.active || 0) > 0,
      automaticRegistration: true,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
