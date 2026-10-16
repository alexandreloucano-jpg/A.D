import { it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
it("binds transfer to its own extension, top-level A.D origin, nonce, tab and expiration", async () => {
  const origin =
      "https://ad-saver-reader-beta-alexandreloucano-3399.vercel.app",
    nonce = "fa2323ca-203f-4dd7-907b-4cf4bbafad09",
    key = "capture:" + nonce;
  const record = {
    createdAt: Date.now(),
    tabId: 42,
    items: [{ url: "https://x.com/i/web/status/1" }],
  };
  const stored: Record<string, unknown> = { [key]: record };
  let listener: (
    message: unknown,
    sender: unknown,
    reply: (value: unknown) => void,
  ) => boolean = () => false;
  const chrome = {
    runtime: {
      id: "own-extension",
      onMessage: {
        addListener: (fn: typeof listener) => {
          listener = fn;
        },
      },
    },
    storage: {
      local: {
        get: async (k: string) => ({ [k]: stored[k] }),
        remove: async (k: string) => {
          delete stored[k];
        },
      },
    },
  };
  const source = (
    await readFile("extensions/ad-saver/background.js", "utf8")
  ).replace(/^import[^\n]+\n/gm, "");
  runInNewContext(source, {
    chrome,
    Date,
    Error,
    collectRenderedPosts: () => {},
    crypto: globalThis.crypto,
  });
  const sender = {
    id: "own-extension",
    frameId: 0,
    origin,
    tab: { id: 42 },
    url: origin + "/#/saver",
  };
  const ask = (type: string, overrides = {}) =>
    new Promise<Record<string, unknown>>((resolve) =>
      listener({ type, nonce }, { ...sender, ...overrides }, (v) =>
        resolve(v as Record<string, unknown>),
      ),
    );
  expect(await ask("READ_CAPTURE", { tab: { id: 43 } })).toHaveProperty(
    "error",
  );
  expect(
    await ask("READ_CAPTURE", { origin: "https://evil.example" }),
  ).toHaveProperty("error");
  expect(await ask("READ_CAPTURE", { frameId: 1 })).toHaveProperty("error");
  const allowed = await ask("READ_CAPTURE");
  expect(allowed).toHaveProperty("items");
  expect(stored[key]).toBeDefined();
  await ask("CONFIRM_CAPTURE");
  expect(stored[key]).toBeUndefined();
  stored[key] = { ...record, createdAt: Date.now() - 25 * 60 * 60 * 1000 };
  expect(await ask("READ_CAPTURE")).toHaveProperty("error");
  expect(
    listener(
      { type: "READ_CAPTURE", nonce },
      { ...sender, id: "other-extension" },
      () => {},
    ),
  ).toBe(false);
});
it("packages only explicit user-triggered capture permissions", async () => {
  const manifest = JSON.parse(
    await readFile("extensions/ad-saver/manifest.json", "utf8"),
  );
  expect(manifest.permissions).not.toContain("debugger");
  expect(manifest.permissions).toContain("cookies");
  expect(manifest.permissions).toContain("webRequest");
  expect(manifest.host_permissions).toEqual([
    "https://x.com/*",
    "https://twitter.com/*",
    "https://abs.twimg.com/*",
    "https://pbs.twimg.com/*",
    "https://video.twimg.com/*",
  ]);
  expect(manifest.content_scripts[0].matches).toEqual([
    "https://ad-saver-reader-beta-alexandreloucano-3399.vercel.app/*",
  ]);
});
it("transfers only sanitized bookmark content from the extension page, never X session fields", async () => {
  const stored: Record<string, unknown> = {};
  let listener: (
    m: unknown,
    s: unknown,
    r: (v: Record<string, unknown>) => void,
  ) => boolean = () => false;
  const chrome = {
    runtime: {
      id: "own-extension",
      getURL: (p: string) => "chrome-extension://own-extension/" + p,
      onMessage: { addListener: (fn: typeof listener) => (listener = fn) },
    },
    storage: {
      local: {
        get: async (k: string) => ({ [k]: stored[k] }),
        set: async (v: Record<string, unknown>) => Object.assign(stored, v),
      },
    },
    tabs: { create: async () => ({ id: 91 }) },
  };
  const source = (
    await readFile("extensions/ad-saver/background.js", "utf8")
  ).replace(/^import[^\n]+\n/gm, "");
  runInNewContext(source, { chrome, Date, Error, crypto: globalThis.crypto });
  const reply = await new Promise<Record<string, unknown>>((resolve) =>
    listener(
      {
        type: "PREPARE_X_ARCHIVE",
        archiveUser: "123",
        nextOffset: 1,
        signature: "1",
        bookmarks: [
          {
            tweet_id: "987",
            full_text: "Visible text",
            authorization: "DO_NOT_TRANSFER",
            media: [],
            quoted_tweet: { tweet_id: "456", full_text: "Quoted source" },
          },
        ],
      },
      {
        id: "own-extension",
        tab: { id: 9 },
        url: "chrome-extension://own-extension/xarchive/options.html",
      },
      resolve,
    ),
  );
  expect(reply.prepared).toBe(1);
  expect(JSON.stringify(stored)).not.toContain("DO_NOT_TRANSFER");
  expect(JSON.stringify(stored)).toContain("Quoted source");
  const denied = await new Promise<Record<string, unknown>>((resolve) =>
    listener(
      { type: "PREPARE_X_ARCHIVE", bookmarks: [] },
      {
        id: "own-extension",
        tab: { id: 91 },
        url: "https://ad-saver-reader-beta-alexandreloucano-3399.vercel.app/",
      },
      resolve,
    ),
  );
  expect(denied.ok).toBe(false);
});
