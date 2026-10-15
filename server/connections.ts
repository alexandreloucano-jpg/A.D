import { Store, ServiceError } from "./store.js";
import { owner, resource, type Config, type Client } from "./security.js";
import { GROK_CALLBACK } from "./registration.js";
export async function grokConnection(r: Request, s: Store, c: Config) {
  const session = await owner(r, s, c, r.method !== "GET");
  const clients = await s.query(
    "SELECT key,data FROM ad_records WHERE namespace='client' AND data->>'owner'=$1 AND data->>'resource'=$2 AND data->'redirects' ? $3 AND COALESCE((data->>'revoked')::boolean,false)=false",
    [session.owner, resource(c), GROK_CALLBACK],
  );
  const clientIds = clients.map((row) => String(row.key));
  if (r.method === "DELETE") {
    for (const row of clients)
      await s.put("client", String(row.key), {
        ...(row.data as Client),
        revoked: true,
      });
    await s.query(
      "DELETE FROM ad_records WHERE namespace IN ('token','refresh','authorization','code') AND data->>'owner'=$1 AND data->>'resource'=$2 AND data->>'clientId'=ANY($3::text[])",
      [session.owner, resource(c), clientIds],
    );
    await s.audit(session.owner, "owner", "grok_disconnect", "revoked");
    return Response.json(
      { disconnected: true, referencesPreserved: true },
      { headers: { "cache-control": "no-store" } },
    );
  }
  if (r.method !== "GET") throw new ServiceError(405, "method_not_allowed");
  const configured = c.gateway !== c.app && c.redirects.includes(GROK_CALLBACK);
  const grants = await s.query(
    "SELECT DISTINCT data->>'clientId' AS client_id FROM ad_records WHERE namespace IN ('token','refresh') AND data->>'owner'=$1 AND data->>'resource'=$2 AND data->>'scope'='saver:read saver:write' AND expires_at>now() AND data->>'clientId'=ANY($3::text[])",
    [session.owner, resource(c), clientIds],
  );
  // A registration, consent or token alone is not a verified consumer exchange.
  const activeIds = grants.map((row) => String(row.client_id));
  const [proof] = await s.query(
    "SELECT r.outcome,r.created_at AS checked_at FROM ad_audit r WHERE r.owner_id=$1 AND r.principal=ANY($2::text[]) AND r.operation='get_saver_capture' AND r.outcome ~ '^verified:[0-9a-f-]{36}$' AND EXISTS(SELECT 1 FROM ad_audit w WHERE w.owner_id=r.owner_id AND w.principal=r.principal AND w.outcome=r.outcome AND w.operation IN ('save_inspiration_reference','save_reference_batch') AND w.created_at<=r.created_at) ORDER BY r.created_at DESC LIMIT 1",
    [session.owner, activeIds],
  );
  const proofId = proof ? String(proof.outcome).slice("verified:".length) : "";
  const readback = proofId ? await s.read(session.owner, proofId) : null;
  const [pending] = await s.query(
    "SELECT count(*)::int AS count FROM ad_records WHERE namespace='authorization' AND data->>'owner'=$1 AND data->>'resource'=$2 AND data->>'clientId'=ANY($3::text[]) AND expires_at>now()",
    [session.owner, resource(c), clientIds],
  );
  const [history] = await s.query(
    "SELECT count(*)::int AS count FROM ad_audit WHERE owner_id=$1 AND principal=ANY($2::text[]) AND operation='oauth_consent' AND outcome='approved'",
    [session.owner, clientIds],
  );
  const connected =
    activeIds.length > 0 &&
    !!proof?.checked_at &&
    !!readback &&
    !readback.isInternalQA &&
    !readback.projectId;
  const state = !configured
    ? "not_configured"
    : connected
      ? "connected"
      : activeIds.length
        ? "verification_required"
        : Number(pending?.count)
          ? "consent_required"
          : Number(history?.count)
            ? "expired"
            : "ready";
  return Response.json(
    {
      configured,
      connected,
      state,
      hasAccount: clientIds.length > 0,
      permissions: ["saver:read", "saver:write"],
      lastVerifiedAt: connected ? proof?.checked_at : null,
      verifiedUuid: connected ? proofId : null,
      automaticRegistration: true,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
