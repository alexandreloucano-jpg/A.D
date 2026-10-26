import { z } from "zod";
import { composeEmail } from "./templates.js";

export const LIFECYCLE_SAFETY = Object.freeze({
  dryRun: true,
  outboundSending: false,
  campaignAutomation: false,
});

export const lifecycleEventTypes = [
  "reference_saved",
  "first_reference_saved",
  "opportunity_reviewed",
  "decision_confirmed",
  "work_dossier_linked",
  "measurable_outcome_recorded",
] as const;

export const lifecycleEventSchema = z.object({
  id: z.string().min(1).max(240),
  owner: z.string().min(1).max(160),
  type: z.enum(lifecycleEventTypes),
  occurredAt: z.string().datetime(),
  recordedAt: z.string().datetime(),
  sourceType: z.enum(["saver_reference", "market_feedback"]),
  sourceId: z.string().min(1).max(160),
}).strict();

export type LifecycleEvent = z.infer<typeof lifecycleEventSchema>;
export type WorkflowId =
  | "first_value"
  | "saved_but_unused"
  | "weekly_intelligence"
  | "reactivation"
  | "monthly_value";
export type LifecycleSegment =
  | "registered_not_activated"
  | "first_save_completed"
  | "active_collector"
  | "active_intelligence_user"
  | "opportunity_oriented"
  | "at_risk_inactive"
  | "paying_subscriber"
  | "cancellation_requested";

export interface QualifiedSignal {
  id: string;
  headline: string;
  companyName: string;
  canonicalUrl: string;
  firstSeenAt: string;
  qualification: "actionable";
  status: "source_confirmed" | "corroborated";
  sourcePurpose: "commercial" | "strategic" | "cultural";
}

export interface CommunicationState {
  email: string | null;
  emailVerified: boolean;
  marketingConsent: boolean;
  unsubscribed: boolean;
  bounced: boolean;
  complained: boolean;
}

export interface MonthlyMetric {
  key:
    | "references_saved"
    | "signals_reviewed"
    | "dossiers_linked"
    | "decisions_confirmed"
    | "measurable_outcomes";
  label: string;
  value: number;
  sourceEventIds: string[];
}

export interface EmailDraft {
  templateId: string;
  subject: string;
  preheader: string;
  text: string;
  html: string;
  ctaUrl: string;
}

export interface LifecycleFacts {
  owner: string;
  asOf: string;
  /** Null until the application has a durable, verified account-created timestamp. */
  signupAt: string | null;
  events: LifecycleEvent[];
  qualifiedSignals: QualifiedSignal[];
  communication: CommunicationState;
  workspaceContinuityVerified: boolean;
  monthEnd: boolean;
  /** Most recent previously generated campaign draft, excluding this window. */
  recentDraftedAt?: string | null;
}

export interface EligibilityDecision {
  workflow: WorkflowId;
  status: "drafted" | "suppressed" | "blocked" | "waiting";
  trigger: string;
  sourceEventIds: string[];
  sourceIds: string[];
  exclusions: string[];
  templateId: string | null;
  evaluatedAt: string;
  windowKey: string;
  draft: EmailDraft | null;
}

const emailSchema = z.email().max(254);
const day = 86400000;
const founderTimeZone = "Europe/Paris";
const meaningfulEvents = new Set<LifecycleEvent["type"]>([
  "first_reference_saved",
  "opportunity_reviewed",
  "decision_confirmed",
  "work_dossier_linked",
  "measurable_outcome_recorded",
]);

function zonedParts(date: Date) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: founderTimeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as Record<"year" | "month" | "day", string>;
}
export function lifecycleWindowDay(asOf: Date) {
  const p = zonedParts(asOf);
  return `${p.year}-${p.month}-${p.day}`;
}
export function lifecycleMonthWindow(asOf: Date) {
  const p = zonedParts(asOf);
  return `${p.year}-${p.month}`;
}
function lastDayOfMonth(asOf: Date) {
  const p = zonedParts(asOf);
  const last = new Date(Date.UTC(Number(p.year), Number(p.month), 0)).getUTCDate();
  return `${p.year}-${p.month}-${String(last).padStart(2, "0")}`;
}
function inRange(value: string, start: number, end: number) {
  const stamp = Date.parse(value);
  return Number.isFinite(stamp) && stamp >= start && stamp < end;
}
function decision(
  facts: LifecycleFacts,
  workflow: WorkflowId,
  status: EligibilityDecision["status"],
  trigger: string,
  windowKey: string,
  sourceEvents: LifecycleEvent[] = [],
  sourceIds: string[] = [],
  exclusions: string[] = [],
  draft: EmailDraft | null = null,
): EligibilityDecision {
  return {
    workflow,
    status,
    trigger,
    sourceEventIds: [...new Set(sourceEvents.map((event) => event.id))],
    sourceIds: [...new Set(sourceIds)],
    exclusions,
    templateId:
      draft?.templateId ||
      (status === "suppressed" &&
      exclusions.some((reason) =>
        [
          "email_missing_or_invalid",
          "email_not_verified",
          "marketing_consent_missing",
          "durable_unsubscribe",
          "recipient_bounced",
          "recipient_complained",
        ].includes(reason)
      )
        ? `ad-lifecycle-${workflow}-v1`
        : null),
    evaluatedAt: facts.asOf,
    windowKey,
    draft,
  };
}

