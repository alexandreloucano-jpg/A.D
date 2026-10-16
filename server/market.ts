import { z } from "zod";
import { randomUUID } from "node:crypto";
import { owner, type Config } from "./security.js";
import { ServiceError, type Store } from "./store.js";
import { MarketRepository } from "./market/repository.js";
import { scan } from "./market/jobs.js";
import { SOURCES } from "./market/sources.js";
import {
  listQuery,
  stageSchema,
  type MarketAction,
  type ScanRun,
} from "../src/scout-market/schema.js";
const uuid = z.string().uuid();
async function resumableRun(
  s: Store,
  ownerId: string,
  job: ScanRun | undefined,
) {
  if (!job || job.status !== "running") return job;
  const active = await s.query(
    "SELECT lease_id FROM ad_market_leases WHERE owner_id=$1 AND expires_at>now()",
    [ownerId],
  );
  return active.length
    ? job
    : { ...job, status: "partial" as const, paused: true };
}
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "private, no-store",
    },
  });
export async function marketRoute(r: Request, s: Store, c: Config) {
  const session = await owner(r, s, c, r.method !== "GET");
  const path = new URL(r.url).pathname.slice("/api/market".length);
  const repository = new MarketRepository(s, session.owner);
  const enabled = process.env.AD_MARKET_ENABLED === "1",
    scanEnabled = process.env.AD_MARKET_SCAN_ENABLED === "1";
  if (path === "/status" && r.method === "GET") {
    const [last] = await s.query(
      "SELECT data FROM ad_market_scan_runs WHERE owner_id=$1 ORDER BY data->>'startedAt' DESC LIMIT 1",
      [session.owner],
    );
    const job = await resumableRun(
      s,
      session.owner,
      last?.data as unknown as ScanRun | undefined,
    );
    const [successful] = await s.query(
      "SELECT data FROM ad_market_scan_runs WHERE owner_id=$1 AND data->>'status'='succeeded' ORDER BY data->>'finishedAt' DESC LIMIT 1",
      [session.owner],
    );
    return json({
      enabled,
      configured: true,
      ownerAuthenticated: true,
      sourceCount: SOURCES.length,
      lastAttemptAt: job?.startedAt || null,
      lastSuccessfulScanAt:
        (successful?.data as unknown as ScanRun | undefined)?.finishedAt ||
        null,
      lastRunStatus: job?.status || null,
      lastRun: job || null,
      stale:
        !job?.finishedAt || Date.now() - Date.parse(job.finishedAt) > 86400000,
      aiEnabled: false,
    });
  }
  if (!enabled) throw new ServiceError(503, "market_disabled");
  if (path === "/health" && r.method === "GET")
    return json({
      db: "ready",
      sourceReadiness: SOURCES.length,
      scheduler: "manual",
      scanPolicy: {
        scanEnabled,
        maxParallel: 3,
        documentsPerSlice: 3,
        aiEnabled: false,
        costEur: 0,
      },
    });
  if (path === "/sources" && r.method === "GET")
    return json({
      items: (
        await s.query("SELECT data FROM ad_market_sources WHERE owner_id=$1", [
          session.owner,
        ])
      ).map((r) => r.data),
    });
  if (
    (path === "/runs" || /^\/runs\/[a-f0-9-]+\/resume$/.test(path)) &&
    r.method === "POST"
  ) {
    if (!scanEnabled) throw new ServiceError(503, "market_scan_disabled");
    z.object({ mode: z.literal("manual").default("manual") })
      .strict()
      .parse(await r.json());
    return json(
      await scan(
        s,
        session.owner,
        path === "/runs" ? undefined : uuid.parse(path.split("/")[2]),
      ),
      202,
    );
  }
  if (/^\/runs\/[a-f0-9-]+$/.test(path) && r.method === "GET") {
    const [run] = await s.query(
      "SELECT data FROM ad_market_scan_runs WHERE owner_id=$1 AND id=$2",
      [session.owner, uuid.parse(path.split("/")[2])],
    );
    if (!run) throw new ServiceError(404, "market_run_missing");
    return json(
      await resumableRun(s, session.owner, run.data as unknown as ScanRun),
    );
  }
  if (path === "/opportunities" && r.method === "GET") {
    const q = listQuery.parse(Object.fromEntries(new URL(r.url).searchParams));
    let items = (await repository.findings()).filter(
      (f) =>
        (!q.status || f.reviewState === q.status) &&
        (!q.sector || f.sector === q.sector) &&
        (!q.city || f.city === q.city) &&
        (!q.eventType || f.eventType === q.eventType) &&
        (!q.confidence || f.confidence === q.confidence) &&
        (!q.stage || f.stage === q.stage) &&
        (q.minCoverage === undefined || f.coverage >= q.minCoverage) &&
        (!q.q ||
          (f.companyName + " " + f.headline + " " + f.potentialNeed)
            .toLocaleLowerCase("fr")
            .includes(q.q.toLocaleLowerCase("fr"))) &&
        (!f.publishedAt ||
          Date.now() - Date.parse(f.publishedAt) <= q.days * 86400000),
    );
    const totalApprox = items.length;
    items = items.filter((f) => !q.after || f.id > q.after);
    const page = items.slice(0, q.limit);
    return json({
      items: page,
      nextCursor: items.length > q.limit ? page.at(-1)!.id : null,
      totalApprox,
    });
  }
  if (path === "/brief/today" && r.method === "GET") {
    const items = (await repository.findings())
      .filter(
        (f) =>
          !["rejected", "snoozed"].includes(f.reviewState) &&
          f.relationshipStatus !== "blocked" &&
          f.publishedAt &&
          Date.now() - Date.parse(f.publishedAt) < 45 * 86400000,
      )
      .sort(
        (a, b) =>
          (b.score || 0) - (a.score || 0) ||
          b.firstSeenAt.localeCompare(a.firstSeenAt),
      );
    const actions = (
      await s.query(
        "SELECT data FROM ad_market_actions WHERE owner_id=$1 AND data->>'lane'='NOW' ORDER BY id",
        [session.owner],
      )
    ).map((r) => r.data);
    const [brief] = await s.query(
      "SELECT data FROM ad_market_briefs WHERE owner_id=$1 ORDER BY brief_date DESC LIMIT 1",
      [session.owner],
    );
    const [revenue] = await s.query(
      "SELECT coalesce(sum((data->>'outcomeValueEur')::numeric),0) AS value FROM (SELECT DISTINCT ON (opportunity_id) data FROM ad_market_feedback WHERE owner_id=$1 AND data->>'event'='won' AND data->>'valueConfirmed'='true' ORDER BY opportunity_id,data->>'createdAt' DESC) confirmed",
      [session.owner],
    );
    return json({
      date: new Date().toLocaleDateString("en-CA", {
        timeZone: "Europe/Paris",
      }),
      generatedAt:
        (brief?.data as { generatedAt?: string } | undefined)?.generatedAt ||
        null,
      topOpportunityIds: items.slice(0, 3).map((f) => f.id),
      observations: items.slice(0, 5),
      decisionsToReview: items.filter((f) => f.reviewState === "new").length,
      acceptedNowActions: actions,
      changes: [],
      stale: !items.length,
      confirmedRevenueEur: Number(revenue?.value || 0),
    });
  }
  const deleteContact = /^\/contacts\/([a-f0-9-]+)$/.exec(path);
  if (deleteContact && r.method === "DELETE") {
    await s.query(
      "DELETE FROM ad_market_contacts WHERE owner_id=$1 AND id=$2",
      [session.owner, uuid.parse(deleteContact[1])],
    );
    return json({ removed: true });
  }
  const companyMatch =
    /^\/companies\/([a-f0-9-]+)\/(relationship|contacts)$/.exec(path);
  if (companyMatch && r.method === "POST") {
    const companyId = uuid.parse(companyMatch[1]);
    const [company] = await s.query(
      "SELECT data FROM ad_market_companies WHERE owner_id=$1 AND id=$2",
      [session.owner, companyId],
    );
    if (!company) throw new ServiceError(404, "market_company_missing");
    if (companyMatch[2] === "relationship") {
      const b = z
        .object({
          status: z.enum(["unknown", "existing", "cold", "blocked"]),
          humanApproval: z.literal(true),
        })
        .strict()
        .parse(await r.json());
      const [row] = await s.query(
        "UPDATE ad_market_companies SET data=data||$3::jsonb WHERE owner_id=$1 AND id=$2 RETURNING data",
        [
          session.owner,
          companyId,
          JSON.stringify({
            relationshipStatus: b.status,
            updatedAt: new Date().toISOString(),
          }),
        ],
      );
      return json(row.data);
    }
    const b = z
      .object({
        role: z.string().trim().min(2).max(120),
        name: z.string().trim().max(120).optional(),
        businessEmail: z.email().optional(),
        sourceUrl: z.url().refine((u) => {
          const x = new URL(u);
          return x.protocol === "https:" && !x.username && !x.password;
        }),
        humanApproval: z.literal(true),
      })
      .strict()
      .parse(await r.json());
    const contactId = randomUUID(),
      stamp = new Date().toISOString();
    const data = {
      id: contactId,
      ...b,
      verifiedAt: null,
      contactDataBasis:
        "Coordonnée professionnelle publique déclarée par le propriétaire ; vérification indépendante non effectuée.",
      createdAt: stamp,
      retentionUntil: new Date(Date.now() + 90 * 86400000).toISOString(),
      doNotContact: true,
    };
    await s.query(
      "INSERT INTO ad_market_contacts(owner_id,id,company_id,data) VALUES($1,$2,$3,$4::jsonb)",
      [session.owner, contactId, companyId, JSON.stringify(data)],
    );
    return json(data);
  }
  if (path === "/feedback" && r.method === "GET") {
    const rows = await s.query(
      "SELECT data FROM ad_market_feedback WHERE owner_id=$1",
      [session.owner],
    );
    const outcomes = rows.map((r) => r.data as { event: string });
    return json({
      observedEvents: outcomes.length,
      confirmedOutcomes: outcomes.filter((e) =>
        ["won", "lost"].includes(e.event),
      ).length,
      scoringVersion: "ADOpportunityScoreV1",
      weightsChanged: false,
      automaticLearning: false,
      note: "Aucun ajustement de poids sans validation humaine et jeu d’issues suffisant.",
    });
  }
  const match =
    /^\/opportunities\/([a-f0-9-]+)(?:\/(review|advance|draft-action|project))?$/.exec(
      path,
    );
  if (match) {
    const id = uuid.parse(match[1]);
    const f = await repository.get(id);
    if (!f) throw new ServiceError(404, "market_opportunity_missing");
    if (!match[2] && r.method === "GET")
      return json({
        opportunity: f,
        signals: (
          await s.query(
            "SELECT data FROM ad_market_signals WHERE owner_id=$1 AND id=$2",
            [session.owner, f.signalId],
          )
        ).map((r) => r.data),
        evidence: (
          await s.query(
            "SELECT data FROM ad_market_evidence WHERE owner_id=$1 AND signal_id=$2",
            [session.owner, f.signalId],
          )
        ).map((r) => r.data),
        timeline: (
          await s.query(
            "SELECT data FROM ad_market_feedback WHERE owner_id=$1 AND opportunity_id=$2 ORDER BY id",
            [session.owner, id],
          )
        ).map((r) => r.data),
        actions: (
          await s.query(
            "SELECT data FROM ad_market_actions WHERE owner_id=$1 AND opportunity_id=$2 ORDER BY id",
            [session.owner, id],
          )
        ).map((r) => r.data),
      });
    if (r.method === "POST") {
      const body = await r.json();
      if (match[2] === "review") {
        const b = z
          .object({
            decision: z.enum(["save", "reject", "snooze", "reopen"]),
            reason: z.string().trim().min(1).max(1000).optional(),
          })
          .strict()
          .parse(body);
        if (b.decision === "reject" && !b.reason)
          throw new ServiceError(400, "market_rejection_reason_required");
        const reviewState = (
          {
            save: "saved",
            reject: "rejected",
            snooze: "snoozed",
            reopen: "new",
          } as const
        )[b.decision];
        return json(
          await repository.patch(
            id,
            { reviewState },
            b.decision === "save"
              ? "accepted"
              : b.decision === "reject"
                ? "rejected"
                : "feedback",
            b.reason || null,
          ),
        );
      }
      if (match[2] === "advance") {
        const b = z
          .object({
            stage: stageSchema,
            occurredAt: z.iso.datetime(),
            confirmation: z.literal(true),
            evidence: z.string().trim().min(5).max(2000),
            outcomeValueEur: z.number().nonnegative().optional(),
            valueConfirmed: z.boolean().optional(),
          })
          .strict()
          .parse(body);
        if (Date.parse(b.occurredAt) > Date.now() + 60000)
          throw new ServiceError(400, "market_future_interaction");
        if (
          b.outcomeValueEur !== undefined &&
          (b.stage !== "won" || !b.valueConfirmed)
        )
          throw new ServiceError(400, "market_revenue_unconfirmed");
        return json(
          await repository.patch(
            id,
            {
              stage: b.stage,
              stageEvidence: { occurredAt: b.occurredAt, evidence: b.evidence },
            },
            b.stage,
            b.evidence,
            b.outcomeValueEur ?? null,
          ),
        );
      }
      if (match[2] === "project") {
        if (f.reviewState !== "saved")
          throw new ServiceError(409, "market_save_before_project");
        const b = z
          .object({ projectId: uuid, humanApproval: z.literal(true) })
          .strict()
          .parse(body);
        return json(
          await repository.patch(
            id,
            { projectId: b.projectId },
            "feedback",
            "Projet local associé explicitement.",
          ),
        );
      }
      if (match[2] === "draft-action") {
        const b = z
          .object({
            actionText: z.string().trim().min(3).max(2000),
            sourceEvidenceIds: z.array(uuid).min(1).max(10),
          })
          .strict()
          .parse(body);
        const e = await s.query(
          "SELECT id FROM ad_market_evidence WHERE owner_id=$1 AND signal_id=$2",
          [session.owner, f.signalId],
        );
        if (b.sourceEvidenceIds.some((id) => !e.some((r) => r.id === id)))
          throw new ServiceError(400, "market_evidence_unverified");
        const actionId = f.id;
        const action: MarketAction = {
          id: actionId,
          opportunityId: id,
          proposalText: b.actionText,
          lane: "LATER",
          acceptedAt: null,
          completedAt: null,
        };
        await s.query(
          "INSERT INTO ad_market_actions(owner_id,id,opportunity_id,data) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(owner_id,id) DO NOTHING",
          [session.owner, actionId, id, JSON.stringify(action)],
        );
        const [row] = await s.query(
          "SELECT data FROM ad_market_actions WHERE owner_id=$1 AND id=$2",
          [session.owner, actionId],
        );
        return json(row.data);
      }
    }
  }
  const action = /^\/actions\/([a-f0-9-]+)\/(accept|archive|restore)$/.exec(
    path,
  );
  if (action && r.method === "POST") {
    const b = z
      .object({ humanApproval: z.literal(true) })
      .strict()
      .parse(await r.json());
    void b;
    const now = new Date().toISOString();
    const patch =
      action[2] === "accept"
        ? { lane: "NOW", acceptedAt: now }
        : action[2] === "archive"
          ? { lane: "KILL" }
          : { lane: "LATER", acceptedAt: null };
    const [row] = await s.query(
      "UPDATE ad_market_actions SET data=data||$3::jsonb WHERE owner_id=$1 AND id=$2 RETURNING data",
      [session.owner, uuid.parse(action[1]), JSON.stringify(patch)],
    );
    if (!row) throw new ServiceError(404, "market_action_missing");
    return json(row.data);
  }
  throw new ServiceError(404, "not_found");
}
