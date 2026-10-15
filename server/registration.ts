import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Store, ServiceError, digest } from "./store.js";
import { opaque, resource, type Config, type Client } from "./security.js";
export const GROK_CALLBACK = "https://grok.com/connectors-oauth-exchange-code/";
const schema = z
  .object({
    client_name: z.string().trim().min(1).max(100).default("Grok Scout"),
    redirect_uris: z.array(z.literal(GROK_CALLBACK)).length(1),
    token_endpoint_auth_method: z
      .enum(["none", "client_secret_post", "client_secret_basic"])
      .default("client_secret_post"),
    grant_types: z
      .array(z.enum(["authorization_code", "refresh_token"]))
      .min(1)
      .max(2)
      .optional(),
    response_types: z.array(z.literal("code")).length(1).optional(),
    scope: z.string().optional(),
    // Never fetch a client-controlled URL (no SSRF or discovery side effects).
    client_uri: z.string().url().optional(),
    logo_uri: z.string().url().optional(),
  })
  .strip();
export async function registerClient(r: Request, s: Store, c: Config) {
  if (c.role !== "gateway") throw new ServiceError(404, "not_found");
  if (r.method !== "POST") throw new ServiceError(405, "method_not_allowed");
  if (
    !r.headers.get("content-type")?.toLowerCase().startsWith("application/json")
  )
    throw new ServiceError(415, "json_required");
  const raw = await r.text();
  if (Buffer.byteLength(raw) > 8192)
    throw new ServiceError(413, "request_too_large");
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new ServiceError(400, "invalid_client_metadata");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ServiceError(400, "invalid_client_metadata");
  const input = parsed.data;
  if (input.grant_types && !input.grant_types.includes("authorization_code"))
    throw new ServiceError(400, "invalid_client_metadata");
  if (
    input.scope &&
    input.scope.split(/\s+/).filter(Boolean).sort().join(" ") !==
      "saver:read saver:write"
  )
    throw new ServiceError(400, "invalid_scope");
  await s.quota("dcr-hour:" + c.owner, 10, 3600);
  await s.quota("dcr-day:" + c.owner, 40, 86400);
  const clientId = randomUUID(),
    secret = input.token_endpoint_auth_method === "none" ? "" : opaque();
  const client: Client = {
    id: clientId,
    name: input.client_name,
    secretHash: secret ? digest(secret) : "",
    redirects: [GROK_CALLBACK],
    revoked: false,
    owner: c.owner,
    resource: resource(c),
    registration: "dynamic",
    authMethod: input.token_endpoint_auth_method,
    refreshAllowed: true,
    defaultScope: "saver:read saver:write",
  };
  await s.query(
    "INSERT INTO ad_records(namespace,key,data) VALUES('client',$1,$2::jsonb)",
    [clientId, JSON.stringify(client)],
  );
  const read = await s.get<Client>("client", clientId);
  if (!read || read.secretHash !== client.secretHash)
    throw new ServiceError(503, "client_registration_unverified");
  await s.audit(c.owner, clientId, "client_register", "registered");
  return Response.json(
    {
      client_id: clientId,
      ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: input.client_name,
      redirect_uris: client.redirects,
      token_endpoint_auth_method: client.authMethod,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: client.defaultScope,
    },
    {
      status: 201,
      headers: {
        "cache-control": "no-store",
        pragma: "no-cache",
        "referrer-policy": "no-referrer",
      },
    },
  );
}
