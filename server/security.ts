import { randomBytes, timingSafeEqual } from "node:crypto";
import { Store, ServiceError, digest } from "./store.js";
export interface Config {
  role: "app" | "gateway";
  app: string;
  gateway: string;
  owner: string;
  githubClient: string;
  githubSecret: string;
  redirects: string[];
}
export const opaque = () => randomBytes(32).toString("base64url");
export const equal = (a: string, b: string) => {
  const left = Buffer.from(a),
    right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
export function configuration(): Config {
  const origin = (key: string) => {
    const raw = process.env[key];
    if (!raw) throw new ServiceError(503, "service_not_configured");
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.origin !== raw)
      throw new ServiceError(503, "invalid_service_origin");
    return raw;
  };
  const role = process.env.AD_SERVICE_ROLE;
  if (role !== "app" && role !== "gateway")
    throw new ServiceError(503, "service_role_not_configured");
  return {
    role,
    app: origin("APP_ORIGIN"),
    gateway: origin("GATEWAY_ORIGIN"),
    owner: "340639438",
    githubClient: process.env.GITHUB_OAUTH_CLIENT_ID || "",
    githubSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET || "",
    redirects: [
      origin("APP_ORIGIN") + "/api/scout/check/callback",
      ...(process.env.SCOUT_REDIRECT_URIS || "").split(",").filter(Boolean),
    ],
  };
}
export interface Session {
  owner: string;
  csrf: string;
  authMethod?: "github" | "google";
  googleBinding?: string;
}
export interface Client {
  id: string;
  name: string;
  secretHash: string;
  redirects: string[];
  revoked: boolean;
}
export interface Grant {
  owner: string;
  clientId: string;
  resource: string;
  scope: string;
}
export interface Code extends Grant {
  redirect: string;
  challenge: string;
}
export interface Authorization extends Code {
  state: string;
}
export function resource(c: Config) {
  return c.gateway + "/mcp";
}
export function cookie(request: Request, name: string) {
  return (
    (request.headers.get("cookie") || "")
      .split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith(name + "="))
      ?.slice(name.length + 1) || ""
  );
}
export async function owner(
  request: Request,
  store: Store,
  c: Config,
  csrf = false,
) {
  if (c.role !== "app" || request.headers.has("authorization"))
    throw new ServiceError(401, "owner_session_required");
  const token = cookie(request, "__Host-ad_session");
  const session = token
    ? await store.get<Session>("session", digest(token))
    : null;
  if (!session || session.owner !== c.owner)
    throw new ServiceError(
      401,
      token ? "owner_session_expired" : "owner_session_required",
    );
  if (session.authMethod === "google") {
    const binding = await store.get<{
      sub: string;
      client: string;
      linkedAt: string;
    }>("google-owner", c.owner);
    if (
      !binding ||
      !session.googleBinding ||
      !equal(
        session.googleBinding,
        digest(JSON.stringify([binding.sub, binding.client, binding.linkedAt])),
      )
    )
      throw new ServiceError(401, "owner_session_expired");
  }
  if (csrf) {
    requireSameOrigin(request, c);
    requireCsrf(request.headers.get("x-ad-csrf") || "", session);
  }
  return session;
}
// Exact origin checks also apply to HTML forms; never accept Origin: null.
export function requireSameOrigin(request: Request, c: Config) {
  if (new URL(request.url).origin !== c.app)
    throw new ServiceError(403, "form_domain_mismatch");
  const origin = request.headers.get("origin");
  if (!origin) throw new ServiceError(403, "csrf_origin_missing");
  if (origin === "null") throw new ServiceError(403, "csrf_origin_opaque");
  if (origin !== c.app) throw new ServiceError(403, "csrf_origin_mismatch");
}
export function requireCsrf(value: string, session: Session) {
  if (!value) throw new ServiceError(403, "csrf_token_missing");
  if (!equal(value, session.csrf))
    throw new ServiceError(403, "csrf_token_invalid");
}
export async function scout(request: Request, store: Store, c: Config) {
  if (c.role !== "gateway") throw new ServiceError(401, "wrong_resource");
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(
    request.headers.get("authorization") || "",
  );
  const key = match ? digest(match[1]) : "";
  const grant = key ? await store.get<Grant>("token", key) : null;
  if (
    !grant ||
    grant.owner !== c.owner ||
    grant.resource !== resource(c) ||
    grant.scope !== "saver:read saver:write"
  )
    throw new ServiceError(401, "invalid_token");
  const client = await store.get<Client>("client", grant.clientId);
  if (!client || client.revoked) throw new ServiceError(401, "revoked_client");
  return { ...grant, tokenHash: key };
}
export function redirectAllowed(value: string, c: Config) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.hash &&
      !url.username &&
      !url.password &&
      c.redirects.includes(value)
    );
  } catch {
    return false;
  }
}
