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
import { answerQuestion, classificationRoute } from "../server/ai";
import { ReaderStore } from "../server/reader";
import { anchorFor } from "../src/reader/model";
import { tasteRoute } from "../server/taste";
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
const makeRef = () => ({
  id: randomUUID(),
  title: "Fixture",
  content:
    "La matière crée une tension précise.\n\nLa source ne fournit aucun prix.",
  capturedAt: new Date().toISOString(),
  approvedAt: new Date().toISOString(),
  revision: 1,
  origin: "human" as const,
  isInternalQA: false,
});
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
  vi.stubEnv("AD_AI_ENABLED", "1");
  vi.stubEnv("AD_AI_PROVIDER", "xai");
  vi.stubEnv("XAI_API_KEY", "fixture-key");
  vi.stubEnv("XAI_MODEL", "explicit-test-model");
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
function provider(value: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(value) } }],
          }),
        ),
    ),
  );
}
it("verifies citations, persists provider provenance and exposes answers separately in Taste", async () => {
  const ref = makeRef();
  await s.save(c.owner, ref);
  const doc = await new ReaderStore(s).current(c.owner, ref);
  provider({
    explicit: "Une tension est décrite.",
    inferences: "Une piste esthétique, pas une préférence confirmée.",
    unknowns: "Le prix est inconnu.",
    citations: [
      { paragraphId: "p-0", quote: "La matière crée une tension précise." },
    ],
  });
  const answer = await answerQuestion(s, c.owner, ref, doc, {
    question: "Que dit cette source ?",
    anchor: anchorFor(doc.text, 0, 10),
  });
  expect(answer.provenance.model).toBe("explicit-test-model");
  expect(fetch).toHaveBeenCalledTimes(1);
  const taste = await tasteRoute(
    new Request(c.app + "/api/taste/context?reference=" + ref.id, {
      headers: { cookie: "__Host-ad_session=fixture-session" },
    }),
    s,
    c,
  );
  const result = await taste.json();
  expect(result.aiInterpretations).toHaveLength(1);
  expect(result.updatesConfirmedPreferences).toBe(false);
  expect(result.createsTasks).toBe(false);
  expect(result.humanAnnotations).toEqual([]);
});
it("rejects invented citations, mismatched anchors and absent authorized provider configuration", async () => {
  const ref = makeRef(),
    doc = await new ReaderStore(s).current(c.owner, ref);
  provider({
    explicit: "Invented",
    inferences: "",
    unknowns: "",
    citations: [{ paragraphId: "p-0", quote: "Invented quotation" }],
  });
  await expect(
    answerQuestion(s, c.owner, ref, doc, {
      question: "?",
      anchor: anchorFor(doc.text, 0, 10),
    }),
  ).rejects.toMatchObject({ code: "ai_citation_unverified" });
  expect(
    (
      await s.query(
        "SELECT key FROM ad_records WHERE namespace='reader-answer'",
      )
    ).length,
  ).toBe(0);
  await expect(
    answerQuestion(s, c.owner, ref, doc, {
      question: "?",
      anchor: { ...anchorFor(doc.text, 0, 10), exact: "forged" },
    }),
  ).rejects.toMatchObject({ status: 409 });
  vi.stubEnv("AD_AI_ENABLED", "0");
  await expect(
    answerQuestion(s, c.owner, ref, doc, {
      question: "?",
      anchor: anchorFor(doc.text, 0, 10),
    }),
  ).rejects.toMatchObject({ code: "authorized_ai_provider_unavailable" });
});
it("returns grounded group proposals with mandatory approval and creates no collection", async () => {
  const ref = makeRef();
  await s.save(c.owner, ref);
  provider({
    groups: [
      {
        name: "Matières",
        referenceIds: [ref.id],
        rationale: "La source décrit une tension de matière.",
        sources: [
          {
            referenceId: ref.id,
            quote: "La matière crée une tension précise.",
          },
        ],
      },
    ],
  });
  const request = new Request(c.app + "/api/scout/classify", {
    method: "POST",
    headers: {
      cookie: "__Host-ad_session=fixture-session",
      origin: c.app,
      "x-ad-csrf": "csrf",
    },
    body: JSON.stringify({ referenceIds: [ref.id] }),
  });
  const response = await classificationRoute(request, s, c);
  expect((await response.json()).requiresApproval).toBe(true);
  expect(await s.get("collections", c.owner)).toBeNull();
  expect((await s.read(c.owner, ref.id))?.content).toBe(ref.content);
});
