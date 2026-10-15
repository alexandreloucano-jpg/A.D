import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Store, digest } from "../server/store";
import { ReaderStore, documentFrom } from "../server/reader";
import { anchorFor, anchorMatches, paragraphs } from "../src/reader/model";
import { handle } from "../server/service";
import type { Config } from "../server/security";
import type { Reference } from "../src/domain";
let pg: PGlite, s: Store, reader: ReaderStore;
const config: Config = {
  role: "app",
  app: "https://reader.example",
  gateway: "https://gateway.example",
  owner: "340639438",
  githubClient: "",
  githubSecret: "",
  redirects: [],
};
const ref = (): Reference => ({
  id: randomUUID(),
  title: "Isolated reader fixture",
  url: "https://example.org/source",
  content:
    "Premier paragraphe avec une idée.\n\nUn deuxième paragraphe avec une nuance.",
  capturedAt: new Date().toISOString(),
  approvedAt: new Date().toISOString(),
  revision: 1,
  origin: "human",
  isInternalQA: false,
});
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(await readFile("sql/001-private-saver.sql", "utf8"));
  await pg.exec(await readFile("sql/002-reader-beta.sql", "utf8"));
  s = new Store(async (sql, params = []) => {
    const result = await pg.query(sql, params);
    return result.rows as Record<string, unknown>[];
  });
  reader = new ReaderStore(s);
}, 30000);
beforeEach(async () => {
  await pg.exec(
    "TRUNCATE ad_saver,ad_records,ad_quota,ad_audit,ad_reader_documents,ad_reader_heads,ad_reader_annotations",
  );
});
afterAll(async () => {
  await pg.close();
});
async function setup() {
  const reference = ref();
  await s.save(config.owner, reference);
  return reference;
}
async function note(reference: Reference) {
  const doc = await reader.current(config.owner, reference);
  return {
    id: randomUUID(),
    contentVersion: doc.version,
    kind: "note" as const,
    anchor: anchorFor(doc.text, 0, 18),
    note: "Retrouver la tension entre la matière et le silence.",
  };
}
describe("Reader SQL persistence and stable anchors", () => {
  it("stores a quote and note exactly, rereads with another store instance and searches their words", async () => {
    const reference = await setup(),
      input = await note(reference);
    const saved = await reader.create(config.owner, reference, input);
    const fresh = new ReaderStore(new Store(s.query));
    expect(await fresh.read(config.owner, reference.id, saved.id)).toEqual(
      saved,
    );
    expect(saved.anchor.exact).toBe(reference.content.slice(0, 18));
    expect(
      await fresh.search(config.owner, "matière et le silence"),
    ).toMatchObject([{ referenceId: reference.id, annotationId: saved.id }]);
    expect(await fresh.search(config.owner, "Premier paragraphe")).toHaveLength(
      1,
    );
    expect((await s.read(config.owner, reference.id))?.content).toBe(
      reference.content,
    );
  });
  it("versions manual text without moving old annotations and rejects stale writes", async () => {
    const reference = await setup(),
      input = await note(reference);
    await reader.create(config.owner, reference, input);
    const initial = await reader.current(config.owner, reference);
    const next = await reader.document(
      config.owner,
      reference,
      "Nouveau texte disponible.\n\nLes anciennes notes sont conservées.",
      initial.version,
    );
    expect(next.version).not.toBe(initial.version);
    expect(
      (await reader.annotations(config.owner, reference.id))[0].contentVersion,
    ).toBe(initial.version);
    await expect(
      reader.document(
        config.owner,
        reference,
        "Concurrent stale edit",
        initial.version,
      ),
    ).rejects.toThrow("content_version_changed");
    await expect(
      reader.create(config.owner, reference, { ...input, id: randomUUID() }),
    ).rejects.toThrow("anchor_or_version_changed");
    expect((await s.read(config.owner, reference.id))?.content).toBe(
      reference.content,
    );
  });
  it("edits and deletes annotations with revision checks and never deletes the reference", async () => {
    const reference = await setup(),
      input = await note(reference);
    const saved = await reader.create(config.owner, reference, input);
    const updated = await reader.edit(
      config.owner,
      reference.id,
      saved.id,
      "Correction humaine exacte",
      saved.revision,
    );
    expect(updated!.note).toBe("Correction humaine exacte");
    await expect(
      reader.edit(config.owner, reference.id, saved.id, "Lost update", 1),
    ).rejects.toThrow("annotation_changed");
    await reader.remove(
      config.owner,
      reference.id,
      saved.id,
      updated!.revision,
    );
    expect(await reader.read(config.owner, reference.id, saved.id)).toBeNull();
    expect((await s.read(config.owner, reference.id))?.id).toBe(reference.id);
  });
  it("isolates owners, rejects forged anchors and excludes QA from rediscovery search", async () => {
    const reference = await setup(),
      input = await note(reference);
    const saved = await reader.create(config.owner, reference, input);
    expect(await reader.read("other-owner", reference.id, saved.id)).toBeNull();
    expect(await reader.search("other-owner", "matière")).toHaveLength(0);
    await expect(
      reader.create(config.owner, reference, {
        ...input,
        id: randomUUID(),
        anchor: { ...input.anchor, exact: "forged quote" },
      }),
    ).rejects.toThrow("anchor_or_version_changed");
    const qa = { ...ref(), isInternalQA: true, title: "QA technique" };
    await s.save(config.owner, qa);
    await reader.create(config.owner, qa, {
      ...(await note(qa)),
      note: "secret QA-only phrase",
    });
    expect(await reader.search(config.owner, "QA-only")).toHaveLength(0);
    expect(await s.read(config.owner, qa.id)).not.toBeNull();
  });
  it("retains original media and reports unavailable text rather than inventing an article", () => {
    const image = {
      ...ref(),
      url: "https://example.org/image.jpg",
      content: "",
    };
    expect(documentFrom(image).kind).toBe("image");
    expect(
      documentFrom({ ...image, url: "https://example.org/book.pdf" }).kind,
    ).toBe("pdf");
    expect(
      documentFrom({ ...image, url: "https://example.org/blocked" }),
    ).toMatchObject({ kind: "unavailable", text: "", publishedAt: null });
  });
  it("requires owner auth, rejects Scout bearer tokens and honestly reports absent AI", async () => {
    const reference = await setup();
    expect(
      (
        await handle(
          new Request(config.app + "/api/reader/" + reference.id),
          s,
          config,
        )
      ).status,
    ).toBe(401);
    await s.put(
      "session",
      digest("reader-fixture"),
      { owner: config.owner, csrf: "reader-csrf" },
      3600,
    );
    const headers = {
      cookie: "__Host-ad_session=reader-fixture",
      origin: config.app,
      "x-ad-csrf": "reader-csrf",
    };
    expect(
      (
        await handle(
          new Request(config.app + "/api/reader/" + reference.id, {
            headers: { ...headers, authorization: "Bearer " + "A".repeat(43) },
          }),
          s,
          config,
        )
      ).status,
    ).toBe(401);
    const doc = await reader.current(config.owner, reference);
    const result = await handle(
      new Request(config.app + "/api/reader/" + reference.id + "/question", {
        method: "POST",
        headers,
        body: JSON.stringify({
          question: "Que peut-on conclure ?",
          contentVersion: doc.version,
          anchor: anchorFor(doc.text, 0, 18),
        }),
      }),
      s,
      config,
    );
    expect(result.status).toBe(503);
    expect((await result.json()).error).toBe(
      "authorized_ai_provider_unavailable",
    );
    expect(await reader.annotations(config.owner, reference.id)).toHaveLength(
      0,
    );
  });
  it("keeps uncertain annotation receipts recoverable and rejects conflicting id reuse", async () => {
    const reference = await setup(),
      input = await note(reference);
    let failed = false;
    const broken = new ReaderStore(
      new Store(async (sql, params) => {
        if (
          sql.startsWith("SELECT annotation FROM ad_reader_annotations") &&
          !failed
        ) {
          failed = true;
          throw Error("readback outage");
        }
        return s.query(sql, params);
      }),
    );
    await expect(broken.create(config.owner, reference, input)).rejects.toThrow(
      "readback outage",
    );
    const recovered = await reader.create(config.owner, reference, input);
    expect(recovered.id).toBe(input.id);
    expect(await reader.annotations(config.owner, reference.id)).toHaveLength(
      1,
    );
    await expect(
      reader.create(config.owner, reference, {
        ...input,
        note: "conflicting note",
      }),
    ).rejects.toThrow("annotation_conflict");
  });
  it("uses exact UTF-16 offsets and paragraph citations without normalizing text", () => {
    const text = "Été 🌅 et idées.\n\nDeuxième paragraphe.";
    const a = anchorFor(text, 4, 10);
    expect(anchorMatches(text, a)).toBe(true);
    expect(anchorMatches("Préfixe " + text, a)).toBe(false);
    expect(
      paragraphs(text)
        .map((p) => p.text)
        .join(""),
    ).toBe(text);
    expect(
      paragraphs(text)
        .filter((p) => !p.separator)
        .map((p) => p.id),
    ).toEqual(["p-0", "p-18"]);
  });
});