function communicationExclusions(state: CommunicationState): string[] {
  const out: string[] = [];
  if (!state.email || !emailSchema.safeParse(state.email).success)
    out.push("email_missing_or_invalid");
  if (!state.emailVerified) out.push("email_not_verified");
  if (!state.marketingConsent) out.push("marketing_consent_missing");
  if (state.unsubscribed) out.push("durable_unsubscribe");
  if (state.bounced) out.push("recipient_bounced");
  if (state.complained) out.push("recipient_complained");
  return out;
}

export function deriveSegments(facts: LifecycleFacts): LifecycleSegment[] {
  const out: LifecycleSegment[] = [];
  const events = facts.events;
  if (events.some((event) => event.type === "first_reference_saved"))
    out.push("first_save_completed");
  else if (facts.signupAt) out.push("registered_not_activated");
  if (events.some((event) => event.type === "reference_saved"))
    out.push("active_collector");
  if (
    events.some((event) =>
      ["opportunity_reviewed", "decision_confirmed"].includes(event.type),
    )
  )
    out.push("active_intelligence_user");
  if (events.some((event) => event.type === "work_dossier_linked"))
    out.push("opportunity_oriented");
  if (facts.workspaceContinuityVerified) {
    const last = events
      .filter((event) => meaningfulEvents.has(event.type))
      .map((event) => Date.parse(event.occurredAt))
      .filter(Number.isFinite)
      .sort((a, b) => b - a)[0] ?? null;
    if (last !== null && Date.parse(facts.asOf) - last >= 14 * day)
      out.push("at_risk_inactive");
  }
  // The current application has no subscription or cancellation source.
  return out;
}

export function monthlyMetrics(
  events: LifecycleEvent[],
  asOf: Date,
): MonthlyMetric[] {
  const month = lifecycleMonthWindow(asOf);
  const types: MonthlyMetric["key"][] = [
    "references_saved",
    "signals_reviewed",
    "dossiers_linked",
    "decisions_confirmed",
    "measurable_outcomes",
  ];
  const buckets: Record<MonthlyMetric["key"], LifecycleEvent[]> = {
    references_saved: [],
    signals_reviewed: [],
    dossiers_linked: [],
    decisions_confirmed: [],
    measurable_outcomes: [],
  };
  const seen = new Set<string>();
  for (const event of events) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    if (lifecycleMonthWindow(new Date(event.occurredAt)) !== month) continue;
    if (event.type === "reference_saved") buckets.references_saved.push(event);
    else if (event.type === "opportunity_reviewed")
      buckets.signals_reviewed.push(event);
    else if (event.type === "work_dossier_linked")
      buckets.dossiers_linked.push(event);
    else if (event.type === "decision_confirmed")
      buckets.decisions_confirmed.push(event);
    else if (event.type === "measurable_outcome_recorded")
      buckets.measurable_outcomes.push(event);
  }
  const labels: Record<MonthlyMetric["key"], string> = {
    references_saved: "Références enregistrées",
    signals_reviewed: "Signaux examinés",
    dossiers_linked: "Dossiers reliés",
    decisions_confirmed: "Décisions confirmées",
    measurable_outcomes: "Résultats commerciaux documentés",
  };
  return types
    .filter((key) => buckets[key].length > 0)
    .map((key) => ({
      key,
      label: labels[key],
      value: buckets[key].length,
      sourceEventIds: buckets[key].map((event) => event.id),
    }));
}

