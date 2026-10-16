import { intakeRoute } from "./intake.js";
import {
  mcpProtocol,
  mcpDiscoveryLog,
  MCP_LEGACY_VERSIONS,
  MCP_SUPPORTED_VERSIONS,
  MCP_SERVER_INFO,
} from "./mcp-protocol.js";
import { relayConnections } from "./job-relay.js";
import { automationRoute } from "./automation.js";
import { grokConnection } from "./connections.js";
import { registerClient } from "./registration.js";
import { instagramRoute } from "./instagram.js";
import { googleRoute } from "./google.js";
import { scoutCheckRoute } from "./scout-check.js";
import { classificationRoute } from "./ai.js";
import { tasteRoute } from "./taste.js";
import { extractRoute, originalRoute } from "./extraction.js";
import { xRoute } from "./x.js";
import { collectionsRoute } from "./collections.js";
import { readerRoute } from "./reader.js";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { referenceSchema, safeUrl, SCOUT_TOOLS } from "../src/domain.js";
import { Store, ServiceError, digest } from "./store.js";
import {
  requireSameOrigin,
  requireCsrf,
  configuration,
  resource,
  opaque,
  equal,
  cookie,
  owner,
  scout,
  redirectAllowed,
  type Config,
  type Session,
  type Client,
  type Grant,
  type Code,
  type Authorization,
} from "./security.js";
const id = z.string().uuid();
const text = z.string().trim().min(1).max(10000);
const capture = z
  .object({
    id: id.optional(),
    title: text,
    content: z.string().max(10000).default(""),
    url: safeUrl,
    owner_approved: z.literal(true),
  })
  .strict();
const headers = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};
function json(data: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "content-type": "application/json", ...extra },
  });
}
function redirect(url: string, extra: Record<string, string> = {}) {
  return new Response(null, {
    status: 303,
    headers: { ...headers, location: url, ...extra },
  });
}
const htmlEscape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (v) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        v
      ]!,
  );
