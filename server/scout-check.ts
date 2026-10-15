import { randomUUID, createHash } from "node:crypto";
import { Store, ServiceError, digest } from "./store.js";
import {
  owner,
  opaque,
  resource,
  equal,
  cookie,
  type Config,
  type Client,
} from "./security.js";
import { seal, unseal } from "./secrets.js";
import { SCOUT_TOOLS } from "../src/domain.js";
type Pending = {
  owner: string;
  sessionHash: string;
  clientId: string;
  secret: string;
  verifier: string;
};
const json = (v: unknown) =>
  new Response(JSON.stringify(v), {
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
async function remoteJson(url: string, init: RequestInit) {
  let r: Response;
  try {
    r = await fetch(url, {
      ...init,
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new ServiceError(502, "scout_check_unreachable");
  }
  if (!r.ok || !r.headers.get("content-type")?.includes("application/json"))
    throw new ServiceError(502, "scout_check_http_" + r.status);
  return r.json();
}
export async function scoutCheckRoute(r: Request, s: Store, c: Config) {
  const path = new URL(r.url).pathname,
    session = await owner(r, s, c, r.method === "POST");
  if (c.gateway === c.app)
    throw new ServiceError(503, "dedicated_gateway_not_configured");
  if (path === "/api/scout/check/status" && r.method === "GET")
    return json({ check: await s.get("scout-check-result", session.owner) });
  const callback = c.app + "/api/scout/check/callback";
  if (path === "/api/scout/check/start" && r.method === "POST") {
    await s.quota("scout-check:" + session.owner, 3, 3600);
    const clientId = randomUUID(),
      secret = opaque(),
      verifier = opaque(),
      state = opaque();
    await s.put("client", clientId, {
      id: clientId,
      name: "Diagnostic de lecture MCP A.D",
      owner: session.owner,
      resource: resource(c),
      secretHash: digest(secret),
      redirects: [callback],
      revoked: false,
    });
    await s.put(
      "scout-check-state",
      digest(state),
      seal(
        {
          owner: session.owner,
          sessionHash: digest(cookie(r, "__Host-ad_session")),
          clientId,
          secret,
          verifier,
        },
        "scout-check:" + session.owner,
      ),
      600,
    );
    const url = new URL(c.app + "/api/oauth/authorize");
    url.search = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: callback,
      resource: resource(c),
      scope: "saver:read saver:write",
      code_challenge_method: "S256",
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      state,
    }).toString();
    return json({ url: url.href });
  }
  if (path !== "/api/scout/check/callback" || r.method !== "GET")
    throw new ServiceError(405, "method_not_allowed");
  const q = new URL(r.url).searchParams,
    raw = await s.take<string>(
      "scout-check-state",
      digest(q.get("state") || ""),
    );
  if (!raw) throw new ServiceError(401, "scout_check_state_expired");
  const pending = unseal<Pending>(raw, "scout-check:" + session.owner);
  if (
    pending.owner !== session.owner ||
    !equal(pending.sessionHash, digest(cookie(r, "__Host-ad_session")))
  )
    throw new ServiceError(401, "scout_check_session_mismatch");
  let access = "";
  try {
    if (q.has("error"))
      throw new ServiceError(403, "scout_check_consent_denied");
    const token = await remoteJson(c.gateway + "/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: pending.clientId,
        client_secret: pending.secret,
        code: q.get("code") || "",
        code_verifier: pending.verifier,
        redirect_uri: callback,
        resource: resource(c),
      }),
    });
    if (typeof token.access_token !== "string" || !token.access_token)
      throw new ServiceError(502, "scout_check_token_missing");
    access = token.access_token;
    const call = (method: string, params: unknown, id: number) =>
      remoteJson(resource(c), {
        method: "POST",
        headers: {
          authorization: "Bearer " + access,
          "content-type": "application/json",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      });
    const init = await call(
      "initialize",
      {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "AD-owner-diagnostic", version: "1.0.0" },
      },
      1,
    );
    if (!init.result?.serverInfo)
      throw new ServiceError(502, "scout_check_initialize_failed");
    const tools = await call("tools/list", {}, 2);
    if (
      JSON.stringify(
        tools.result?.tools?.map((t: { name: string }) => t.name).sort(),
      ) !== JSON.stringify([...SCOUT_TOOLS].sort())
    )
      throw new ServiceError(502, "scout_check_tool_boundary_failed");
    const read = await call(
      "tools/call",
      { name: "get_saved_inspiration", arguments: { query: "" } },
      3,
    );
    if (read.error || read.result?.isError)
      throw new ServiceError(502, "scout_check_read_failed");
    const data =
      read.result?.structuredContent ??
      JSON.parse(read.result?.content?.[0]?.text || "{}");
    if (!Array.isArray(data.references))
      throw new ServiceError(502, "scout_check_read_invalid");
    const denied = await call(
      "tools/call",
      { name: "list_projects", arguments: {} },
      4,
    );
    if (!denied.error)
      throw new ServiceError(502, "scout_check_global_tool_not_denied");
    await s.put("scout-check-result", session.owner, {
      verified: false,
      readVerified: true,
      authenticated: true,
      referenceCount: data.references.length,
      sampleUuid: data.references[0]?.id || null,
      onlyFourSaverTools: true,
      globalToolDenied: true,
      resource: resource(c),
      checkedAt: new Date().toISOString(),
      grokConnected: false,
      temporaryClientRevoked: false,
    });
    await s.audit(session.owner, pending.clientId, "scout_check", "verified");
  } catch (e) {
    await s.put("scout-check-result", session.owner, {
      verified: false,
      error: e instanceof ServiceError ? e.code : "scout_check_failed",
      checkedAt: new Date().toISOString(),
    });
  } finally {
    if (access) await s.remove("token", digest(access));
    const client = await s.get<Client>("client", pending.clientId);
    if (client)
      await s.put("client", pending.clientId, { ...client, revoked: true });
  }
  const result = await s.get<{ readVerified?: boolean }>(
    "scout-check-result",
    session.owner,
  );
  const finalClient = await s.get<Client>("client", pending.clientId);
  const revoked =
    !!finalClient?.revoked &&
    (!access || !(await s.get("token", digest(access))));
  if (result?.readVerified && revoked)
    await s.put("scout-check-result", session.owner, {
      ...result,
      verified: true,
      temporaryClientRevoked: true,
    });
  return new Response(null, {
    status: 303,
    headers: {
      location: c.app + "/#/saver?scoutcheck=complete",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
    },
  });
}
