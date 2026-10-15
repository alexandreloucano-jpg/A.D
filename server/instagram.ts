import { Store, ServiceError, digest } from "./store.js";
import { cookie, equal, opaque, owner, type Config } from "./security.js";
import { seal, unseal, encryptionAvailable } from "./secrets.js";
const SCOPE = "instagram_business_basic";
type Account = {
  id: string;
  username: string;
  accountType: string;
  encryptedToken: string;
  expiresAt: number;
  connectedAt: string;
  permissions: string[];
};
type Pending = {
  browser: string;
  sessionHash: string;
  owner: string;
  client: string;
};
const json = (data: unknown) =>
  Response.json(data, { headers: { "cache-control": "no-store" } });
function config(c: Config) {
  const client = process.env.INSTAGRAM_OAUTH_CLIENT_ID || "",
    secret = process.env.INSTAGRAM_OAUTH_CLIENT_SECRET || "";
  if (!client || !secret || !encryptionAvailable())
    throw new ServiceError(
      503,
      "instagram_professional_configuration_required",
    );
  return { client, secret, callback: c.app + "/api/instagram/callback" };
}
async function provider(url: string, init: RequestInit) {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new ServiceError(502, "instagram_unreachable");
  }
  if (!response.ok)
    throw new ServiceError(
      response.status === 429 ? 429 : 502,
      "instagram_permission_or_token_rejected",
    );
  return response.json();
}
export async function instagramRoute(
  r: Request,
  s: Store,
  c: Config,
): Promise<Response> {
  const path = new URL(r.url).pathname;
  const session = await owner(r, s, c, r.method !== "GET");
  if (path === "/api/instagram/status") {
    if (r.method !== "GET") throw new ServiceError(405, "method_not_allowed");
    let configured = true;
    try {
      config(c);
    } catch {
      configured = false;
    }
    const account = await s.get<Account>("instagram-account", session.owner);
    const error = await s.get<{ code: string; at: string }>(
      "instagram-error",
      session.owner,
    );
    return json({
      configured,
      connected: !!account && account.expiresAt > Date.now(),
      username: account?.username || "",
      accountType: account?.accountType || "",
      permissions: account?.permissions || [],
      requestedPermissions: [SCOPE],
      lastImportAt: null,
      savedPostsImportSupported: false,
      error:
        error?.code ||
        (account && account.expiresAt <= Date.now()
          ? "instagram_reauthorization_required"
          : null),
      blocker: configured
        ? null
        : "Application Meta Instagram Login non configurée. Compte professionnel Creator ou Business requis. Les comptes personnels et l’import des publications enregistrées ne sont pas pris en charge par cette API.",
      callback: c.app + "/api/instagram/callback",
    });
  }
  if (path === "/api/instagram/connect") {
    if (r.method !== "POST") throw new ServiceError(405, "method_not_allowed");
    const existing = await s.get<Account>("instagram-account", session.owner);
    if (existing && existing.expiresAt > Date.now())
      throw new ServiceError(409, "instagram_already_connected");
    const cfg = config(c),
      state = opaque(),
      browser = opaque();
    await s.quota("instagram-connect:" + session.owner, 10);
    await s.put(
      "instagram-login",
      digest(state),
      {
        encrypted: seal(
          {
            owner: session.owner,
            sessionHash: digest(cookie(r, "__Host-ad_session")),
            browser: digest(browser),
            client: cfg.client,
          },
          "instagram-login:" + digest(state),
        ),
      },
      600,
    );
    const url = new URL("https://www.instagram.com/oauth/authorize");
    url.search = new URLSearchParams({
      enable_fb_login: "0",
      force_reauth: "true",
      client_id: cfg.client,
      redirect_uri: cfg.callback,
      response_type: "code",
      scope: SCOPE,
      state,
    }).toString();
    const response = json({ url: url.href });
    response.headers.set(
      "set-cookie",
      `__Host-ad_instagram=${browser}; Path=/; Max-Age=600; Secure; HttpOnly; SameSite=Lax`,
    );
    return response;
  }
  if (path === "/api/instagram/callback") {
    if (r.method !== "GET") throw new ServiceError(405, "method_not_allowed");
    const p = new URL(r.url).searchParams,
      state = p.get("state") || "";
    if (!/^[A-Za-z0-9_-]{43}$/.test(state))
      throw new ServiceError(401, "instagram_state_rejected");
    const stored = await s.take<{ encrypted: string }>(
      "instagram-login",
      digest(state),
    );
    if (!stored) throw new ServiceError(401, "instagram_state_rejected");
    const pending = unseal<Pending>(
      stored.encrypted,
      "instagram-login:" + digest(state),
    );
    if (
      pending.owner !== session.owner ||
      !equal(pending.sessionHash, digest(cookie(r, "__Host-ad_session"))) ||
      !equal(pending.browser, digest(cookie(r, "__Host-ad_instagram")))
    )
      throw new ServiceError(401, "instagram_state_rejected");
    const cfg = config(c);
    if (pending.client !== cfg.client || !p.get("code") || p.has("error"))
      throw new ServiceError(401, "instagram_consent_denied");
    try {
      const rawToken = (await provider(
        "https://api.instagram.com/oauth/access_token",
        {
          method: "POST",
          body: new URLSearchParams({
            client_id: cfg.client,
            client_secret: cfg.secret,
            grant_type: "authorization_code",
            redirect_uri: cfg.callback,
            code: p.get("code")!,
          }),
        },
      )) as {
        data?: unknown[];
        access_token?: string;
        user_id?: string | number;
        permissions?: string | string[];
      };
      const token = (rawToken.data?.[0] || rawToken) as {
        access_token?: string;
        user_id?: string | number;
        permissions?: string | string[];
      };
      if (!token.access_token || !token.user_id)
        throw new ServiceError(502, "instagram_exchange_failed");
      const rawProfile = (await provider(
        "https://graph.instagram.com/v25.0/me?fields=user_id,username,account_type",
        { headers: { authorization: "Bearer " + token.access_token } },
      )) as {
        data?: unknown[];
        user_id?: string;
        username?: string;
        account_type?: string;
      };
      const profile = (rawProfile.data?.[0] || rawProfile) as {
        user_id?: string;
        username?: string;
        account_type?: string;
      };
      if (
        !profile.user_id ||
        !profile.username ||
        !["BUSINESS", "MEDIA_CREATOR"].includes(
          (profile.account_type || "").toUpperCase(),
        )
      )
        throw new ServiceError(403, "instagram_professional_account_required");
      const permissions =
        typeof token.permissions === "string"
          ? token.permissions.split(",").map((x) => x.trim())
          : token.permissions;
      if (!permissions?.includes(SCOPE))
        throw new ServiceError(403, "instagram_permission_or_token_rejected");
      // Short-lived token only: no promise of background import or refresh.
      const account: Account = {
        id: String(profile.user_id),
        username: profile.username,
        accountType: profile.account_type!,
        encryptedToken: seal(
          { accessToken: token.access_token },
          "instagram-account:" + session.owner,
        ),
        expiresAt: Date.now() + 3600000,
        connectedAt: new Date().toISOString(),
        permissions: [...new Set(permissions)],
      };
      await s.put("instagram-account", session.owner, account);
      await s.remove("instagram-error", session.owner);
      if (!(await s.get<Account>("instagram-account", session.owner)))
        throw new ServiceError(503, "instagram_connection_unverified");
      await s.audit(session.owner, "owner", "instagram_connect", "verified");
    } catch (e) {
      await s.put("instagram-error", session.owner, {
        code: e instanceof ServiceError ? e.code : "instagram_unavailable",
        at: new Date().toISOString(),
      });
      throw e;
    }
    return new Response(null, {
      status: 303,
      headers: {
        location: c.app + "/#/saver",
        "cache-control": "no-store",
        "referrer-policy": "no-referrer",
        "set-cookie":
          "__Host-ad_instagram=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax",
      },
    });
  }
  if (path === "/api/instagram/disconnect") {
    if (r.method !== "POST") throw new ServiceError(405, "method_not_allowed");
    const account = await s.get<Account>("instagram-account", session.owner);
    let revoked = !account;
    if (account) {
      try {
        const { accessToken } = unseal<{ accessToken: string }>(
          account.encryptedToken,
          "instagram-account:" + session.owner,
        );
        const result = await provider(
          "https://graph.instagram.com/v25.0/" +
            encodeURIComponent(account.id) +
            "/permissions",
          {
            method: "DELETE",
            headers: { authorization: "Bearer " + accessToken },
          },
        );
        revoked = result?.success === true || result === true;
      } catch {
        /* expose remote failure truthfully */
      }
    }
    await s.remove("instagram-account", session.owner);
    await s.remove("instagram-error", session.owner);
    await s.audit(
      session.owner,
      "owner",
      "instagram_disconnect",
      revoked ? "revoked" : "local_only",
    );
    return json({ disconnected: true, revoked, referencesPreserved: true });
  }
  throw new ServiceError(404, "not_found");
}