function html(s: string, status = 200, callbackOrigin = "") {
  return new Response(s, {
    status,
    headers: {
      ...headers,
      "content-type": "text/html; charset=utf-8",
      "referrer-policy": "same-origin",
      "content-security-policy": `default-src 'none'; form-action 'self'${callbackOrigin ? " " + callbackOrigin : ""}; frame-ancestors 'none'; base-uri 'none'`,
      "x-frame-options": "DENY",
    },
  });
}
function method(r: Request, wanted: string) {
  if (r.method !== wanted) throw new ServiceError(405, "method_not_allowed");
}
async function body(r: Request) {
  const raw = await r.text();
  if (Buffer.byteLength(raw) > 512000)
    throw new ServiceError(413, "request_too_large");
  try {
    return JSON.parse(raw);
  } catch {
    throw new ServiceError(400, "invalid_json");
  }
}
async function form(r: Request) {
  const raw = await r.text();
  if (Buffer.byteLength(raw) > 16384)
    throw new ServiceError(413, "request_too_large");
  return new URLSearchParams(raw);
}
function sessionCookie(name: string, value: string, age: number) {
  return `${name}=${value}; Path=/; Max-Age=${age}; Secure; HttpOnly; SameSite=Lax`;
}
function canonicalRequest(request: Request, c: Config, path: string) {
  const expected = c.role === "app" ? c.app : c.gateway;
  const u = new URL(request.url);
  if (u.origin !== expected) {
    if (request.method === "GET" || request.method === "HEAD")
      return redirect(expected + u.pathname + u.search);
    throw new ServiceError(403, "form_domain_mismatch");
  }
  if (path.startsWith("/api/scout") && c.role !== "app")
    throw new ServiceError(404, "not_found");
}
export async function handle(
  request: Request,
  store: Store,
  c: Config = configuration(),
): Promise<Response> {
  const path = new URL(request.url).pathname;
  try {
    return await route(request, store, c, path);
  } catch (e) {
    const status =
      e instanceof ServiceError
        ? e.status
        : e instanceof z.ZodError
          ? 400
          : 503;
    const error =
      e instanceof ServiceError
        ? e.code
        : e instanceof z.ZodError
          ? "invalid_request"
          : "temporarily_unavailable";
    const extra: Record<string, string> = {};
    if (status === 401 && c.role === "gateway")
      extra["www-authenticate"] =
        `Bearer resource_metadata="${c.gateway}/.well-known/oauth-protected-resource", scope="saver:read saver:write"`;
    if (status === 429) extra["retry-after"] = "60";
    const requestId = randomUUID();
    // Deliberately exclude query strings, origins, cookies, bodies and credentials.
    console.warn(
      JSON.stringify({
        requestId,
        service: c.role,
        method: request.method,
        status,
        error,
      }),
    );
    return json(
      {
        error,
        retryable: status === 503 || status === 429,
        requestId,
      },
      status,
      extra,
    );
  }
}
async function route(
  r: Request,
  s: Store,
  c: Config,
  path: string,
): Promise<Response> {
  const canonical = canonicalRequest(r, c, path);
  if (canonical) return canonical;
  if (path === "/api/status") {
    method(r, "GET");
    return json({
      service: c.role,
      configured: !!c.githubClient,
      resource: c.role === "gateway" ? resource(c) : undefined,
    });
  }
  if (c.role === "app") {
    if (path === "/api/intake") return intakeRoute(r, s, c);
    if (path === "/api/admin/automation") {
      method(r, "GET");
      const session = await owner(r, s, c);
      return json({
        lastJob: await s.get("connection-job", session.owner),
        automaticRegistration: true,
      });
    }
    if (path === "/api/jobs/connections" || path === "/api/connections/sync")
      return automationRoute(r, s, c);
    if (path === "/api/connections/grok") return grokConnection(r, s, c);
    if (path.startsWith("/api/instagram/")) return instagramRoute(r, s, c);
    if (path.startsWith("/api/auth/google/")) return googleRoute(r, s, c);
    if (path.startsWith("/api/scout/check/")) return scoutCheckRoute(r, s, c);
    if (path === "/api/taste/context") return tasteRoute(r, s, c);
    if (path === "/api/scout/classify") return classificationRoute(r, s, c);
    if (path.startsWith("/api/x/")) return xRoute(r, s, c);
    if (path === "/api/collections") return collectionsRoute(r, s, c);
    const versionMatch =
      /^\/api\/reader\/([a-f0-9-]+)\/version\/([a-f0-9]{64})$/.exec(path);
    if (versionMatch) {
      method(r, "GET");
      const session = await owner(r, s, c);
      const referenceId = z.string().uuid().parse(versionMatch[1]);
      if (!(await s.read(session.owner, referenceId)))
        throw new ServiceError(404, "reference_not_found");
      const [row] = await s.query(
        "SELECT document FROM ad_reader_documents WHERE owner_id=$1 AND reference_id=$2 AND version=$3",
        [session.owner, referenceId, versionMatch[2]],
      );
      if (!row) throw new ServiceError(404, "document_version_not_found");
      return json({
        document: row.document,
        hasOriginal: !!(await s.get(
          "reader-extraction",
          session.owner + ":" + referenceId + ":" + versionMatch[2],
        )),
      });
    }
    const originalMatch = /^\/api\/reader\/([a-f0-9-]+)\/original$/.exec(path);
    if (originalMatch) {
      const session = await owner(r, s, c);
      const reference = await s.read(
        session.owner,
        z.string().uuid().parse(originalMatch[1]),
      );
      if (!reference) throw new ServiceError(404, "reference_not_found");
      return originalRoute(r, s, c, reference);
    }
    const extractMatch = /^\/api\/reader\/([a-f0-9-]+)\/extract$/.exec(path);
    if (extractMatch) {
      const session = await owner(r, s, c, true);
      const reference = await s.read(
        session.owner,
        z.string().uuid().parse(extractMatch[1]),
      );
      if (!reference) throw new ServiceError(404, "reference_not_found");
      return extractRoute(r, s, c, reference);
    }
    if (path.startsWith("/api/reader/")) return readerRoute(r, s, c);
    if (path === "/api/auth/login") {
      method(r, "GET");
      if (!c.githubClient || !c.githubSecret)
        throw new ServiceError(503, "owner_login_not_configured");
      const state = opaque(),
        browser = opaque();
      const pending = new URL(r.url).searchParams.get("pending") || "";
      await s.put(
        "login",
        digest(state),
        {
          browser: digest(browser),
          googleSetup: new URL(r.url).searchParams.get("return") === "google",
          pending: /^[A-Za-z0-9_-]{43}$/.test(pending) ? pending : "",
        },
        600,
      );
      const url = new URL("https://github.com/login/oauth/authorize");
      url.search = new URLSearchParams({
        client_id: c.githubClient,
        redirect_uri: c.app + "/api/auth/callback",
        scope: "read:user",
        state,
      }).toString();
      return redirect(url.href, {
        "set-cookie": sessionCookie("__Host-ad_login", browser, 600),
      });
    }
    if (path === "/api/auth/callback") {
      method(r, "GET");
      const p = new URL(r.url).searchParams,
        state = p.get("state") || "",
        code = p.get("code") || "";
      const login = await s.take<{
        browser: string;
        pending: string;
        googleSetup?: boolean;
      }>("login", digest(state));
      if (
        !login ||
        !equal(login.browser, digest(cookie(r, "__Host-ad_login"))) ||
        !code ||
        !c.githubClient ||
        !c.githubSecret
      )
        throw new ServiceError(401, "login_state_rejected");
      const tokenResponse = await fetch(
        "https://github.com/login/oauth/access_token",
        {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            client_id: c.githubClient,
            client_secret: c.githubSecret,
            code,
            redirect_uri: c.app + "/api/auth/callback",
          }),
          signal: AbortSignal.timeout(15000),
        },
      );
      const token = (await tokenResponse.json()) as { access_token?: string };
      if (!tokenResponse.ok || !token.access_token)
        throw new ServiceError(401, "github_login_failed");
      const profileResponse = await fetch("https://api.github.com/user", {
        headers: {
          authorization: "Bearer " + token.access_token,
          accept: "application/vnd.github+json",
          "user-agent": "AD-owner-login",
        },
        signal: AbortSignal.timeout(15000),
      });
      const profile = (await profileResponse.json()) as { id?: number };
      if (!profileResponse.ok || String(profile.id) !== c.owner)
        throw new ServiceError(403, "not_owner");
      const session = opaque();
      await s.put(
        "session",
        digest(session),
        { owner: c.owner, csrf: opaque(), authMethod: "github" },
        43200,
      );
      return redirect(
        c.app +
          (login.pending
            ? "/api/oauth/authorize?pending=" + login.pending
            : login.googleSetup
              ? "/api/auth/google/setup"
              : "/#/saver"),
        { "set-cookie": sessionCookie("__Host-ad_session", session, 43200) },
      );
    }
    if (path === "/api/session") {
      method(r, "GET");
      const session = await owner(r, s, c);
      return json({
        authenticated: true,
        csrf: session.csrf,
        ownerId: session.owner,
      });
    }
    if (path === "/api/auth/logout") {
      method(r, "POST");
      await owner(r, s, c, true);
      await s.remove("session", digest(cookie(r, "__Host-ad_session")));
      return json({ signedOut: true }, 200, {
        "set-cookie": sessionCookie("__Host-ad_session", "", 0),
      });
    }
    if (path === "/api/saver") {
      const session = await owner(r, s, c, r.method !== "GET");
      if (r.method === "GET") {
        const p = new URL(r.url).searchParams;
        const after = p.get("after") || "";
        if (after) id.parse(after);
        const rows = await s.list(
          session.owner,
          (p.get("query") || "").slice(0, 300),
          after,
          100,
        );
        if (session.authMethod === "google" && !after) {
          await s.put("saver-read-proof", session.owner, {
            owner: session.owner,
            authMethod: "google",
            verified: true,
            checkedAt: new Date().toISOString(),
            referenceCount: rows.length,
            sampleUuid: rows[0]?.id || null,
            paginated: rows.length === 100,
          });
        }
        return json({
          references: rows,
          next: rows.length === 100 ? rows.at(-1)!.id : null,
        });
      }
      method(r, "POST");
      await s.quota("owner-write:" + session.owner, 60);
      const reference = referenceSchema.parse(await body(r));
      const result = await s.save(session.owner, reference);
      await s.audit(session.owner, "owner", "save_reference", "verified");
      return json({ reference: result, verified: true }, 201);
    }
    if (path.startsWith("/api/saver/")) {
      method(r, "GET");
      const session = await owner(r, s, c);
      const ref = await s.read(
        session.owner,
        id.parse(path.slice("/api/saver/".length)),
      );
      if (!ref) throw new ServiceError(404, "reference_not_found");
      return json({ reference: ref });
    }
    if (path === "/api/migrate") {
      method(r, "POST");
      const session = await owner(r, s, c, true);
      await s.quota("migration:" + session.owner, 30);
      const input = z
        .object({ references: z.array(referenceSchema).max(20).min(1) })
        .strict()
        .parse(await body(r));
      const results = [];
      for (const reference of input.references) {
        try {
          const saved = await s.save(session.owner, reference);
          results.push({ id: saved.id, verified: true });
        } catch (e) {
          results.push({
            id: reference.id,
            verified: false,
            error:
              e instanceof ServiceError ? e.code : "temporarily_unavailable",
          });
        }
      }
      await s.audit(
        session.owner,
        "owner",
        "migration",
        results.every((row) => row.verified) ? "verified" : "partial",
      );
      return json({ results, localDataPreserved: true });
    }
    if (path === "/api/scout/status") {
      method(r, "GET");
      await owner(r, s, c);
      return json({
        configured: c.gateway !== c.app,
        resource: c.gateway !== c.app ? resource(c) : null,
        callbackAllowlistConfigured: c.redirects.some(
          (uri) => uri !== c.app + "/api/scout/check/callback",
        ),
        externalRedirects: c.redirects.filter(
          (uri) => uri !== c.app + "/api/scout/check/callback",
        ),
      });
    }
    if (path === "/api/scout/clients") {
      method(r, "POST");
      const session = await owner(r, s, c, true);
      if (c.gateway === c.app)
        throw new ServiceError(503, "dedicated_gateway_not_configured");
      const input = z
        .object({
          name: z.string().min(1).max(100),
          redirects: z.array(z.string().url()).min(1).max(5),
        })
        .strict()
        .parse(await body(r));
      if (input.redirects.some((uri) => !redirectAllowed(uri, c)))
        throw new ServiceError(400, "redirect_not_allowlisted");
      const clientId = randomUUID(),
        secret = opaque();
      await s.put("client", clientId, {
        id: clientId,
        owner: session.owner,
        resource: resource(c),
        name: input.name,
        secretHash: digest(secret),
        redirects: input.redirects,
        revoked: false,
      });
      await s.audit(session.owner, clientId, "client_create", "approved");
      return json(
        {
          client_id: clientId,
          client_secret: secret,
          authorization_endpoint: c.app + "/api/oauth/authorize",
          token_endpoint: c.gateway + "/token",
          resource: resource(c),
        },
        201,
      );
    }
    if (path === "/api/scout/revoke") {
      method(r, "POST");
      const session = await owner(r, s, c, true);
      const input = z
        .object({ clientId: id })
        .strict()
        .parse(await body(r));
      const client = await s.get<Client>("client", input.clientId);
      if (client) {
        await s.put("client", client.id, { ...client, revoked: true });
        await s.audit(session.owner, client.id, "client_revoke", "revoked");
      }
      return json({ revoked: true });
    }
    if (path === "/api/oauth/authorize") return authorize(r, s, c);
    throw new ServiceError(404, "not_found");
  }
  if (
    path === "/.well-known/oauth-protected-resource" ||
    path === "/.well-known/oauth-protected-resource/mcp"
  ) {
    method(r, "GET");
    return json({
      resource: resource(c),
      authorization_servers: [c.gateway],
      scopes_supported: ["saver:read", "saver:write"],
      bearer_methods_supported: ["header"],
    });
  }
  if (path === "/.well-known/oauth-authorization-server") {
    method(r, "GET");
    return json({
      issuer: c.gateway,
      authorization_endpoint: c.app + "/api/oauth/authorize",
      token_endpoint: c.gateway + "/token",
      revocation_endpoint: c.gateway + "/revoke",
      registration_endpoint: c.gateway + "/register",
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: [
        "client_secret_post",
        "client_secret_basic",
        "none",
      ],
      scopes_supported: ["saver:read", "saver:write"],
    });
  }
  if (path === "/jobs/connections") return relayConnections(r, s, c);
  if (path === "/register") return registerClient(r, s, c);
  if (path === "/token") return token(r, s, c);
  if (path === "/revoke") return revoke(r, s, c);
  if (path === "/mcp") return mcp(r, s, c);
  if (path === "/") {
    method(r, "GET");
    return json({
      name: "A.D | Grok Scout",
      resource: resource(c),
      tools: SCOUT_TOOLS,
    });
  }
  throw new ServiceError(404, "not_found");
}
async function authorize(r: Request, s: Store, c: Config) {
  if (r.method === "POST") {
    const session = await ownerConsent(r, s, c);
    const formData = await form(r);
    requireCsrf(formData.get("csrf") || "", session);
    const pending = await s.take<Authorization>(
      "authorization",
      formData.get("pending") || "",
    );
    if (!pending) throw new ServiceError(400, "authorization_expired");
    const client = await s.get<Client>("client", pending.clientId);
    if (!client || client.revoked)
      throw new ServiceError(401, "revoked_client");
    const destination = new URL(pending.redirect);
    destination.searchParams.set("state", pending.state);
    if (formData.get("decision") !== "approve") {
      destination.searchParams.set("error", "access_denied");
      return redirect(destination.href);
    }
    const code = opaque();
    await s.put(
      "code",
      digest(code),
      {
        owner: session.owner,
        clientId: pending.clientId,
        resource: pending.resource,
        scope: pending.scope,
        redirect: pending.redirect,
        challenge: pending.challenge,
      },
      120,
    );
    await s.audit(session.owner, client.id, "oauth_consent", "approved");
    destination.searchParams.set("code", code);
    return redirect(destination.href);
  }
  method(r, "GET");
  const p = new URL(r.url).searchParams;
  let ticket = p.get("pending") || "",
    pending: Authorization | null;
  if (ticket) {
    pending = await s.get<Authorization>("authorization", ticket);
    if (!pending) throw new ServiceError(400, "authorization_expired");
  } else {
    const client = await s.get<Client>("client", p.get("client_id") || "");
    const redirectUri = p.get("redirect_uri") || "";
    if (
      !client ||
      client.revoked ||
      !client.redirects.includes(redirectUri) ||
      !redirectAllowed(redirectUri, c)
    )
      throw new ServiceError(400, "invalid_client_or_redirect");
    if (
      p.get("response_type") !== "code" ||
      (p.get("resource") ||
        (client.registration === "dynamic" ? client.resource : "")) !==
        resource(c) ||
      (p.get("scope") ||
        (client.registration === "dynamic" ? client.defaultScope : "")) !==
        "saver:read saver:write" ||
      p.get("code_challenge_method") !== "S256" ||
      !/^[A-Za-z0-9_-]{43}$/.test(p.get("code_challenge") || "")
    )
      throw new ServiceError(400, "invalid_authorization_request");
    ticket = opaque();
    pending = {
      owner: c.owner,
      clientId: client.id,
      resource: resource(c),
      scope: "saver:read saver:write",
      redirect: redirectUri,
      challenge: p.get("code_challenge")!,
      state: (p.get("state") || "").slice(0, 1024),
    };
    await s.put("authorization", ticket, pending, 600);
  }
  let session: Session;
  try {
    session = await owner(r, s, c);
  } catch {
    return redirect(c.app + "/api/auth/login?pending=" + ticket);
  }
  const client = await s.get<Client>("client", pending.clientId);
  if (!client || client.revoked) throw new ServiceError(400, "invalid_client");
  return html(
    `<!doctype html><html lang="fr"><meta name="viewport" content="width=device-width"><title>Autoriser Grok Scout</title><h1>A.D — Autoriser ${htmlEscape(client.name)}</h1><p>Lire et enregistrer des références Saver uniquement. Aucun accès aux projets, tâches ou MCP global.</p><p>Une sauvegarde proposée par Grok exige votre approbation dans la conversation.</p><form method="post" action="/api/oauth/authorize"><input type="hidden" name="pending" value="${ticket}"><input type="hidden" name="csrf" value="${session.csrf}"><button name="decision" value="approve">Autoriser Saver</button><button name="decision" value="deny">Refuser</button></form></html>`,
    200,
    new URL(pending.redirect).origin,
  );
}
async function ownerConsent(r: Request, s: Store, c: Config) {
  requireSameOrigin(r, c);
  return owner(r, s, c);
}
async function clientAuthentication(r: Request, p: URLSearchParams, s: Store) {
  let clientId = p.get("client_id") || "",
    secret = p.get("client_secret") || "";
  const basic = /^Basic (.+)$/.exec(r.headers.get("authorization") || "");
  if (basic) {
    const raw = Buffer.from(basic[1], "base64").toString("utf8"),
      colon = raw.indexOf(":");
    if (colon < 0) throw new ServiceError(401, "invalid_client");
    clientId = decodeURIComponent(raw.slice(0, colon));
    secret = decodeURIComponent(raw.slice(colon + 1));
  }
  const client = await s.get<Client>("client", clientId);
  if (!client || client.revoked) throw new ServiceError(401, "invalid_client");
  if (client.authMethod === "none") {
    if (client.registration !== "dynamic" || secret || basic)
      throw new ServiceError(401, "invalid_client");
  } else if (!secret || !equal(client.secretHash, digest(secret))) {
    throw new ServiceError(401, "invalid_client");
  }
  return client;
}
async function issueTokens(s: Store, c: Config, client: Client, grant: Grant) {
  const access = opaque(),
    refresh = client.refreshAllowed ? opaque() : "";
  await s.put("token", digest(access), grant, 3600);
  if (refresh) await s.put("refresh", digest(refresh), grant, 30 * 86400);
  return json({
    access_token: access,
    token_type: "Bearer",
    expires_in: 3600,
    scope: grant.scope,
    ...(refresh ? { refresh_token: refresh } : {}),
  });
}
async function token(r: Request, s: Store, c: Config) {
  method(r, "POST");
  const p = await form(r),
    client = await clientAuthentication(r, p, s);
  await s.quota("token:" + client.id, 30);
  // RFC 8707 indicators are optional on exchange when the stored grant is
  // already bound to the one dedicated audience. A different indicator is refused.
  if (p.has("resource") && p.get("resource") !== resource(c))
    throw new ServiceError(400, "invalid_target");
  if (p.get("grant_type") === "refresh_token") {
    if (!client.refreshAllowed) throw new ServiceError(400, "invalid_grant");
    const grant = await s.take<Grant>(
      "refresh",
      digest(p.get("refresh_token") || ""),
    );
    if (
      !grant ||
      grant.owner !== c.owner ||
      grant.clientId !== client.id ||
      grant.resource !== resource(c) ||
      grant.scope !== "saver:read saver:write"
    )
      throw new ServiceError(400, "invalid_grant");
    const result = await issueTokens(s, c, client, grant);
    await s.audit(c.owner, client.id, "token_refresh", "rotated");
    return result;
  }
  if (p.get("grant_type") !== "authorization_code")
    throw new ServiceError(400, "invalid_target");
  const code = await s.take<Code>("code", digest(p.get("code") || "")),
    verifier = p.get("code_verifier") || "";
  if (
    !code ||
    code.owner !== c.owner ||
    code.clientId !== client.id ||
    code.resource !== resource(c) ||
    code.scope !== "saver:read saver:write" ||
    code.redirect !== p.get("redirect_uri") ||
    !client.redirects.includes(code.redirect) ||
    !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier) ||
    !equal(
      code.challenge,
      Buffer.from(digest(verifier), "hex").toString("base64url"),
    )
  )
    throw new ServiceError(400, "invalid_grant");
  const result = await issueTokens(s, c, client, {
    owner: code.owner,
    clientId: code.clientId,
    resource: code.resource,
    scope: code.scope,
  });
  await s.audit(c.owner, client.id, "token_issue", "issued");
  return result;
}

