import { randomUUID } from "node:crypto";
import { ServiceError, type Store } from "../store.js";
import type { ScanRun } from "../../src/scout-market/schema.js";
import { MarketRepository } from "./repository.js";
import { parseArticle, canonical } from "./analyze.js";
import { publicFetch, robotsAllows } from "./fetch.js";
import { SOURCES } from "./sources.js";
import { discoverUrls, DISCOVERY_VERSION } from "./discover.js";
type Job = ScanRun & {
  urls: string[];
  sourceCursor?: number;
  discoveryDone?: boolean;
};
export async function scan(s: Store, owner: string, resume?: string) {
  const lease = randomUUID();
  const locked = await s.query(
    "INSERT INTO ad_market_leases(owner_id,lease_id,expires_at) VALUES($1,$2,now()+interval '55 seconds') ON CONFLICT(owner_id) DO UPDATE SET lease_id=excluded.lease_id,expires_at=excluded.expires_at WHERE ad_market_leases.expires_at<now() RETURNING lease_id",
    [owner, lease],
  );
  if (!locked.length) throw new ServiceError(409, "market_scan_busy");
  let job: Job | undefined;
  const save = async () => {
    await s.query(
      "INSERT INTO ad_market_scan_runs(owner_id,id,data) VALUES($1,$2,$3::jsonb) ON CONFLICT(owner_id,id) DO UPDATE SET data=excluded.data",
      [owner, job!.id, JSON.stringify(job)],
    );
  };
  try {
    if (resume) {
      const [r] = await s.query(
        "SELECT data FROM ad_market_scan_runs WHERE owner_id=$1 AND id=$2",
        [owner, resume],
      );
      if (!r) throw new ServiceError(404, "market_run_missing");
      job = r.data as unknown as Job;
      if (!job.paused && job.status === "succeeded") return job;
    }
    if (!job || job.discoveryDone === false || job.urls.length === 0) {
      if (!job) await s.quota("market-scan:" + owner, 1, 900);
      job = job || {
        id: randomUUID(),
        status: "running",
        startedAt: new Date().toISOString(),
        finishedAt: null,
        sourceCount: SOURCES.length,
        itemsSeen: 0,
        insertedCount: 0,
        deduplicatedCount: 0,
        analyzedCount: 0,
        failures: [],
        cursor: 0,
        paused: false,
        costEstimateEur: 0,
        urls: [],
        sourceCursor: 0,
        discoveryDone: false,
      };
      await save();
      for (const source of SOURCES.slice(
        job.sourceCursor || 0,
        (job.sourceCursor || 0) + 1,
      )) {
        try {
          const robots = await publicFetch(
            new URL("/robots.txt", source.url).href,
          );
          if (!robotsAllows(robots.text, new URL(source.url).pathname))
            throw new ServiceError(403, "market_robots_denied");
          const [cached] = await s.query(
            "SELECT data FROM ad_market_sources WHERE owner_id=$1 AND source_id=$2",
            [owner, source.id],
          );
          const previous = cached?.data as
            | {
                etag?: string;
                modified?: string;
                urls?: string[];
                ingestionVerifiedAt?: string;
                discoveryVersion?: string;
              }
            | undefined;
          const headers: Record<string, string> = {};
          if (previous?.etag && previous.discoveryVersion === DISCOVERY_VERSION)
            headers["if-none-match"] = previous.etag;
          else if (
            previous?.modified &&
            previous.discoveryVersion === DISCOVERY_VERSION
          )
            headers["if-modified-since"] = previous.modified;
          let listing = await publicFetch(source.url, headers);
          if (listing.status === 304 && !previous?.urls?.length)
            listing = await publicFetch(source.url);
          if (listing.status === 304)
            job.urls.push(
              ...previous!.urls!.slice(0, 4).filter((u) => {
                try {
                  const p = new URL(u);
                  return (
                    p.hostname === source.domain &&
                    source.articlePattern.test(p.pathname) &&
                    robotsAllows(robots.text, p.pathname)
                  );
                } catch {
                  return false;
                }
              }),
            );
          job.urls.push(...discoverUrls(listing.text, source, robots.text));
          job.urls = [...new Set(job.urls)].slice(0, 30);
          await s.query(
            "INSERT INTO ad_market_sources(owner_id,source_id,data) VALUES($1,$2,$3::jsonb) ON CONFLICT(owner_id,source_id) DO UPDATE SET data=excluded.data",
            [
              owner,
              source.id,
              JSON.stringify({
                id: source.id,
                name: source.name,
                enabled: true,
                sourceType: "public_html",
                lastCheckedAt: new Date().toISOString(),
                lastSuccessAt: new Date().toISOString(),
                errorCode: null,
                policyUrl: source.policyUrl,
                etag: listing.etag || previous?.etag || null,
                modified: listing.modified || previous?.modified || null,
                ingestionVerifiedAt: previous?.ingestionVerifiedAt || null,
                discoveryVersion: DISCOVERY_VERSION,
                urls: job.urls.filter(
                  (u) => new URL(u).hostname === source.domain,
                ),
              }),
            ],
          );
        } catch (e) {
          const error =
            e instanceof ServiceError ? e.code : "market_source_unavailable";
          await s.query(
            "INSERT INTO ad_market_sources(owner_id,source_id,data) VALUES($1,$2,$3::jsonb) ON CONFLICT(owner_id,source_id) DO UPDATE SET data=ad_market_sources.data||excluded.data",
            [
              owner,
              source.id,
              JSON.stringify({
                id: source.id,
                name: source.name,
                enabled: true,
                sourceType: "public_html",
                lastCheckedAt: new Date().toISOString(),
                errorCode: error,
              }),
            ],
          );
          job.failures.push({
            sourceId: source.id,
            error:
              e instanceof ServiceError ? e.code : "market_source_unavailable",
          });
        }
      }
      job.sourceCursor = Math.min(SOURCES.length, (job.sourceCursor || 0) + 1);
      job.discoveryDone = job.sourceCursor >= SOURCES.length;
      if (!job.urls.length && job.discoveryDone) {
        job.status = "failed";
        job.paused = true;
        job.finishedAt = new Date().toISOString();
        await save();
        return job;
      }
      await save();
      // Listing and robots consume the first bounded slice. A persisted cursor is resumed explicitly.
      if (!job.discoveryDone || job.urls.length) {
        job.status = "partial";
        job.paused = true;
        job.finishedAt = new Date().toISOString();
        await save();
        return job;
      }
    }
    job.status = "running";
    job.paused = false;
    job.finishedAt = null;
    await save();
    const repository = new MarketRepository(s, owner);
    const urls = job.urls.slice(job.cursor, job.cursor + 3);
    const docs = await Promise.allSettled(
      urls.map(async (url) => ({ url, response: await publicFetch(url) })),
    );
    for (const [i, result] of docs.entries()) {
      job.itemsSeen++;
      if (result.status === "rejected") {
        job.failures.push({
          sourceId: urls[i],
          error:
            result.reason instanceof ServiceError
              ? result.reason.code
              : "market_source_unavailable",
        });
        continue;
      }
      const f = parseArticle(result.value.response.text, result.value.url);
      if (!f) continue;
      if (await repository.ingest(f)) {
        job.insertedCount++;
        job.analyzedCount++;
      } else job.deduplicatedCount++;
      await s.query(
        "UPDATE ad_market_sources SET data=data||$3::jsonb WHERE owner_id=$1 AND source_id=$2",
        [
          owner,
          f.sourceId,
          JSON.stringify({ ingestionVerifiedAt: new Date().toISOString() }),
        ],
      );
    }
    job.cursor += urls.length;
    job.paused = job.cursor < job.urls.length;
    job.status = job.paused || job.failures.length ? "partial" : "succeeded";
    job.finishedAt = new Date().toISOString();
    await save();
    const findings = (await repository.findings()).filter(
      (f) =>
        !["rejected", "snoozed"].includes(f.reviewState) &&
        f.relationshipStatus !== "blocked",
    );
    const brief = {
      date: new Date().toLocaleDateString("en-CA", {
        timeZone: "Europe/Paris",
      }),
      generatedAt: new Date().toISOString(),
      scanId: job.id,
      signalIds: findings.map((f) => f.signalId),
      opportunityIds: findings.map((f) => f.id),
      summary: { count: findings.length },
      status: job.status === "succeeded" ? "ready" : "partial",
    };
    await s.query(
      "INSERT INTO ad_market_briefs(owner_id,brief_date,data) VALUES($1,$2,$3::jsonb) ON CONFLICT(owner_id,brief_date) DO UPDATE SET data=excluded.data",
      [owner, brief.date, JSON.stringify(brief)],
    );
    return job;
  } catch (e) {
    if (job) {
      job.status = "failed";
      job.paused = true;
      job.finishedAt = new Date().toISOString();
      job.failures.push({
        sourceId: "scan",
        error:
          e instanceof ServiceError ? e.code : "market_storage_or_source_error",
      });
      await save();
    }
    throw e;
  } finally {
    await s.query(
      "DELETE FROM ad_market_leases WHERE owner_id=$1 AND lease_id=$2",
      [owner, lease],
    );
  }
}
