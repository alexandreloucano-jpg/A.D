import { createHash } from "node:crypto";
import { createRemoteJWKSet, customFetch, jwtVerify } from "jose";
import { Store, ServiceError, digest } from "./store.js";
import {
  cookie,
  equal,
  opaque,
  owner,
  requireSameOrigin,
  requireCsrf,
  type Config,
} from "./security.js";
import { encryptionAvailable, seal, unseal } from "./secrets.js";
const json = (data: unknown) =>
  Response.json(data, { headers: { "cache-control": "no-store" } });
const browserCookie = (value: string, age: number) =>
  `__Host-ad_google=${value}; Path=/; Max-Age=${age}; Secure; HttpOnly; SameSite=Lax`;
const redirect = (url: string, cookieValue?: string) =>
  new Response(null, {
    status: 303,
    headers: {
      location: url,
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      ...(cookieValue ? { "set-cookie": cookieValue } : {}),
    },
  });
type Binding = { sub: string; linkedAt: string; client: string };
type Pending = {
  browser: string;
  verifier: string;
  nonce: string;
  client: string;
  mode: "link" | "login";
  sessionHash: string;
};
function credentials(c: Config) {
  const client = process.env.GOOGLE_OAUTH_CLIENT_ID || "",
    secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || "";
  if (!client || !secret || !encryptionAvailable())
    throw new ServiceError(503, "google_oauth_not_configured");
  return { client, secret, callback: c.app + "/api/auth/google/callback" };
}
const keys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
  {
    [customFetch]: (url, options) =>
      fetch(url, {
        ...options,
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      }),
  },
);
export async function verifyGoogleIdToken(
  token: string,
  client: string,
  nonce: string,
) {
  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: client,
      algorithms: ["RS256"],
      requiredClaims: ["sub", "nonce", "iat", "exp"],
      maxTokenAge: "10 minutes",
      clockTolerance: 5,
    });
    if (
      typeof payload.sub !== "string" ||
      !payload.sub ||
      payload.sub.length > 255 ||
      typeof payload.nonce !== "string" ||
      !equal(payload.nonce, nonce) ||
      (payload.azp !== undefined && payload.azp !== client) ||
      (Array.isArray(payload.aud) &&
        payload.aud.length > 1 &&
        payload.azp !== client)
    )
      throw Error("claims");
    return payload.sub;
  } catch {
    throw new ServiceError(401, "google_id_token_rejected");
  }
}
export async function googleRoute(
  r: Request,
  s: Store,
  c: Config,
): Promise<Response> {
  const path = new URL(r.url).pathname;
  if (path === "/api/auth/google/status") {
    if (r.method !== "GET") throw new ServiceError(405, "method_not_allowed");
    let configured = true;
    try {
      credentials(c);
    } catch {
      configured = false;
    }
    // Public login capability only. Binding status requires the owner session.
    let linked = false,
      canLink = false;
    let authMethod: string | null = null,
      lastRead: unknown = null;
    try {
      const session = await owner(r, s, c);
      linked = !!(await s.get<Binding>("google-owner", c.owner));
      canLink = session.authMethod !== "google";
      authMethod = session.authMethod || "github";
      lastRead = await s.get("saver-read-proof", c.owner);
    } catch (e) {
      if (!(e instanceof ServiceError) || e.status !== 401) throw e;
      // No private account metadata for unauthenticated callers.
    }
    return json({
      configured,
      linked,
      canLink,
      authMethod,
      lastRead,
      callback: c.app + "/api/auth/google/callback",
    });
  }
  if (path === "/api/auth/google/setup") {
    if (r.method !== "GET") throw new ServiceError(405, "method_not_allowed");
    credentials(c);
    let session;
    try {
      session = await owner(r, s, c);
    } catch (e) {
      if (!(e instanceof ServiceError) || e.status !== 401) throw e;
      return redirect(c.app + "/api/auth/login?return=google");
    }
    if (session.authMethod === "google")
      throw new ServiceError(403, "github_session_required_for_link");
    if (await s.get("google-owner", c.owner))
      return redirect(c.app + "/api/auth/google/login");
    return new Response(
      `<!doctype html><html lang="fr"><meta name="viewport" content="width=device-width"><title>Lier Google à A.D</title><h1>Continuer avec Google</h1><p>Votre identité GitHub propriétaire est vérifiée. Autorisez la liaison de votre compte Google à cette même bibliothèque Saver. Aucun second compte ne sera créé.</p><form method="post" action="/api/auth/google/link"><input type="hidden" name="csrf" value="${session.csrf}"><button type="submit">Lier mon compte Google</button></form></html>`,
      {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          "referrer-policy": "same-origin",
          "x-content-type-options": "nosniff",
          "x-frame-options": "DENY",
          "content-security-policy":
            "default-src 'none'; form-action 'self' https://accounts.google.com; frame-ancestors 'none'; base-uri 'none'",
        },
      },
    );
  }
  if (path === "/api/auth/google/unlink") {
    if (r.method !== "POST") throw new ServiceError(405, "method_not_allowed");
    const session = await owner(r, s, c, true);
    if (session.authMethod === "google")
      throw new ServiceError(403, "github_session_required_for_link");
    await s.remove("google-owner", c.owner);
    await s.query(
      "DELETE FROM ad_records WHERE namespace='session' AND data->>'owner'=$1 AND data->>'authMethod'='google'",
      [c.owner],
    );
    await s.audit(c.owner, "owner", "google_unlink", "revoked");
    return json({ unlinked: true, referencesPreserved: true });
  }
  if (path === "/api/auth/google/link" || path === "/api/auth/google/login") {
    const mode = path.endsWith("/link") ? "link" : "login";
    if (r.method !== (mode === "link" ? "POST" : "GET"))
      throw new ServiceError(405, "method_not_allowed");
    let sessionHash = "";
    const isForm =
      r.headers.get("content-type")?.split(";")[0] ===
      "application/x-www-form-urlencoded";
    if (mode === "link") {
      const session = await owner(r, s, c, !isForm);
      if (isForm) {
        requireSameOrigin(r, c);
        const raw = await r.text();
        if (Buffer.byteLength(raw) > 16384)
          throw new ServiceError(413, "request_too_large");
        requireCsrf(new URLSearchParams(raw).get("csrf") || "", session);
      }
      // Legacy owner sessions were exclusively issued by verified GitHub login.
      if (session.authMethod === "google")
        throw new ServiceError(403, "github_session_required_for_link");
      sessionHash = digest(cookie(r, "__Host-ad_session"));
      if (await s.get("google-owner", c.owner))
        throw new ServiceError(409, "google_already_linked");
    } else if (!(await s.get("google-owner", c.owner)))
      return redirect(c.app + "/api/auth/google/setup");
    const cfg = credentials(c),
      state = opaque(),
      browser = opaque(),
      verifier = opaque(),
      nonce = opaque();
    await s.quota("google-login:" + c.owner, 20);
    await s.put(
      "google-login",
      digest(state),
      {
        encrypted: seal(
          {
            mode,
            sessionHash,
            browser: digest(browser),
            verifier,
            nonce,
            client: cfg.client,
          },
          "google-login:" + digest(state),
        ),
      },
      600,
    );
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({
      client_id: cfg.client,
      redirect_uri: cfg.callback,
      response_type: "code",
      scope: "openid",
      state,
      nonce,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();
    if (mode === "link" && !isForm) {
      const response = json({ url: url.href });
      response.headers.set("set-cookie", browserCookie(browser, 600));
      return response;
    }
    return redirect(url.href, browserCookie(browser, 600));
  }
  if (path === "/api/auth/google/callback") {
    if (r.method !== "GET") throw new ServiceError(405, "method_not_allowed");
    const p = new URL(r.url).searchParams,
      state = p.get("state") || "";
    if (!/^[A-Za-z0-9_-]{43}$/.test(state))
      throw new ServiceError(401, "google_state_rejected");
    const stored = await s.take<{ encrypted: string }>(
      "google-login",
      digest(state),
    );
    if (!stored) throw new ServiceError(401, "google_state_rejected");
    const pending = unseal<Pending>(
      stored.encrypted,
      "google-login:" + digest(state),
    );
    if (!equal(pending.browser, digest(cookie(r, "__Host-ad_google"))))
      throw new ServiceError(401, "google_state_rejected");
    if (pending.mode === "link") {
      const session = await owner(r, s, c);
      if (
        session.authMethod === "google" ||
        !equal(pending.sessionHash, digest(cookie(r, "__Host-ad_session")))
      )
        throw new ServiceError(401, "google_link_session_changed");
    }
    if (p.has("error")) throw new ServiceError(401, "google_consent_denied");
    const cfg = credentials(c),
      code = p.get("code") || "";
    if (!code || cfg.client !== pending.client)
      throw new ServiceError(401, "google_state_rejected");
    let response: Response;
    try {
      response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(15000),
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: cfg.client,
          client_secret: cfg.secret,
          redirect_uri: cfg.callback,
          grant_type: "authorization_code",
          code_verifier: pending.verifier,
        }),
      });
    } catch {
      throw new ServiceError(502, "google_unreachable");
    }
    const tokens = (await response.json()) as { id_token?: string };
    if (
      !response.ok ||
      typeof tokens.id_token !== "string" ||
      tokens.id_token.length > 20000
    )
      throw new ServiceError(401, "google_exchange_failed");
    const sub = await verifyGoogleIdToken(
      tokens.id_token,
      cfg.client,
      pending.nonce,
    );
    if (pending.mode === "link") {
      const binding: Binding = {
        sub,
        client: cfg.client,
        linkedAt: new Date().toISOString(),
      };
      await s.query(
        "INSERT INTO ad_records(namespace,key,data) VALUES('google-owner',$1,$2::jsonb) ON CONFLICT(namespace,key) DO NOTHING",
        [c.owner, JSON.stringify(binding)],
      );
      const read = await s.get<Binding>("google-owner", c.owner);
      if (read?.sub !== sub || read.client !== cfg.client)
        throw new ServiceError(409, "google_already_linked");
      await s.audit(c.owner, "owner", "google_link", "verified");
      return redirect(c.app + "/?google=linked#/saver", browserCookie("", 0));
    }
    const binding = await s.get<Binding>("google-owner", c.owner);
    if (!binding || binding.client !== cfg.client || !equal(binding.sub, sub))
      throw new ServiceError(403, "google_not_linked_owner");
    const session = opaque();
    await s.put(
      "session",
      digest(session),
      {
        owner: c.owner,
        csrf: opaque(),
        authMethod: "google",
        googleBinding: digest(
          JSON.stringify([binding.sub, binding.client, binding.linkedAt]),
        ),
      },
      43200,
    );
    await s.audit(c.owner, "owner", "google_login", "verified");
    return redirect(
      c.app + "/#/saver",
      `__Host-ad_session=${session}; Path=/; Max-Age=43200; Secure; HttpOnly; SameSite=Lax`,
    );
  }
  throw new ServiceError(404, "not_found");
}