async function revoke(r: Request, s: Store, c: Config) {
  method(r, "POST");
  const p = await form(r),
    client = await clientAuthentication(r, p, s);
  const key = digest(p.get("token") || ""),
    grant =
      (await s.get<Grant>("token", key)) ||
      (await s.get<Grant>("refresh", key));
  if (
    grant?.clientId === client.id &&
    grant.owner === c.owner &&
    grant.resource === resource(c)
  ) {
    if (await s.get("refresh", key))
      await s.query(
        "DELETE FROM ad_records WHERE namespace IN ('token','refresh') AND data->>'clientId'=$1 AND data->>'owner'=$2 AND data->>'resource'=$3",
        [client.id, c.owner, resource(c)],
      );
    else await s.remove("token", key);
  }
  await s.audit(c.owner, client.id, "token_revoke", "revoked");
  return new Response(null, { status: 200, headers });
}
const toolDescriptions = {
  get_saved_inspiration:
    "Search references already saved in the owner’s A.D Saver library. Read-only: never creates or changes a reference. Does NOT access X/Twitter bookmarks, Instagram saved posts or external accounts.",
  get_saver_capture:
    "Read one existing A.D Saver reference by its persistent UUID. Read-only. Does not fetch X/Twitter or Instagram bookmarks.",
  save_inspiration_reference:
    "Save one reference only after explicit owner approval in this conversation. Returns the persistent UUID and verified read-back.",
  save_reference_batch:
    "Save at most 20 explicitly owner-approved references with per-item verified receipts.",
};
const captureProperties = {
  id: { type: "string", format: "uuid" },
  title: { type: "string", minLength: 1, maxLength: 10000 },
  content: { type: "string", maxLength: 10000 },
  url: { type: "string", format: "uri" },
  owner_approved: { type: "boolean", const: true },
};
async function mcp(r: Request, s: Store, c: Config) {
  const grant = await scout(r, s, c);
  method(r, "POST");
  const origin = r.headers.get("origin");
  if (origin && origin !== c.gateway && origin !== c.app)
    throw new ServiceError(403, "origin_rejected");
  await s.quota("mcp:" + grant.clientId, 30);
  await s.quota("mcp-owner:" + grant.owner, 120);
  let raw: unknown;
  try {
    raw = await body(r);
  } catch (e) {
    if (e instanceof ServiceError && e.code === "invalid_json")
      return json(
        {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error" },
        },
        400,
      );
    throw e;
  }
  const parsed = z
    .object({
      jsonrpc: z.literal("2.0"),
      id: z.union([z.string(), z.number().int()]).optional(),
      method: z.string(),
      params: z.unknown().optional(),
    })
    .strict()
    .safeParse(raw);
  if (!parsed.success)
    return json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32600, message: "Invalid request" },
      },
      400,
    );
  const input = parsed.data;
  if (input.id === undefined) {
    if (!input.method.startsWith("notifications/"))
      throw new ServiceError(400, "invalid_notification");
    return new Response(null, { status: 202, headers });
  }
  const protocol = mcpProtocol(r, input.method, input.params);
  const error = (
    code: number,
    message: string,
    status = 200,
    data?: Record<string, unknown>,
  ) =>
    json(
      {
        jsonrpc: "2.0",
        id: input.id,
        error: { code, message, ...(data ? { data } : {}) },
      },
      status,
    );
  if (protocol.failure) {
    console.warn(
      JSON.stringify({
        event: "mcp_protocol_rejected",
        method: [
          "initialize",
          "server/discover",
          "tools/list",
          "tools/call",
          "ping",
        ].includes(input.method)
          ? input.method
          : "other",
        code: protocol.failure.code,
      }),
    );
    return error(
      protocol.failure.code,
      protocol.failure.message,
      400,
      protocol.failure.data,
    );
  }
  input.params = protocol.params;
  const result = (value: Record<string, unknown>) =>
    json({
      jsonrpc: "2.0",
      id: input.id,
      result: protocol.modern
        ? {
            resultType: "complete",
            _meta: { "io.modelcontextprotocol/serverInfo": MCP_SERVER_INFO },
            ...value,
          }
        : value,
    });
  const instructions =
    "Saver-only creative references. Use get_saved_inspiration to search and get_saver_capture to read; neither changes saved references. Save tools require explicit owner approval. No access to X/Twitter bookmarks, Instagram saved posts, projects, tasks, preferences or any global MCP.";
  if (input.method === "server/discover") {
    mcpDiscoveryLog(
      "server/discover",
      protocol.version,
      protocol.version,
      SCOUT_TOOLS.length,
    );
    return result({
      supportedVersions: MCP_SUPPORTED_VERSIONS,
      capabilities: { tools: {} },
      instructions,
      ttlMs: 0,
      cacheScope: "private",
    });
  }
  if (input.method === "initialize") {
    const p = z
      .object({ protocolVersion: z.string() })
      .passthrough()
      .parse(input.params);
    const selected = (MCP_LEGACY_VERSIONS as readonly string[]).includes(
      p.protocolVersion,
    )
      ? p.protocolVersion
      : "2025-06-18";
    mcpDiscoveryLog("initialize", p.protocolVersion, selected);
    return result({
      protocolVersion: selected,
      capabilities: { tools: {} },
      serverInfo: MCP_SERVER_INFO,
      instructions,
    });
  }
  if (input.method === "ping") return result({});
  if (input.method === "tools/list") {
    mcpDiscoveryLog(
      "tools/list",
      protocol.version,
      protocol.version,
      SCOUT_TOOLS.length,
    );
    return result({
      ...(protocol.modern ? { ttlMs: 0, cacheScope: "private" } : {}),
      tools: SCOUT_TOOLS.map((name) => ({
        name,
        description: toolDescriptions[name],
        annotations: {
          readOnlyHint: name.startsWith("get_"),
          destructiveHint: false,
          openWorldHint: false,
        },
        inputSchema:
          name === "get_saved_inspiration"
            ? {
                type: "object",
                additionalProperties: false,
                properties: {
                  query: { type: "string", maxLength: 300 },
                  after: { type: "string", format: "uuid" },
                },
              }
            : name === "get_saver_capture"
              ? {
                  type: "object",
                  additionalProperties: false,
                  required: ["id"],
                  properties: { id: { type: "string", format: "uuid" } },
                }
              : name === "save_inspiration_reference"
                ? {
                    type: "object",
                    additionalProperties: false,
                    required: ["title", "url", "owner_approved"],
                    properties: captureProperties,
                  }
                : {
                    type: "object",
                    additionalProperties: false,
                    required: ["references"],
                    properties: {
                      references: {
                        type: "array",
                        minItems: 1,
                        maxItems: 20,
                        items: {
                          type: "object",
                          additionalProperties: false,
                          required: ["title", "url", "owner_approved"],
                          properties: captureProperties,
                        },
                      },
                    },
                  },
      })),
    });
  }
  if (input.method !== "tools/call")
    return error(-32601, "Method not allowed", protocol.modern ? 404 : 200);
  const parsedCall = z
    .object({ name: z.string(), arguments: z.unknown().optional() })
    .strict()
    .safeParse(input.params);
  if (!parsedCall.success)
    return error(
      -32602,
      "Invalid tool call parameters",
      protocol.modern ? 400 : 200,
    );
  const call = parsedCall.data;
  if (!(SCOUT_TOOLS as readonly string[]).includes(call.name)) {
    await s.audit(grant.owner, grant.clientId, "tool_denied", "denied");
    return error(-32601, "Tool not allowed");
  }
  let output: unknown;
  try {
    if (call.name === "get_saved_inspiration") {
      const args = z
        .object({
          query: z.string().max(300).default(""),
          after: id.optional(),
        })
        .strict()
        .parse(call.arguments || {});
      const all = await s.list(grant.owner, args.query, args.after || "", 100);
      output = {
        references: all.filter((row) => !row.isInternalQA && !row.projectId),
        next: all.length === 100 ? all.at(-1)!.id : null,
      };
    } else if (call.name === "get_saver_capture") {
      const args = z.object({ id }).strict().parse(call.arguments);
      const reference = await s.read(grant.owner, args.id);
      if (!reference || reference.isInternalQA || reference.projectId)
        throw new ServiceError(404, "reference_not_found");
      output = { reference };
      await s.audit(
        grant.owner,
        grant.clientId,
        call.name,
        "verified:" + reference.id,
      );
    } else {
      const inputs =
        call.name === "save_inspiration_reference"
          ? [capture.parse(call.arguments)]
          : z
              .object({ references: z.array(capture).min(1).max(20) })
              .strict()
              .parse(call.arguments).references;
      const results = [];
      for (const row of inputs) {
        const now = new Date().toISOString();
        const refId = row.id || randomUUID();
        try {
          const existing = await s.read(grant.owner, refId);
          if (existing) {
            if (
              existing.origin !== "grok" ||
              existing.title !== row.title ||
              existing.content !== row.content ||
              existing.url !== row.url
            )
              throw new ServiceError(409, "uuid_conflict");
            results.push({
              id: existing.id,
              verified: true,
              reference: existing,
            });
            continue;
          }
          const saved = await s.save(grant.owner, {
            id: refId,
            title: row.title,
            content: row.content,
            url: row.url,
            origin: "grok",
            capturedAt: now,
            approvedAt: now,
            revision: 1,
            isInternalQA: false,
          });
          results.push({ id: saved.id, verified: true, reference: saved });
        } catch (e) {
          results.push({
            id: refId,
            verified: false,
            possibleWrite: true,
            error:
              e instanceof ServiceError ? e.code : "temporarily_unavailable",
          });
        }
      }
      for (const saved of results)
        if (saved.verified)
          await s.audit(
            grant.owner,
            grant.clientId,
            call.name,
            "verified:" + saved.id,
          );
      output =
        call.name === "save_inspiration_reference" ? results[0] : { results };
    }
    await s.audit(grant.owner, grant.clientId, call.name, "completed");
    return result({
      content: [{ type: "text", text: JSON.stringify(output) }],
      structuredContent: output,
    });
  } catch (e) {
    await s.audit(grant.owner, grant.clientId, call.name, "failed");
    return result({
      isError: true,
      content: [
        {
          type: "text",
          text:
            e instanceof ServiceError
              ? e.code
              : "invalid_request_or_temporarily_unavailable",
        },
      ],
    });
  }
}
