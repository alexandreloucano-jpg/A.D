import {
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
  it,
  expect,
  vi,
} from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Store, digest } from "../server/store";
import { handle } from "../server/service";
import { syncBookmarks, importBookmark } from "../server/x";
import { seal, unseal } from "../server/secrets";
import { X_SCOPES } from "../src/social/model";
import { ReaderStore } from "../server/reader";
import type { Config } from "../server/security";
let pg: PGlite, s: Store;
const c: Config = {
  role: "app",
  app: "https://app.example",
  gateway: "https://gateway.example",
  owner: "340639438",
  githubClient: "",
  githubSecret: "",
  redirects: [],
};
beforeAll(async () => {
  pg = new PGlite();
  for (const file of ["001-private-saver.sql", "002-reader-beta.sql"])
    await pg.exec(await readFile("sql/" + file, "utf8"));
  s = new Store(
    async (q, p = []) =>
      (await pg.query(q, p)).rows as Record<string, unknown>[],
  );
}, 30000);
beforeEach(async () => {
  await pg.exec(
    "TRUNCATE ad_records,ad_saver,ad_quota,ad_audit,ad_reader_annotations,ad_reader_documents,ad_reader_heads",
  );
  vi.stubEnv("X_OAUTH_CLIENT_ID", "fixture-client");
  vi.stubEnv("X_OAUTH_CLIENT_SECRET", "fixture-secret");
  vi.stubEnv(
    "AD_TOKEN_ENCRYPTION_KEY",
    Buffer.alloc(32, 42).toString("base64"),
  );
  await s.put(
    "session",
    digest("fixture-session"),
    { owner: c.owner, csrf: "csrf" },
    600,
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
afterAll(async () => pg.close());
const request = (
  path: string,
  method = "GET",
  cookie = "__Host-ad_session=fixture-session",
) =>
  new Request(c.app + path, {
    method,
    headers: { cookie, origin: c.app, "x-ad-csrf": "csrf" },
  });
async function connected() {
  const now = new Date().toISOString();
  await s.put("x-account", c.owner, {
    remoteId: "123",
    username: "fixture",
    encryptedTokens: seal(
      {
        access_token: "fixture-access",
        refresh_token: "fixture-refresh",
        scope: X_SCOPES.join(" "),
        token_type: "bearer",
        expires_in: 7200,
      },
      "x-token:" + c.owner,
    ),
    expiresAt: Date.now() + 7200000,
    enabled: true,
    revision: 1,
    lastSyncAt: null,
    retryAt: 0,
    cursor: null,
    catchup: null,
    phase: "head",
  });
  return now;
}
it("uses PKCE S256, exact read scopes, one-use state and browser/session binding", async () => {
  const start = await handle(request("/api/x/connect", "POST"), s, c);
  expect(start.status).toBe(200);
  const { url } = await start.json(),
    authorization = new URL(url);
  expect(authorization.origin).toBe("https://x.com");
  expect(authorization.searchParams.get("code_challenge_method")).toBe("S256");
  expect(authorization.searchParams.get("scope")?.split(" ")).toEqual(X_SCOPES);
  expect(authorization.searchParams.get("scope")).not.toContain("write");
  const state = authorization.searchParams.get("state");
  const wrong = await handle(
    request("/api/x/callback?code=fixture&state=" + state),
    s,
    c,
  );
  expect(wrong.status).toBe(401);
  expect(
    (await handle(request("/api/x/callback?code=fixture&state=" + state), s, c))
      .status,
  ).toBe(401);
});
it("exchanges a real-shaped code only after browser binding and stores encrypted tokens", async () => {
  const start = await handle(request("/api/x/connect", "POST"), s, c);
  const { url } = await start.json(),
    state = new URL(url).searchParams.get("state"),
    browser = start.headers.get("set-cookie")!.split(";")[0];
  let calls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls++;
      return new Response(
        JSON.stringify(
          url.endsWith("/token")
            ? {
                access_token: "private-fixture-access",
                refresh_token: "private-fixture-refresh",
                scope: X_SCOPES.join(" "),
                token_type: "bearer",
                expires_in: 7200,
              }
            : url.includes("/bookmarks")
              ? {
                  data: [
                    {
                      id: "777",
                      text: "Signet de test importé après consentement",
                    },
                  ],
                  meta: {},
                }
              : { data: { id: "123", username: "fixture" } },
        ),
        { headers: { "content-type": "application/json" } },
      );
    }),
  );
  const result = await handle(
    request(
      "/api/x/callback?code=fixture&state=" + state,
      "GET",
      "__Host-ad_session=fixture-session; " + browser,
    ),
    s,
    c,
  );
  expect(result.status).toBe(303);
  expect(calls).toBe(3);
  expect((await s.list(c.owner)).length).toBe(1);
  const stored = await s.get<any>("x-account", c.owner);
  expect(stored.enabled).toBe(true);
  expect(stored.lastSyncAt).toBeTruthy();
  expect(JSON.stringify(stored)).not.toContain("private-fixture");
  expect(
    unseal<any>(stored.encryptedTokens, "x-token:" + c.owner).access_token,
  ).toBe("private-fixture-access");
  expect(() => unseal(stored.encryptedTokens, "x-token:other")).toThrow();
  const status = await handle(request("/api/x/status"), s, c);
  expect(JSON.stringify(await status.json())).not.toContain("private-fixture");
});
it("imports bookmarks with stable UUIDs, incrementally finds a newly bookmarked OLD post and preserves groups/notes", async () => {
  await connected();
  const pages = [
    {
      data: [
        {
          id: "900",
          text: "Original source",
          created_at: "2020-01-01T00:00:00.000Z",
        },
      ],
      meta: { next_token: "older" },
    },
    {
      data: [
        { id: "50", text: "Old publication, new bookmark" },
        { id: "900", text: "Original source" },
      ],
    },
    { data: [{ id: "900", text: "Original source" }] },
  ];
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(pages.shift()))),
  );
  const first = await syncBookmarks(s, c),
    id = first.ids[0];
  await s.put("collections", c.owner, {
    version: 1,
    revision: 1,
    groups: [
      {
        id: randomUUID(),
        name: "Manual",
        referenceIds: [id],
        createdAt: new Date().toISOString(),
      },
    ],
  });
  const reference = (await s.read(c.owner, id))!;
  const reader = new ReaderStore(s),
    doc = await reader.current(c.owner, reference);
  const note = await reader.create(c.owner, reference, {
    id: randomUUID(),
    contentVersion: doc.version,
    kind: "note",
    anchor: {
      start: 0,
      end: 8,
      exact: "Original",
      prefix: "",
      suffix: " source",
    },
    note: "Human annotation",
  });
  const second = await syncBookmarks(s, c);
  expect(second.ids).toContain(id);
  expect(second.ids).toHaveLength(2);
  expect(await reader.read(c.owner, id, note.id)).toEqual(note);
  expect(
    (await s.get<any>("collections", c.owner)).groups[0].referenceIds,
  ).toEqual([id]);
  expect((await s.list(c.owner)).length).toBe(2);
  expect((await reader.current(c.owner, reference)).publishedAt).not.toBe(
    reference.capturedAt,
  );
});
it("does not overwrite an existing manual capture for the same X status", async () => {
  const now = new Date().toISOString(),
    id = randomUUID();
  await s.save(c.owner, {
    id,
    title: "Human correction",
    content: "Human note",
    url: "https://twitter.com/author/status/900?ref=original",
    capturedAt: now,
    approvedAt: now,
    revision: 2,
    origin: "human",
    isInternalQA: false,
  });
  const imported = await importBookmark(s, c.owner, {
    id: "900",
    text: "Provider source",
  });
  expect(imported).toBe(id);
  expect((await s.read(c.owner, id))?.content).toBe("Human note");
  expect((await s.read(c.owner, id))?.revision).toBe(2);
});
it("persists rate-limit backoff and rejects concurrent syncs without losing the cursor", async () => {
  await connected();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response("", {
          status: 429,
          headers: {
            "x-rate-limit-reset": String(Math.ceil(Date.now() / 1000) + 900),
          },
        }),
    ),
  );
  await expect(syncBookmarks(s, c)).rejects.toMatchObject({ status: 429 });
  const a = await s.get<any>("x-account", c.owner);
  expect(a.retryAt).toBeGreaterThan(Date.now());
  expect(a.catchup).toBeNull();
  await expect(syncBookmarks(s, c)).rejects.toMatchObject({ status: 429 });
  expect(fetch).toHaveBeenCalledTimes(1);
  await s.put("x-lock", c.owner, { nonce: "concurrent" }, 60);
  await expect(syncBookmarks(s, c)).rejects.toMatchObject({ status: 409 });
});
it("keeps partial pages retryable and refuses non-owner access or a gateway role", async () => {
  await connected();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: [{ id: "2", text: "partial" }],
            errors: [{ detail: "missing" }],
            meta: { next_token: "must-not-advance" },
          }),
        ),
    ),
  );
  await expect(syncBookmarks(s, c)).rejects.toMatchObject({ status: 502 });
  expect((await s.get<any>("x-account", c.owner)).catchup).toBeNull();
  expect((await s.list(c.owner)).length).toBe(0);
  expect(
    (await handle(new Request(c.app + "/api/x/status"), s, c)).status,
  ).toBe(401);
  expect(
    (
      await handle(new Request(c.gateway + "/api/x/status"), s, {
        ...c,
        role: "gateway",
      })
    ).status,
  ).toBe(404);
});
it("refreshes expired tokens under the sync lease and stores the rotated refresh token encrypted", async () => {
  await connected();
  const initial = await s.get<any>("x-account", c.owner);
  await s.put("x-account", c.owner, { ...initial, expiresAt: 1 });
  let calls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls++;
      return new Response(
        JSON.stringify(
          url.endsWith("/token")
            ? {
                access_token: "rotated-access",
                refresh_token: "rotated-refresh",
                scope: X_SCOPES.join(" "),
                token_type: "bearer",
                expires_in: 7200,
              }
            : { data: [] },
        ),
      );
    }),
  );
  await syncBookmarks(s, c);
  const stored = await s.get<any>("x-account", c.owner);
  expect(
    unseal<any>(stored.encryptedTokens, "x-token:" + c.owner).refresh_token,
  ).toBe("rotated-refresh");
  expect(JSON.stringify(stored)).not.toContain("rotated-refresh");
  expect(calls).toBe(2);
});
it("preserves old annotated X versions and searches updated provider text without overwriting the reference", async () => {
  const id = await importBookmark(s, c.owner, {
    id: "901",
    text: "Old source sentence.",
  });
  const reference = (await s.read(c.owner, id))!,
    reader = new ReaderStore(s),
    doc = await reader.current(c.owner, reference);
  await reader.create(c.owner, reference, {
    id: randomUUID(),
    contentVersion: doc.version,
    kind: "highlight",
    anchor: {
      start: 0,
      end: 3,
      exact: "Old",
      prefix: "",
      suffix: " source sentence.",
    },
    note: "",
  });
  await importBookmark(s, c.owner, {
    id: "901",
    text: "Updated source with a new distinctive keyword.",
  });
  expect((await reader.current(c.owner, reference)).version).not.toBe(
    doc.version,
  );
  const snapshots = await s.query(
    "SELECT document FROM ad_reader_documents WHERE owner_id=$1 AND reference_id=$2 AND version=$3",
    [c.owner, id, doc.version],
  );
  expect((snapshots[0].document as any).text).toBe("Old source sentence.");
  expect(
    (await reader.search(c.owner, "distinctive keyword"))[0].referenceId,
  ).toBe(id);
  expect((await s.read(c.owner, id))?.content).toBe("Old source sentence.");
});
