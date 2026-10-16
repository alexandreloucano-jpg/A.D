import { it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { parseBookmarkFile } from "../src/intake/parse";
it("reads xarchive text, media, quoted-independent source and folders without treating folder names as new groups", () => {
  const file = {
    export_metadata: { tool: "xarchive", schema_version: 2, user_id: "123" },
    bookmarks: [
      {
        tweet_id: "987",
        full_text: "Texte complet",
        folders: ["Architecture"],
        media: [
          { type: "photo", url: "https://pbs.twimg.com/media/a.jpg" },
          {
            type: "video",
            thumbnail_url: "https://pbs.twimg.com/media/b.jpg",
            variants: [
              {
                content_type: "video/mp4",
                url: "https://video.twimg.com/one.mp4",
                bitrate: 256000,
              },
            ],
          },
        ],
      },
    ],
  };
  const result = parseBookmarkFile(JSON.stringify(file), "archive.json");
  expect(result.items[0]).toMatchObject({
    url: "https://x.com/i/web/status/987",
    text: "Texte complet",
    originalText: "Texte complet",
    videos: ["https://video.twimg.com/one.mp4"],
    images: [
      "https://pbs.twimg.com/media/a.jpg",
      "https://pbs.twimg.com/media/b.jpg",
    ],
    tags: ["Architecture"],
  });
});
it("downloads only public X CDN media, omits session credentials and rejects oversized files", async () => {
  const source = (
    await readFile("extensions/ad-saver/media.js", "utf8")
  ).replace(/^export /gm, "");
  const context = {
    URL,
    AbortSignal,
    Uint8Array,
    btoa,
    Error,
    fetch: async (url: string, init: RequestInit) => {
      expect(init.credentials).toBe("omit");
      expect(init.redirect).toBe("error");
      expect(init.headers).toBeUndefined();
      return new Response("bytes", {
        headers: { "content-type": "image/png" },
      });
    },
    api: undefined as unknown,
  };
  runInNewContext(
    source + "\nglobalThis.api={allowedMedia,fetchMedia};",
    context,
  );
  const api = context.api as {
    allowedMedia: (v: string) => boolean;
    fetchMedia: (v: string) => Promise<{ mime: string; base64: string }>;
  };
  expect(api.allowedMedia("https://evil.example/a.jpg")).toBe(false);
  expect(api.allowedMedia("https://video.twimg.com/a.mp4?token=secret")).toBe(
    false,
  );
  expect(api.allowedMedia("http://pbs.twimg.com/a.jpg")).toBe(false);
  expect(api.allowedMedia("https://user:pass@pbs.twimg.com/a.jpg")).toBe(false);
  await expect(api.fetchMedia("https://pbs.twimg.com/a.png")).resolves.toEqual({
    mime: "image/png",
    base64: btoa("bytes"),
  });
  context.fetch = async () =>
    new Response("bytes", {
      headers: {
        "content-type": "video/mp4",
        "content-length": String(25 * 1024 * 1024),
      },
    });
  await expect(api.fetchMedia("https://video.twimg.com/a.mp4")).rejects.toThrow(
    "volumineux",
  );
});
