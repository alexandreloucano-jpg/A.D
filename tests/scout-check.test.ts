import { it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Store, digest } from "../server/store";
import { handle } from "../server/service";
import type { Config } from "../server/security";
it("uses explicit owner OAuth consent for a temporary diagnostic client and revokes it after a real-shaped read", async () => {
  const pg = new PGlite();
  vi.stubEnv(
    "AD_TOKEN_ENCRYPTION_KEY",
    Buffer.alloc(32, 22).toString("base64"),
  );
  try {
    await pg.exec(await readFile("sql/001-private-saver.sql", "utf8"));
    const store = new Store(
      async (q, p = []) =>
        (await pg.query(q, p)).rows as Record<string, unknown>[],
    );
    const c: Config = {
      role: "app",
      app: "https://app.example",
      gateway: "https://gateway.example",
      owner: "340639438",
      githubClient: "",
      githubSecret: "",
      redirects: ["https://app.example/api/scout/check/callback"],
    };
    await store.put(
      "session",
      digest("owner"),
      { owner: c.owner, csrf: "csrf" },
      600,
    );
    const now = new Date().toISOString();
    await store.save(c.owner, {
      id: randomUUID(),
      title: "Isolated fixture",
      content: "Source",
      capturedAt: now,
      approvedAt: now,
      origin: "human",
      isInternalQA: false,
      revision: 1,
    });
    const headers = {
      cookie: "__Host-ad_session=owner",
      origin: c.app,
      "x-ad-csrf": "csrf",
    };
    const start = await handle(
      new Request(c.app + "/api/scout/check/start", {
        method: "POST",
        headers,
      }),
      store,
      c,
    );
    const { url } = await start.json();
    const consent = await handle(new Request(url, { headers }), store, c);
    const html = await consent.text(),
      pending = html.match(/name="pending" value="([^"]+)"/)![1];
    const approval = await handle(
      new Request(c.app + "/api/oauth/authorize", {
        method: "POST",
        headers: {
          ...headers,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          pending,
          csrf: "csrf",
          decision: "approve",
        }),
      }),
      store,
      c,
    );
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init: RequestInit) =>
        handle(new Request(url, init), store, { ...c, role: "gateway" }),
      ),
    );
    const finished = await handle(
      new Request(approval.headers.get("location")!, { headers }),
      store,
      c,
    );
    expect(finished.status).toBe(303);
    const result = await store.get<any>("scout-check-result", c.owner);
    expect(result).toMatchObject({
      verified: true,
      authenticated: true,
      referenceCount: 1,
      onlyFourSaverTools: true,
      globalToolDenied: true,
      temporaryClientRevoked: true,
      grokConnected: false,
    });
    expect(
      (
        await store.query(
          "SELECT data FROM ad_records WHERE namespace='client'",
        )
      ).every((r) => (r.data as any).revoked),
    ).toBe(true);
    expect(
      (await store.query("SELECT key FROM ad_records WHERE namespace='token'"))
        .length,
    ).toBe(0);
    expect(
      (
        await handle(
          new Request(approval.headers.get("location")!, { headers }),
          store,
          c,
        )
      ).status,
    ).toBe(401);
  } finally {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    await pg.close();
  }
}, 30000);
