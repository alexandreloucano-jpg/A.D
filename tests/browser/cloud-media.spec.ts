import { test, expect } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
test("private photo and video transfer uploads bytes, resumes, and reads on a separate phone without source", async ({
  browser,
  baseURL,
}) => {
  const desktop = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    }),
    phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const id = "a8341c2d-5feb-4a3f-9c33-484da7eb8f74";
  const files = [
    {
      url: "https://pbs.twimg.com/media/qa.png",
      mime: "image/png",
      bytes: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=",
        "base64",
      ),
    },
    {
      url: "https://video.twimg.com/qa.mp4",
      mime: "video/mp4",
      bytes: await readFile("tests/fixtures/local-media.mp4"),
    },
  ];
  const assets = new Map<string, any>();
  let uploads = 0;
  for (const ctx of [desktop, phone]) {
    await ctx.route("https://*.twimg.com/**", async (r) => {
      const f = files.find((x) => x.url === r.request().url());
      await r.fulfill({
        status: ctx === phone ? 404 : 200,
        contentType: f?.mime,
        body: ctx === phone ? "gone" : f?.bytes,
        headers: { "access-control-allow-origin": "*" },
      });
    });
    await ctx.route("https://vercel.com/api/blob/**", async (r) => {
      const path = new URL(r.request().url()).searchParams.get("pathname");
      const a = [...assets.values()].find((a) => a.pathname === path);
      a.bytes = r.request().postDataBuffer();
      uploads++;
      await r.fulfill({
        json: {
          url: "https://fixture.private.blob.vercel-storage.com/" + path,
          pathname: path,
          contentType: a.mime,
          downloadUrl: "https://fixture.invalid/file",
          contentDisposition: "inline",
        },
      });
    });
    await ctx.route("**/api/**", async (r) => {
      if (new URL(r.request().url()).hostname === "vercel.com") {
        await r.fallback();
        return;
      }
      const u = new URL(r.request().url()),
        p = u.pathname,
        b = r.request().postDataJSON();
      let result: any = {};
      if (p === "/api/session")
        result = { authenticated: true, csrf: "fixture" };
      else if (p === "/api/media/status") result = { configured: true };
      else if (p === "/api/media/prepare") {
        const old = assets.get(b.sha256);
        result = old || {
          ...b,
          pathname: "saver/fixture/" + b.sha256,
          verified: false,
        };
        assets.set(b.sha256, result);
      } else if (p === "/api/media/upload") {
        expect(r.request().headers()["x-ad-csrf"]).toBe("fixture");
        result = { clientToken: "vercel_blob_client_fixture_test" };
      } else if (p.endsWith("/confirm")) {
        const sha = p.split("/")[3],
          a = assets.get(sha);
        expect(createHash("sha256").update(a.bytes).digest("hex")).toBe(sha);
        a.verified = true;
        result = { sha256: sha, bytes: a.bytes.length, verified: true };
      } else if (p === "/api/media/reference/" + id)
        result = {
          items: [...assets.values()].map((a) => ({
            ...a,
            sourceUrl: a.sourceUrl,
            url: a.verified ? "/api/media/" + a.sha256 : null,
          })),
        };
      else if (/^\/api\/media\/[a-f0-9]{64}$/.test(p)) {
        const a = assets.get(p.split("/").pop()!);
        await r.fulfill({ contentType: a.mime, body: a.bytes });
        return;
      } else if (p === "/api/intake")
        result = {
          sources: [
            {
              sourceText: "Texte source conservé",
              images: [files[0].url],
              videos: [files[1].url],
            },
          ],
        };
      else if (p === "/api/saver")
        result = {
          references: [
            {
              id,
              title: "Photo et vidéo privées",
              content: "QA",
              url: "https://x.com/i/web/status/123456789",
              origin: "human",
              capturedAt: new Date().toISOString(),
              approvedAt: new Date().toISOString(),
              revision: 1,
              isInternalQA: false,
            },
          ],
          next: null,
        };
      else if (p === "/api/collections")
        result = { collections: { version: 1, revision: 0, groups: [] } };
      await r.fulfill({ json: result });
    });
  }
  const page = await desktop.newPage();
  await page.goto(baseURL! + "/#/saver");
  const receipt = await page.evaluate(
    async ({ id, urls }) => {
      const a = "/src/intake/local-archive.ts",
        c = "/src/intake/cloud-media.ts";
      const archive = await import(a),
        cloud = await import(c);
      await archive.saveLocalCopies(
        [
          {
            url: "https://x.com/i/web/status/123456789",
            title: "QA",
            text: "QA",
            images: [urls[0]],
            videos: [urls[1]],
            notes: [],
            tags: [],
          },
        ],
        [id],
      );
      const remote = {
        reader: async (path: string, method = "GET", body?: unknown) => {
          const r = await fetch(path, {
            method,
            headers: { "content-type": "application/json" },
            body: body ? JSON.stringify(body) : undefined,
          });
          if (!r.ok) throw Error("fixture error");
          return r.json();
        },
      };
      const first = await cloud.syncCloudMedia([id], remote, () => {});
      await cloud.syncCloudMedia([id], remote, () => {});
      const originals = await Promise.all(
        urls.map((u: string) => archive.readLocalAsset(u)),
      );
      return { ...first, originals: originals.map((x) => x.blob.size) };
    },
    { id, urls: files.map((x) => x.url) },
  );
  expect(receipt.saved).toBe(2);
  expect(receipt.originals).toEqual(files.map((x) => x.bytes.length));
  expect(uploads).toBe(2);
  const mobile = await phone.newPage();
  await mobile.goto(baseURL! + "/#/saver");
  await mobile
    .getByRole("button", { name: "Reçu de sauvegarde", exact: true })
    .click();
  await mobile
    .getByText("Texte et vidéos synchronisés", { exact: true })
    .click();
  const image = mobile.getByAltText("Photo sauvegardée dans votre compte");
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((i: HTMLImageElement) => i.naturalWidth))
    .toBe(1);
  const video = mobile.locator('video[src^="/api/media/"]');
  await expect(video).toBeVisible();
  await video.evaluate((v: HTMLVideoElement) => {
    v.preload = "auto";
    v.load();
  });
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState))
    .toBeGreaterThanOrEqual(1);
  await mkdir("artifacts", { recursive: true });
  await mobile.screenshot({ path: "artifacts/private-media-390.png" });
  await page.screenshot({ path: "artifacts/private-media-1440.png" });
  await desktop.close();
  await phone.close();
});
