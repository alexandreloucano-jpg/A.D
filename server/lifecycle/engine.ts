import type { Config } from "../security.js";
import { MarketRepository } from "../market/repository.js";
import type { Store } from "../store.js";
import {
  deriveSegments,
  evaluateLifecycle,
  lifecycleEventSchema,
  lifecycleWindowDay,
  LIFECYCLE_SAFETY,
  type CommunicationState,
  type LifecycleEvent,
} from "../../src/lifecycle/model.js";
import { replaceDraftOrigin } from "../../src/lifecycle/templates.js";

const defaultCommunication: CommunicationState = {
  email: null,
  emailVerified: false,
  marketingConsent: false,
  unsubscribed: false,
  bounced: false,
  complained: false,
};

function monthClosed(asOf: string) {
  const now = new Date(asOf);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as Record<"year" | "month" | "day", string>;
  const lastDay = new Date(
    Date.UTC(Number(parts.year), Number(parts.month), 0),
  ).getUTCDate();
  return Number(parts.day) === lastDay;
}

export async function runLifecycleDryRun(store: Store, owner: string, config: Config) {
  const eventNamespace = "lifecycle-event:" + owner;
  const rows = await store.query(
    "SELECT data FROM ad_records WHERE namespace=$1 AND data->>'owner'=$2 AND (expires_at IS NULL OR expires_at>now()) ORDER BY data->>'occurredAt',key",
    [eventNamespace, owner],
  );
  const events: LifecycleEvent[] = rows.map((row) =>
    lifecycleEventSchema.parse(row.data),
  );
  const preferences =
    (await store.get<Partial<CommunicationState>>(
      "lifecycle-preferences",
      owner,
    )) || {};
  const communication = {
    ...defaultCommunication,
    ...preferences,
  } as CommunicationState;
  const asOf = new Date().toISOString();
  const currentDay = lifecycleWindowDay(new Date(asOf));
  const evaluationRows = await store.query(
    "SELECT data FROM ad_records WHERE namespace=$1 AND data->>'owner'=$2 AND data->>'status'='drafted' AND (expires_at IS NULL OR expires_at>now()) ORDER BY data->>'evaluatedAt' DESC",
    ["lifecycle-evaluation:" + owner, owner],
  );
  const recentDraftedAt = evaluationRows
    .map((row) => row.data as { evaluatedAt?: string; windowKey?: string })
    .filter(
      (row) =>
        typeof row.evaluatedAt === "string" &&
        lifecycleWindowDay(new Date(row.evaluatedAt)) !== currentDay,
    )
    .map((row) => row.evaluatedAt!)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] || null;
  const marketEnabled = process.env.AD_MARKET_ENABLED === "1";
  const findings = marketEnabled
    ? await new MarketRepository(store, owner).findings()
    : [];
  const qualifiedSignals = findings
    .filter(
      (finding) =>
        finding.qualification === "actionable" &&
        ["source_confirmed", "corroborated"].includes(finding.status) &&
        ["commercial", "strategic", "cultural"].includes(
          finding.sourcePurpose || finding.classification || "",
        ) &&
        !finding.sourceError,
    )
    .map((finding) => ({
      id: finding.id,
      headline: finding.headline,
      companyName: finding.companyName,
      canonicalUrl: finding.canonicalUrl,
      firstSeenAt: finding.firstSeenAt,
      qualification: "actionable" as const,
      status: finding.status as "source_confirmed" | "corroborated",
      sourcePurpose: (finding.sourcePurpose || finding.classification) as
        | "commercial"
        | "strategic"
        | "cultural",
    }));
  const facts = {
    owner,
    asOf,
    signupAt: null,
    events,
    qualifiedSignals,
    communication,
    workspaceContinuityVerified: false,
    monthEnd: monthClosed(asOf),
    recentDraftedAt,
  } as const;
  const decisions = evaluateLifecycle(facts).map((row) => ({
    ...row,
    draft: row.draft ? replaceDraftOrigin(row.draft, config.app) : null,
  }));

  for (const row of decisions) {
    const namespace = "lifecycle-evaluation:" + owner;
    const key = row.workflow + ":" + row.windowKey;
    await store.put(
      namespace,
      key,
      {
        owner,
        workflow: row.workflow,
        status: row.status,
        trigger: row.trigger,
        sourceEventIds: row.sourceEventIds,
        sourceIds: row.sourceIds,
        exclusions: row.exclusions,
        templateId: row.templateId,
        evaluatedAt: row.evaluatedAt,
        windowKey: row.windowKey,
        draft: row.draft,
      },
      180 * 86400,
    );
  }
  return {
    mode: LIFECYCLE_SAFETY,
    segments: deriveSegments(facts),
    decisions,
    provider: "not_configured",
    evaluatedAt: asOf,
  };
}
