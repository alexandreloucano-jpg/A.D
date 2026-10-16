import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const blob = vi.hoisted(() => ({ bytes: Buffer.from([]) }));
vi.mock("@vercel/blob", () => ({
  get: vi.fn(async () => ({
    statusCode: 200,
    headers: new Headers(),
    stream: new Response(blob.bytes).body,
  })),
}));
import { Store, digest } from "../server/store";
import { handle } from "../server/service";
import { mediaRange, mediaSignature } from "../server/media";
import type { Config } from "../server/security";
let pg: PGlite, s: Store, id: string;
const c: Config = {
  role: "app",
  app: "https://app.example",
  gateway: "https://gateway.example",
  owner: "340639438",
  githubClient: "",
  githubSecret: "",
  redirects: [],
};
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=",
  "base64",
);
const sha = createHash("sha256").update(png).digest("hex");
const source = "https://pbs.twimg.com/media/fixture.png";
function request(
  path: string,
  method = "GET",
  body?: unknown,
  csrf = "csrf",
  cookie = "media-fixture",
) {
  return new Request(c.app + "/api/media/" + path, {
    method,
    headers: {
      cookie: "__Host-ad_session=" + cookie,
      origin: c.app,
      "x-ad-csrf": csrf,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
const prepare = () => ({
  referenceId: id,
  sourceUrl: source,
  sha256: sha,
  size: png.length,
  mime: "image/png",
});
beforeAll(async () => {
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-only");
  pg = new PGlite();
  for (const file of [
    "001-private-saver.sql",
    "002-reader-beta.sql",
    "006-private-media.sql",
  ])
    await pg.exec(await readFile("sql/" + file, "utf8"));
  s = new Store(
    async (q, p = []) =>
      (await pg.query(q, p)).rows as Record<string, unknown>[],
  );
  await s.put(
    "session",
    digest("media-fixture"),
    { owner: c.owner, csrf: "csrf" },
    600,
  );
  const result = await handle(
    new Request(c.app + "/api/intake", {
      method: "POST",
      headers: {
        cookie: "__Host-ad_session=media-fixture",
        origin: c.app,
        "x-ad-csrf": "csrf",
      },
      body: JSON.stringify({
        method: "file",
        items: [
          {
            url: "https://x.com/a/status/123456",
            title: "Private media fixture",
            images: [source],
          },
        ],
      }),
    }),
    s,
    c,
  );
  id = (await result.json()).results[0].id;
}, 30000);
afterAll(async () => {
  await pg.close();
  vi.unstubAllEnvs();
});
it("validates media signatures and bounded Safari byte ranges", () => {
  expect(mediaSignature(png, "image/png")).toBe(true);
  expect(mediaSignature(Buffer.from("<html>"), "image/png")).toBe(false);
  expect(mediaRange("bytes=0-1", 100)).toEqual({ start: 0, end: 1 });
  expect(mediaRange("bytes=-2", 100)).toEqual({ start: 98, end: 99 });
  for (const value of ["bytes=100-", "bytes=-0", "bytes=0-1,3-4", "bytes=3-1"])
    expect(() => mediaRange(value, 100)).toThrow();
});
it("requires owner session, CSRF, and stays unavailable to gateway", async () => {
  expect(
    (await handle(request("status", "GET", undefined, "csrf", "absent"), s, c))
      .status,
  ).toBe(401);
  expect(
    (await handle(request("prepare", "POST", prepare(), "wrong"), s, c)).status,
  ).toBe(403);
  expect(
    (
      await handle(new Request(c.gateway + "/api/media/status"), s, {
        ...c,
        role: "gateway",
      })
    ).status,
  ).toBe(404);
});
it("rejects foreign references and undeclared media sources", async () => {
  expect(
    (
      await handle(
        request("prepare", "POST", {
          ...prepare(),
          referenceId: "a8341c2d-5feb-4a3f-9c33-484da7eb8f74",
        }),
        s,
        c,
      )
    ).status,
  ).toBe(404);
  expect(
    (
      await handle(
        request("prepare", "POST", {
          ...prepare(),
          sourceUrl: "https://example.com/not-owned.png",
        }),
        s,
        c,
      )
    ).status,
  ).toBe(403);
});
it("deduplicates reservations and confirms only exact bytes after private readback", async () => {
  for (let i = 0; i < 2; i++) {
    const response = await handle(request("prepare", "POST", prepare()), s, c);
    expect(response.status).toBe(200);
    expect((await response.json()).verified).toBe(false);
  }
  expect(
    (await s.query("SELECT reserved_bytes FROM ad_media_budget"))[0]
      .reserved_bytes,
  ).toBe(png.length);
  blob.bytes = Buffer.from("corrupted");
  expect(
    (await handle(request(sha + "/confirm", "POST", {}), s, c)).status,
  ).toBe(409);
  expect((await handle(request(sha), s, c)).status).toBe(404);
  blob.bytes = png;
  const confirmed = await handle(request(sha + "/confirm", "POST", {}), s, c);
  expect(await confirmed.json()).toEqual({
    sha256: sha,
    bytes: png.length,
    verified: true,
  });
  const data = await handle(request(sha), s, c);
  expect(data.headers.get("cache-control")).toBe("private, no-store");
  expect(Buffer.from(await data.arrayBuffer())).toEqual(png);
  const listed = await handle(request("reference/" + id), s, c);
  expect((await listed.json()).items[0].url).toBe("/api/media/" + sha);
});
it("blocks over-limit reservation without changing stored originals", async () => {
  await s.query("UPDATE ad_media_budget SET reserved_bytes=943718400");
  const result = await handle(
    request("prepare", "POST", { ...prepare(), sha256: "b".repeat(64) }),
    s,
    c,
  );
  expect(result.status).toBe(409);
  expect(
    (await s.query("SELECT count(*)::int AS n FROM ad_media_assets"))[0].n,
  ).toBe(1);
  expect(await s.read(c.owner, id)).not.toBeNull();
});
