import { z } from "zod";
import { randomUUID, createHash } from "node:crypto";
import { Store, ServiceError, digest } from "./store.js";
import { owner, opaque, equal, type Config } from "./security.js";
import { seal, unseal, encryptionAvailable } from "./secrets.js";
import { X_SCOPES, xPageSchema, xPostId } from "../src/social/model.js";
import { referenceSchema, type Reference } from "../src/domain.js";
const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().int().positive(),
  scope: z.string().min(1),
  token_type: z.string().refine((s) => s.toLowerCase() === "bearer"),
});
type Tokens = z.infer<typeof tokenSchema>;
type Account = {
  remoteId: string;
  username: string;
  encryptedTokens: string;
  expiresAt: number;
  enabled: boolean;
  revision: number;
  lastSyncAt: string | null;
  retryAt: number;
  cursor: string | null;
  catchup: string | null;
  phase: "head" | "catchup";
};
type Pending = {
  owner: string;
  verifier: string;
  browser: string;
  sessionHash: string;
  client: string;
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
    },
  });
function config(c: Config) {
  const client = process.env.X_OAUTH_CLIENT_ID,
    secret = process.env.X_OAUTH_CLIENT_SECRET;
  if (!client || !secret || !encryptionAvailable())
    throw new ServiceError(503, "x_developer_credentials_required");
  return { client, secret, callback: c.app + "/api/x/callback" };
}
function authHeader() {
  const client = process.env.X_OAUTH_CLIENT_ID || "",
    secret = process.env.X_OAUTH_CLIENT_SECRET || "";
  return (
    "Basic " +
    Buffer.from(
      encodeURIComponent(client) + ":" + encodeURIComponent(secret),
    ).toString("base64")
  );
}
async function provider(path: string, init: RequestInit) {
  let r: Response;
  try {
    r = await fetch("https://api.x.com" + path, {
      ...init,
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new ServiceError(502, "x_unreachable");
  }
  if (!r.ok) {
    if (r.status === 429) {
      const reset = Number(r.headers.get("x-rate-limit-reset"));
      const retry = Number(r.headers.get("retry-after"));
      const e = new XRateLimit(
        Number.isFinite(reset) && reset > 0
          ? reset * 1000
          : Date.now() +
              (Number.isFinite(retry) && retry > 0 ? retry : 900) * 1000,
      );
      throw e;
    }
    throw new ServiceError(
      r.status === 401
        ? 401
        : r.status === 403
          ? 403
          : r.status === 402
            ? 402
            : 502,
      r.status === 401
        ? "x_reconnect_required"
        : r.status === 403
          ? "x_permission_denied"
          : r.status === 402
            ? "x_api_budget_required"
            : "x_provider_error",
    );
  }
  return r;
}
class XRateLimit extends ServiceError {
  constructor(readonly retryAt: number) {
    super(429, "x_rate_limited");
  }
}
async function exchange(params: Record<string, string>, previous?: Tokens) {
  const response = await provider("/2/oauth2/token", {
    method: "POST",
    headers: {
      authorization: authHeader(),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
  const raw = await response.json();
  const tokens = tokenSchema.parse({
    ...raw,
    scope: raw.scope || previous?.scope,
    refresh_token: raw.refresh_token || previous?.refresh_token,
  });
  const scopes = new Set(tokens.scope.split(" "));
  if (
    X_SCOPES.some((s) => !scopes.has(s)) ||
    [...scopes].some((s) => !X_SCOPES.includes(s as (typeof X_SCOPES)[number]))
  )
    throw new ServiceError(403, "x_scopes_mismatch");
  return tokens;
}
async function lease(store: Store, id: string) {
  const nonce = opaque(),
    until = new Date(Date.now() + 120000).toISOString();
  const rows = await store.query(
    "INSERT INTO ad_records(namespace,key,data,expires_at) VALUES('x-lock',$1,$2::jsonb,$3) ON CONFLICT(namespace,key) DO UPDATE SET data=excluded.data,expires_at=excluded.expires_at WHERE ad_records.expires_at<now() RETURNING key",
    [id, JSON.stringify({ nonce }), until],
  );
  if (!rows.length) throw new ServiceError(409, "x_sync_busy");
  return async () => {
    await store.query(
      "DELETE FROM ad_records WHERE namespace='x-lock' AND key=$1 AND data->>'nonce'=$2",
      [id, nonce],
    );
  };
}
const account = (s: Store, id: string) => s.get<Account>("x-account", id);
function uuidFor(ownerId: string, id: string) {
  const b = Buffer.from(
    digest("ad-x-bookmark:" + ownerId + ":" + id).slice(0, 32),
    "hex",
  );
  b[6] = (b[6] & 15) | 80;
  b[8] = (b[8] & 63) | 128;
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
export async function importBookmark(
  store: Store,
  ownerId: string,
  post: z.infer<typeof xPageSchema>["data"] extends (infer T)[] | undefined
    ? T
    : never,
) {
  const key = ownerId + ":" + post.id;
  const mapped = await store.get<{ referenceId: string }>("x-origin", key);
  let reference = mapped ? await store.read(ownerId, mapped.referenceId) : null;
  if (mapped && !reference)
    throw new ServiceError(409, "x_existing_reference_missing");
  if (!reference) {
    const candidates = await store.query(
      "SELECT reference FROM ad_saver WHERE owner_id=$1 AND reference->>'url' ~ $2 LIMIT 10",
      [
        ownerId,
        "^https://(www\\.)?(x|twitter)\\.com/(\\w+|i/web)/status/" +
          post.id +
          "/?([?#].*)?$",
      ],
    );
    for (const row of candidates) {
      const candidate = referenceSchema.parse(row.reference);
      if (xPostId(candidate.url) === post.id) {
        reference = candidate;
        break;
      }
    }
  }
  const importedAt = new Date().toISOString(),
    text = post.note_tweet?.text || post.text;
  if (!reference) {
    const original: Reference = {
      id: uuidFor(ownerId, post.id),
      title: "X · " + post.text.slice(0, 100),
      content: text.slice(0, 10000),
      url: "https://x.com/i/web/status/" + post.id,
      capturedAt: importedAt,
      approvedAt: importedAt,
      revision: 1,
      origin: "human",
      isInternalQA: false,
    };
    const existing = await store.read(ownerId, original.id);
    reference = existing || (await store.save(ownerId, original));
  }
  // Imported source data is a sidecar; never overwrite human metadata, groups or annotations.
  await store.query(
    "INSERT INTO ad_records(namespace,key,data) VALUES('x-post-snapshot',$1,$2::jsonb) ON CONFLICT(namespace,key) DO NOTHING",
    [
      key + ":" + digest(text),
      JSON.stringify({
        postId: post.id,
        sourceText: text,
        publishedAt: post.created_at || null,
        importedAt,
      }),
    ],
  );
  await store.put("x-origin", key, {
    referenceId: reference.id,
    provider: "x",
    kind: "bookmark",
    postId: post.id,
    publishedAt: post.created_at || null,
    bookmarkedAt: null,
    importedAt,
    sourceText: text,
    authorId: post.author_id || null,
  });
  const origin = await store.get<{ referenceId: string }>("x-origin", key);
  if (
    origin?.referenceId !== reference.id ||
    !(await store.read(ownerId, reference.id))
  )
    throw new ServiceError(503, "x_import_readback_failed");
  return reference.id;
}
export async function syncBookmarks(store: Store, c: Config) {
  const release = await lease(store, c.owner);
  let a = await account(store, c.owner);
  try {
    if (!a) throw new ServiceError(409, "x_not_connected");
    if (a.retryAt > Date.now()) throw new XRateLimit(a.retryAt);
    let tokens = unseal<Tokens>(a.encryptedTokens, "x-token:" + c.owner);
    if (a.expiresAt < Date.now() + 60000) {
      if (!tokens.refresh_token)
        throw new ServiceError(401, "x_reconnect_required");
      tokens = await exchange(
        { grant_type: "refresh_token", refresh_token: tokens.refresh_token },
        tokens,
      );
      a = {
        ...a,
        encryptedTokens: seal(tokens, "x-token:" + c.owner),
        expiresAt: Date.now() + tokens.expires_in * 1000,
        revision: a.revision + 1,
      };
      await store.put("x-account", c.owner, a);
    }
    const ids: string[] = [];
    let requests = 0;
    const previousCatchup = a.catchup;
    // Always inspect the newest bookmarks first. Post creation time is NOT bookmark time.
    for (const mode of ["head", "catchup"] as const) {
      if (mode === "catchup" && (!previousCatchup || a.phase !== "catchup"))
        continue;
      const cursor = mode === "head" ? null : previousCatchup;
      const q = new URLSearchParams({
        max_results: "50",
        "tweet.fields": "created_at,author_id,note_tweet",
      });
      if (cursor) q.set("pagination_token", cursor);
      const response = await provider(
        "/2/users/" + a.remoteId + "/bookmarks?" + q,
        { headers: { authorization: "Bearer " + tokens.access_token } },
      );
      requests++;
      const page = xPageSchema.parse(await response.json());
      if (page.errors?.length)
        throw new ServiceError(502, "x_partial_page_not_advanced");
      const posts = page.data || [];
      let allKnown = posts.length > 0;
      for (const post of posts)
        if (!(await store.get("x-origin", c.owner + ":" + post.id)))
          allKnown = false;
      for (const post of posts)
        ids.push(await importBookmark(store, c.owner, post));
      if (mode === "catchup") a.catchup = page.meta?.next_token || null;
      else if (!previousCatchup)
        a.catchup = allKnown ? null : page.meta?.next_token || null;
    }
    a.lastSyncAt = new Date().toISOString();
    a.retryAt = 0;
    a.phase = a.phase === "head" ? "catchup" : "head";
    a.revision++;
    await store.put("x-account", c.owner, a);
    await store.audit(c.owner, "x-official-api", "bookmark_sync", "verified");
    const verified = await account(store, c.owner);
    if (verified?.lastSyncAt !== a.lastSyncAt)
      throw new ServiceError(503, "x_sync_progress_unverified");
    return {
      verified: true,
      ids: [...new Set(ids)],
      received: ids.length,
      requests,
      catchingUp: !!a.catchup,
      syncedAt: a.lastSyncAt,
    };
  } catch (e) {
    if (a && e instanceof XRateLimit) {
      a.retryAt = e.retryAt;
      await store.put("x-account", c.owner, a);
    }
    throw e;
  } finally {
    await release();
  }
}
async function xRouteInternal(r: Request, s: Store, c: Config) {
  const path = new URL(r.url).pathname;
  const session = await owner(r, s, c, r.method !== "GET");
  if (path === "/api/x/status" && r.method === "GET") {
    const a = await account(s, c.owner);
    const configured =
      !!process.env.X_OAUTH_CLIENT_ID &&
      !!process.env.X_OAUTH_CLIENT_SECRET &&
      encryptionAvailable();
    return json({
      configured,
      permissions: a
        ? unseal<Tokens>(a.encryptedTokens, "x-token:" + c.owner)
            .scope.split(/\s+/)
            .filter(Boolean)
        : [],
      requestedPermissions: [...X_SCOPES],
      error: (await s.get<{ code: string }>("x-error", c.owner))?.code || null,
      connected: !!a,
      username: a?.username || "",
      enabled: a?.enabled || false,
      lastSyncAt: a?.lastSyncAt || null,
      retryAt: a?.retryAt || 0,
      catchingUp: !!a?.catchup,
      callback: c.app + "/api/x/callback",
      blocker: configured
        ? undefined
        : "Accès développeur X et identifiants OAuth serveur requis.",
    });
  }
  if (path === "/api/x/connect" && r.method === "POST") {
    const values = config(c);
    const release = await lease(s, c.owner);
    try {
      if (await account(s, c.owner))
        throw new ServiceError(409, "x_already_connected");
      const state = opaque(),
        verifier = opaque(),
        browser = opaque();
      await s.put(
        "x-state",
        digest(state),
        seal(
          {
            owner: session.owner,
            verifier,
            browser: digest(browser),
            sessionHash: digest(
              (r.headers.get("cookie") || "").match(
                /(?:^|;\s*)__Host-ad_session=([^;]+)/,
              )?.[1] || "",
            ),
            client: values.client,
          },
          "x-state:" + c.owner,
        ),
        600,
      );
      const url = new URL("https://x.com/i/oauth2/authorize");
      url.search = new URLSearchParams({
        response_type: "code",
        client_id: values.client,
        redirect_uri: values.callback,
        scope: X_SCOPES.join(" "),
        state,
        code_challenge: createHash("sha256")
          .update(verifier)
          .digest("base64url"),
        code_challenge_method: "S256",
      }).toString();
      return new Response(JSON.stringify({ url: url.href }), {
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
          "set-cookie": `__Host-ad_x_state=${browser}; Path=/; Max-Age=600; Secure; HttpOnly; SameSite=Lax`,
        },
      });
    } finally {
      await release();
    }
  }
  if (path === "/api/x/callback" && r.method === "GET") {
    const q = new URL(r.url).searchParams;
    const raw = await s.take<string>("x-state", digest(q.get("state") || ""));
    if (!raw) throw new ServiceError(401, "x_state_invalid_or_expired");
    const pending = unseal<Pending>(raw, "x-state:" + session.owner),
      values = config(c);
    const browser =
        (r.headers.get("cookie") || "").match(
          /(?:^|;\s*)__Host-ad_x_state=([^;]+)/,
        )?.[1] || "",
      sessionToken =
        (r.headers.get("cookie") || "").match(
          /(?:^|;\s*)__Host-ad_session=([^;]+)/,
        )?.[1] || "";
    if (
      pending.owner !== session.owner ||
      !equal(pending.browser, digest(browser)) ||
      !equal(pending.sessionHash, digest(sessionToken)) ||
      pending.client !== values.client
    )
      throw new ServiceError(401, "x_state_browser_mismatch");
    if (q.has("error"))
      return new Response(null, {
        status: 303,
        headers: {
          location: c.app + "/#/saver?x=cancelled",
          "cache-control": "no-store",
          "referrer-policy": "no-referrer",
        },
      });
    const code = z.string().min(1).max(3000).parse(q.get("code"));
    const release = await lease(s, c.owner);
    try {
      if (await account(s, c.owner))
        throw new ServiceError(409, "x_already_connected");
      const tokens = await exchange({
        grant_type: "authorization_code",
        code,
        code_verifier: pending.verifier,
        redirect_uri: values.callback,
      });
      const profile = z
        .object({
          data: z.object({
            id: z.string().regex(/^\d+$/),
            username: z.string().regex(/^\w+$/),
          }),
        })
        .parse(
          await (
            await provider("/2/users/me", {
              headers: { authorization: "Bearer " + tokens.access_token },
            })
          ).json(),
        );
      const a: Account = {
        remoteId: profile.data.id,
        username: profile.data.username,
        encryptedTokens: seal(tokens, "x-token:" + c.owner),
        expiresAt: Date.now() + tokens.expires_in * 1000,
        enabled: false,
        revision: 1,
        lastSyncAt: null,
        retryAt: 0,
        cursor: null,
        catchup: null,
        phase: "head",
      };
      await s.put("x-account", c.owner, a);
      await s.audit(c.owner, "owner", "x_connect", "verified");
      return new Response(null, {
        status: 303,
        headers: {
          location: c.app + "/#/saver?x=connected",
          "cache-control": "no-store",
          "referrer-policy": "no-referrer",
          "set-cookie":
            "__Host-ad_x_state=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax",
        },
      });
    } finally {
      await release();
    }
  }
  if (path === "/api/x/sync" && r.method === "POST") {
    await s.quota("x-sync:" + c.owner, 4, 900);
    const result = await syncBookmarks(s, c);
    await s.remove("x-error", c.owner);
    return json(result);
  }
  if (path === "/api/x/automatic" && r.method === "PUT") {
    const { enabled } = z
      .object({ enabled: z.boolean() })
      .strict()
      .parse(await r.json());
    const release = await lease(s, c.owner);
    try {
      const a = await account(s, c.owner);
      if (!a) throw new ServiceError(409, "x_not_connected");
      a.enabled = enabled;
      await s.put("x-account", c.owner, a);
      return json({
        enabled: (await account(s, c.owner))?.enabled,
        verified: true,
      });
    } finally {
      await release();
    }
  }
  if (path === "/api/x/disconnect" && r.method === "POST") {
    const release = await lease(s, c.owner);
    try {
      const a = await account(s, c.owner);
      let revoked = !a;
      if (a) {
        const tokens = unseal<Tokens>(a.encryptedTokens, "x-token:" + c.owner);
        try {
          await provider("/2/oauth2/revoke", {
            method: "POST",
            headers: {
              authorization: authHeader(),
              "content-type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              token: tokens.refresh_token || tokens.access_token,
              token_type_hint: tokens.refresh_token
                ? "refresh_token"
                : "access_token",
            }),
          });
          revoked = true;
        } catch {
          /* Local access is removed even if remote revocation fails. */
        }
        await s.remove("x-account", c.owner);
        await s.remove("x-error", c.owner);
      }
      return json({
        disconnected: !(await account(s, c.owner)),
        revoked,
        referencesPreserved: true,
      });
    } finally {
      await release();
    }
  }
  throw new ServiceError(405, "method_not_allowed");
}

export async function xRoute(r: Request, s: Store, c: Config) {
  try {
    return await xRouteInternal(r, s, c);
  } catch (e) {
    // Only known provider failures, never raw provider bodies or credentials.
    if (
      e instanceof ServiceError &&
      /^(x_|rate_limited)/.test(e.code) &&
      new URL(r.url).pathname !== "/api/x/status"
    ) {
      try {
        const session = await owner(r, s, c);
        await s.put("x-error", session.owner, {
          code: e.code,
          at: new Date().toISOString(),
        });
      } catch {
        /* original failure remains */
      }
    }
    throw e;
  }
}