export function evaluateLifecycle(facts: LifecycleFacts): EligibilityDecision[] {
  const asOf = new Date(facts.asOf);
  const today = lifecycleWindowDay(asOf);
  const month = lifecycleMonthWindow(asOf);
  const communicationExclusionsForUser = communicationExclusions(
    facts.communication,
  );
  const events = facts.events;
  const signupAt = facts.signupAt;
  const firstSaved = events.find(
    (event) => event.type === "first_reference_saved",
  );
  const savedEvents = events.filter((event) => event.type === "reference_saved");
  const downstream = events.filter((event) =>
    ["opportunity_reviewed", "work_dossier_linked"].includes(event.type),
  );
  const candidate: EligibilityDecision[] = [];

  const signupTime = signupAt ? Date.parse(signupAt) : Number.NaN;
  if (!Number.isFinite(signupTime) || signupTime > Date.parse(facts.asOf)) {
    candidate.push(
      decision(
        facts,
        "first_value",
        "blocked",
        "Attendre 24 h après une inscription vérifiée sans première sauvegarde.",
        today,
        [],
        [],
        [
          signupAt
            ? "verified_signup_timestamp_invalid_or_future"
            : "verified_signup_timestamp_unavailable",
        ],
      ),
    );
  } else if (firstSaved) {
    candidate.push(
      decision(
        facts,
        "first_value",
        "suppressed",
        "Une première sauvegarde vérifiée est déjà enregistrée.",
        today,
        [firstSaved],
        [firstSaved.sourceId],
        ["already_activated"],
      ),
    );
  } else if (Date.parse(facts.asOf) - signupTime < day) {
    candidate.push(
      decision(
        facts,
        "first_value",
        "waiting",
        "Le délai de 24 h après inscription n’est pas atteint.",
        today,
        [],
        ["verified_account_created_at"],
        ["activation_wait_window_open"],
      ),
    );
  } else {
    candidate.push(
      decision(
        facts,
        "first_value",
        communicationExclusionsForUser.length ? "suppressed" : "drafted",
        "Plus de 24 h depuis une inscription vérifiée, sans première sauvegarde.",
        today,
        [],
        ["verified_account_created_at"],
        communicationExclusionsForUser,
        communicationExclusionsForUser.length
          ? null
          : composeEmail(facts, "first_value", {
              link: "saver",
            }),
      ),
    );
  }

  if (!savedEvents.length) {
    candidate.push(
      decision(
        facts,
        "saved_but_unused",
        "blocked",
        "Transformer des références déjà sauvegardées en contexte exploitable.",
        today,
        [],
        [],
        ["no_verified_saved_references"],
      ),
    );
  } else {
    // Downstream A.D activity does not currently carry the Saver reference ID,
    // so the server cannot prove that any particular saved reference is unused.
    candidate.push(
      decision(
        facts,
        "saved_but_unused",
        "blocked",
        "Proposer une prochaine étape à partir de références effectivement conservées.",
        today,
        savedEvents,
        savedEvents.map((event) => event.sourceId),
        [
          downstream.length
            ? "reference_to_downstream_provenance_missing"
            : "downstream_usage_not_observable",
        ],
      ),
    );
  }

  const qualified = facts.qualifiedSignals
    .filter(
      (signal) =>
        signal.qualification === "actionable" &&
        ["source_confirmed", "corroborated"].includes(signal.status) &&
        ["commercial", "strategic", "cultural"].includes(signal.sourcePurpose) &&
        inRange(signal.firstSeenAt, Date.parse(facts.asOf) - 7 * day, Date.parse(facts.asOf) + 1),
    )
    .slice(0, 3);
  if (!qualified.length) {
    candidate.push(
      decision(
        facts,
        "weekly_intelligence",
        "blocked",
        "Au moins un signal nouveau, qualifié et sourcé doit exister.",
        today,
        [],
        [],
        ["no_new_qualified_signal"],
      ),
    );
  } else {
    candidate.push(
      decision(
        facts,
        "weekly_intelligence",
        communicationExclusionsForUser.length ? "suppressed" : "drafted",
        `${qualified.length} signal${qualified.length > 1 ? "s" : ""} nouveau${qualified.length > 1 ? "x" : ""}, qualifié${qualified.length > 1 ? "s" : ""} et sourcé${qualified.length > 1 ? "s" : ""} cette semaine.`,
        today,
        [],
        qualified.map((signal) => signal.id),
        communicationExclusionsForUser,
        communicationExclusionsForUser.length
          ? null
          : composeEmail(facts, "weekly_intelligence", {
              signals: qualified,
              link: "explorer",
            }),
      ),
    );
  }

  const lastMeaningful = events
    .filter((event) => meaningfulEvents.has(event.type))
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))[0];
  const activationPending = candidate[0].status === "drafted" || candidate[0].status === "waiting";
  if (!facts.workspaceContinuityVerified) {
    candidate.push(
      decision(
        facts,
        "reactivation",
        "blocked",
        "Reprendre une tâche ou un projet réel après 14 jours sans activité significative.",
        today,
        lastMeaningful ? [lastMeaningful] : [],
        [],
        ["cross_device_workspace_activity_unverified"],
      ),
    );
  } else if (!lastMeaningful) {
    candidate.push(
      decision(
        facts,
        "reactivation",
        "blocked",
        "Reprendre un travail existant après 14 jours sans activité significative.",
        today,
        [],
        [],
        ["no_meaningful_activity_history"],
      ),
    );
  } else if (activationPending) {
    candidate.push(
      decision(
        facts,
        "reactivation",
        "suppressed",
        "Une séquence d’activation est déjà en attente ou éligible.",
        today,
        [lastMeaningful],
        [],
        ["activation_reactivation_conflict"],
      ),
    );
  } else if (Date.parse(facts.asOf) - Date.parse(lastMeaningful.occurredAt) < 14 * day) {
    candidate.push(
      decision(
        facts,
        "reactivation",
        "waiting",
        "Quatorze jours complets sans activité significative ne sont pas écoulés.",
        today,
        [lastMeaningful],
        [],
        ["reactivation_wait_window_open"],
      ),
    );
  } else {
    candidate.push(
      decision(
        facts,
        "reactivation",
        communicationExclusionsForUser.length ? "suppressed" : "drafted",
        "Quatorze jours complets depuis la dernière activité serveur vérifiée.",
        today,
        [lastMeaningful],
        [lastMeaningful.sourceId],
        communicationExclusionsForUser,
        communicationExclusionsForUser.length
          ? null
          : composeEmail(facts, "reactivation", {
              link: lastMeaningful.sourceType === "market_feedback" ? "explorer" : "saver",
            }),
      ),
    );
  }

  const reportMetrics = monthlyMetrics(events, asOf);
  const isMonthEnd = facts.monthEnd && today === lastDayOfMonth(asOf);
  if (!isMonthEnd) {
    candidate.push(
      decision(
        facts,
        "monthly_value",
        "waiting",
        "Le rapport est évalué uniquement à la clôture du mois.",
        month,
        [],
        [],
        ["month_not_closed"],
      ),
    );
  } else if (!reportMetrics.length) {
    candidate.push(
      decision(
        facts,
        "monthly_value",
        "blocked",
        "Aucun événement vérifié n’est disponible pour interpréter ce mois.",
        month,
        [],
        [],
        ["verified_monthly_data_missing"],
      ),
    );
  } else {
    candidate.push(
      decision(
        facts,
        "monthly_value",
        communicationExclusionsForUser.length ? "suppressed" : "drafted",
        `${reportMetrics.length} indicateur${reportMetrics.length > 1 ? "s" : ""} vérifié${reportMetrics.length > 1 ? "s" : ""} disponible${reportMetrics.length > 1 ? "s" : ""} pour ${month}.`,
        month,
        events.filter((event) =>
          reportMetrics.some((metric) => metric.sourceEventIds.includes(event.id)),
        ),
        [],
        communicationExclusionsForUser,
        communicationExclusionsForUser.length
          ? null
          : composeEmail(facts, "monthly_value", {
              metrics: reportMetrics,
              link: "accueil",
            }),
      ),
    );
  }

  // The engine chooses one campaign per evaluation window, with activation and
  // reactivation above intelligence and monthly summaries. No stacking.
  const priority: WorkflowId[] = [
    "first_value",
    "reactivation",
    "weekly_intelligence",
    "monthly_value",
    "saved_but_unused",
  ];
  const winner = priority
    .map((id) => candidate.find((row) => row.workflow === id))
    .find((row) => row?.status === "drafted");
  if (winner) {
    for (const row of candidate) {
      if (row !== winner && row.status === "drafted") {
        row.status = "suppressed";
        row.exclusions = [...row.exclusions, "lower_priority_campaign_in_same_window"];
        row.draft = null;
        row.templateId = null;
      }
    }
  }
  if (
    facts.recentDraftedAt &&
    Date.parse(facts.asOf) - Date.parse(facts.recentDraftedAt) < 7 * day
  ) {
    for (const row of candidate) {
      if (row.status !== "drafted") continue;
      row.status = "suppressed";
      row.exclusions = [...row.exclusions, "seven_day_campaign_draft_cap"];
      row.draft = null;
      row.templateId = null;
    }
  }
  return candidate;
}
