import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { Store, digest } from "../server/store";
import { handle } from "../server/service";
import { MarketRepository } from "../server/market/repository";
import { parseArticle } from "../server/market/analyze";
import type { Config } from "../server/security";
import { makeReference } from "../src/domain";

const config: Config = {
  role: "app",
  app: "https://app.example",
  gateway: "https://gateway.example",
  owner: "340639438",
  githubClient: "",
  githubSecret: "",
  redirects: [],
};
let pg: PGlite;
let store: Store;
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(await readFile("sql/001-private-saver.sql", "utf8"));
  await pg.exec(await readFile("sql/005-market-intelligence.sql", "utf8"));
  store = new Store(
    async (sql, params = []) =>
      (await pg.query(sql, params)).rows as Record<string, unknown>[],
  );
}, 30000);
beforeEach(async () => {
  await pg.exec(
    "TRUNCATE ad_records,ad_saver,ad_quota,ad_audit,ad_market_sources,ad_market_scan_runs,ad_market_leases,ad_market_companies,ad_market_signals,ad_market_evidence,ad_market_opportunities,ad_market_actions,ad_market_contacts,ad_market_feedback CASCADE",
  );
  await store.put(
    "session",
    digest("fixture-session"),
    { owner: config.owner, csrf: "fixture-csrf" },
    3600,
  );
});
afterAll(async () => {
  await pg.close();
});

function dryRunRequest(
  body: unknown = {},
  headers: Record<string, string> = {
    cookie: "__Host-ad_session=fixture-session",
    origin: config.app,
    "x-ad-csrf": "fixture-csrf",
    "content-type": "application/json",
  },
) {
  return new Request(config.app + "/api/lifecycle/dry-run", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

it("records owner-verified Saver saves once and excludes QA fixtures", async () => {
  const saved = makeReference(
    { title: "Private reference title", content: "Sensitive note", url: "https://example.org/source", origin: "human" },
    true,
  );
  await store.save(config.owner, saved);
  await store.save(config.owner, saved);
  const rows = await store.query(
    "SELECT data FROM ad_records WHERE namespace=$1 ORDER BY key",
    ["lifecycle-event:" + config.owner],
  );
  expect(rows.map((row) => (row.data as { type: string }).type).sort()).toEqual([
    "first_reference_saved",
    "reference_saved",
  ]);
  expect(JSON.stringify(rows)).not.toContain("Private reference title");
  expect(JSON.stringify(rows)).not.toContain("Sensitive note");

  const qa = makeReference(
    { title: "QA", content: "fixture", url: "https://example.org/qa", origin: "human" },
    true,
  );
  await store.save(config.owner, { ...qa, isInternalQA: true });
  const after = await store.query(
    "SELECT data FROM ad_records WHERE namespace=$1",
    ["lifecycle-event:" + config.owner],
  );
  expect(after).toHaveLength(2);
});

it("records review, explicit decision, dossier link, and measurable value from real Radar writes", async () => {
  const repository = new MarketRepository(store, config.owner);
  const finding = parseArticle(
    '<h1>Dior lance une nouvelle collection à Paris</h1><time datetime="2026-10-15"></time><meta name="description" content="Annonce de collection"><article class="article-content">Dior présente sa nouvelle collection à Paris.</article>',
    "https://www.journalduluxe.fr/fr/mode/dior-collection",
    new Date("2026-10-16T12:00:00Z"),
  );
  if (!finding) throw new Error("Fixture source failed to parse");
  await repository.ingest(finding);
  await repository.patch(finding.id, { reviewState: "saved" }, "accepted");
  await repository.patch(finding.id, { reviewState: "saved" }, "accepted");
  await repository.patch(
    finding.id,
    { projectId: "00000000-0000-4000-8000-000000000004" },
    "feedback",
  );
  await repository.patch(
    finding.id,
    { stage: "won", stageEvidence: { occurredAt: "2026-10-05T11:00:00.000Z", evidence: "Confirmed order" } },
    "won",
    "Confirmed order",
    1200,
  );
  const rows = await store.query(
    "SELECT data FROM ad_records WHERE namespace=$1 ORDER BY key",
    ["lifecycle-event:" + config.owner],
  );
  expect(rows.map((row) => (row.data as { type: string }).type).sort()).toEqual([
    "decision_confirmed",
    "measurable_outcome_recorded",
    "opportunity_reviewed",
    "work_dossier_linked",
  ]);
  expect(JSON.stringify(rows)).not.toContain("Confirmed order");
  const measured = rows.map((row) => row.data as { type: string; occurredAt: string; recordedAt: string })
    .find((row) => row.type === "measurable_outcome_recorded");
  expect(measured?.occurredAt).toBe("2026-10-05T11:00:00.000Z");
  expect(Date.parse(measured!.recordedAt)).toBeGreaterThan(Date.parse(measured!.occurredAt));
});

it("protects dry-run with owner authentication and CSRF and persists idempotent private evaluations", async () => {
  const unauthorized = await handle(
    dryRunRequest({}, { "content-type": "application/json" }),
    store,
    config,
  );
  expect(unauthorized.status).toBe(401);
  const csrfMissing = await handle(
    dryRunRequest({}, {
      cookie: "__Host-ad_session=fixture-session",
      origin: config.app,
      "content-type": "application/json",
    }),
    store,
    config,
  );
  expect(csrfMissing.status).toBe(403);

  await store.recordLifecycleEvent("other-owner", {
    type: "reference_saved",
    sourceType: "saver_reference",
    sourceId: "foreign-ref",
    occurredAt: new Date().toISOString(),
    idempotencyKey: "foreign-ref",
  });
  await store.recordLifecycleEvent(config.owner, {
    type: "reference_saved",
    sourceType: "saver_reference",
    sourceId: "owner-ref",
    occurredAt: new Date().toISOString(),
    idempotencyKey: "owner-ref",
  });
  const first = await handle(dryRunRequest(), store, config);
  expect(first.status).toBe(200);
  const result = await first.json();
  expect(result.mode).toEqual({
    dryRun: true,
    outboundSending: false,
    campaignAutomation: false,
  });
  expect(result.provider).toBe("not_configured");
  expect(result.decisions).toHaveLength(5);
  expect(result.decisions.find((row: { workflow: string }) => row.workflow === "first_value").exclusions)
    .toContain("verified_signup_timestamp_unavailable");
  expect(result.decisions.find((row: { workflow: string }) => row.workflow === "saved_but_unused").exclusions)
    .toContain("downstream_usage_not_observable");
  expect(result.segments).toContain("active_collector");
  expect(result.segments).not.toContain("paying_subscriber");
  expect(JSON.stringify(result.decisions)).not.toContain("foreign-ref");

  const firstCount = await store.query(
    "SELECT count(*)::int AS count FROM ad_records WHERE namespace=$1",
    ["lifecycle-evaluation:" + config.owner],
  );
  const second = await handle(dryRunRequest(), store, config);
  expect(second.status).toBe(200);
  const secondCount = await store.query(
    "SELECT count(*)::int AS count FROM ad_records WHERE namespace=$1",
    ["lifecycle-evaluation:" + config.owner],
  );
  expect(secondCount[0].count).toBe(firstCount[0].count);
  const savedDecisions = await store.query(
    "SELECT data FROM ad_records WHERE namespace=$1 AND data->>'owner'=$2",
    ["lifecycle-evaluation:" + config.owner, config.owner],
  );
  expect(savedDecisions).toHaveLength(5);
});
