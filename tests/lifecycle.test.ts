import { describe, expect, it } from "vitest";
import {
  deriveSegments,
  evaluateLifecycle,
  lifecycleEventSchema,
  monthlyMetrics,
  type CommunicationState,
  type LifecycleEvent,
  type LifecycleFacts,
  type QualifiedSignal,
} from "../src/lifecycle/model";
import { composeEmail } from "../src/lifecycle/templates";

const owner = "owner-fixture";
const asOf = "2026-10-22T12:00:00.000Z";
const consented: CommunicationState = {
  email: "verified@example.test",
  emailVerified: true,
  marketingConsent: true,
  unsubscribed: false,
  bounced: false,
  complained: false,
};
function event(
  type: LifecycleEvent["type"],
  sourceId: string,
  occurredAt = "2026-10-20T12:00:00.000Z",
): LifecycleEvent {
  return lifecycleEventSchema.parse({
    id: type + ":" + sourceId,
    owner,
    type,
    sourceType: type.includes("reference") ? "saver_reference" : "market_feedback",
    sourceId,
    occurredAt,
    recordedAt: occurredAt,
  });
}
function facts(overrides: Partial<LifecycleFacts> = {}): LifecycleFacts {
  return {
    owner,
    asOf,
    signupAt: null,
    events: [],
    qualifiedSignals: [],
    communication: consented,
    workspaceContinuityVerified: false,
    monthEnd: false,
    ...overrides,
  };
}
function flow(rows: ReturnType<typeof evaluateLifecycle>, id: string) {
  const found = rows.find((row) => row.workflow === id);
  if (!found) throw new Error("Missing workflow " + id);
  return found;
}

describe("lifecycle rules and draft contracts", () => {
  it("drafts first value only after 24 hours without a verified first save", () => {
    const result = flow(
      evaluateLifecycle(
        facts({ signupAt: "2026-10-20T10:00:00.000Z" }),
      ),
      "first_value",
    );
    expect(result.status).toBe("drafted");
    expect(result.templateId).toBe("ad-lifecycle-first_value-v1");
    expect(result.draft?.subject).toBe("Enregistrer une première référence");
    expect(result.draft?.text).toContain("Ouvrir la Bibliothèque");
    expect(result.draft?.html).toContain("viewport");
    expect(result.draft?.html).toContain("min-height:44px");
  });

  it("blocks first value when signup time is unavailable and suppresses activated users", () => {
    expect(flow(evaluateLifecycle(facts()), "first_value").exclusions).toContain(
      "verified_signup_timestamp_unavailable",
    );
    const active = evaluateLifecycle(
      facts({
        signupAt: "2026-10-19T12:00:00.000Z",
        events: [event("first_reference_saved", "ref-1")],
      }),
    );
    expect(flow(active, "first_value")).toMatchObject({
      status: "suppressed",
      exclusions: ["already_activated"],
    });
  });

  it("waits for the 24-hour threshold and suppresses missing consent or invalid email", () => {
    const waiting = evaluateLifecycle(
      facts({ signupAt: "2026-10-22T03:00:00.000Z" }),
    );
    expect(flow(waiting, "first_value").status).toBe("waiting");
    const noConsent = evaluateLifecycle(
      facts({
        signupAt: "2026-10-20T12:00:00.000Z",
        communication: { ...consented, email: "bad", marketingConsent: false },
      }),
    );
    expect(flow(noConsent, "first_value").status).toBe("suppressed");
    expect(flow(noConsent, "first_value").templateId).toBe(
      "ad-lifecycle-first_value-v1",
    );
    expect(flow(noConsent, "first_value").draft).toBeNull();
    expect(flow(noConsent, "first_value").exclusions).toEqual(
      expect.arrayContaining(["email_missing_or_invalid", "marketing_consent_missing"]),
    );
  });

  it("suppresses unsubscribed, bounced, and complained recipients", () => {
    for (const state of [
      { ...consented, unsubscribed: true },
      { ...consented, bounced: true },
      { ...consented, complained: true },
    ]) {
      const result = flow(
        evaluateLifecycle(
          facts({ signupAt: "2026-10-20T12:00:00.000Z", communication: state }),
        ),
        "first_value",
      );
      expect(result.status).toBe("suppressed");
      expect(result.draft).toBeNull();
    }
  });

  it("does not infer saved-but-unused from a save count without reference provenance", () => {
    const result = flow(
      evaluateLifecycle(
        facts({ events: [event("reference_saved", "ref-private-id")] }),
      ),
      "saved_but_unused",
    );
    expect(result.status).toBe("blocked");
    expect(result.exclusions).toContain("downstream_usage_not_observable");
    expect(result.draft).toBeNull();
  });

  it("drafts weekly intelligence only for recent qualified, sourced signals without revealing private detail", () => {
    const signal: QualifiedSignal = {
      id: "signal-1",
      headline: "PRIVATE_HEADLINE_DO_NOT_EMAIL",
      companyName: "PRIVATE_COMPANY_DO_NOT_EMAIL",
      canonicalUrl: "https://source.example/story",
      firstSeenAt: "2026-10-20T08:00:00.000Z",
      qualification: "actionable",
      status: "corroborated",
      sourcePurpose: "commercial",
    };
    const result = flow(
      evaluateLifecycle(facts({ qualifiedSignals: [signal] })),
      "weekly_intelligence",
    );
    expect(result.status).toBe("drafted");
    expect(result.sourceIds).toEqual([signal.id]);
    expect(result.draft?.text).toContain("1 signal nouveau qualifié");
    expect(result.draft?.text).not.toContain(signal.headline);
    expect(result.draft?.text).not.toContain(signal.companyName);
    expect(result.draft?.text).not.toContain(signal.canonicalUrl);
  });

  it("requires complete verified workspace continuity for reactivation", () => {
    const old = event("first_reference_saved", "ref-1", "2026-10-01T12:00:00.000Z");
    const factsNow = facts({ events: [old] });
    expect(flow(evaluateLifecycle(factsNow), "reactivation").exclusions).toContain(
      "cross_device_workspace_activity_unverified",
    );
    const resumed = evaluateLifecycle({ ...factsNow, workspaceContinuityVerified: true });
    expect(flow(resumed, "reactivation").status).toBe("drafted");
    expect(flow(resumed, "reactivation").draft?.text).not.toContain(old.sourceId);
  });

  it("does not stack a reactivation message with an activation message", () => {
    const result = evaluateLifecycle(
      facts({
        signupAt: "2026-10-20T00:00:00.000Z",
        events: [event("opportunity_reviewed", "feedback-1", "2026-10-01T12:00:00.000Z")],
        workspaceContinuityVerified: true,
      }),
    );
    expect(flow(result, "first_value").status).toBe("drafted");
    expect(flow(result, "reactivation").exclusions).toContain(
      "activation_reactivation_conflict",
    );
  });

  it("builds a month-end report from verified events only and omits unavailable metrics", () => {
    const end = "2026-10-31T22:59:59.999Z";
    const saved = event("reference_saved", "ref-1", "2026-10-05T09:00:00.000Z");
    const reviewed = event("opportunity_reviewed", "feedback-1", "2026-10-17T09:00:00.000Z");
    const outside = event("decision_confirmed", "old", "2026-09-30T21:59:59.999Z");
    const metrics = monthlyMetrics([saved, saved, reviewed, outside], new Date(end));
    expect(metrics.map(({ key, value }) => [key, value])).toEqual([
      ["references_saved", 1],
      ["signals_reviewed", 1],
    ]);
    const report = flow(
      evaluateLifecycle(
        facts({
          asOf: end,
          monthEnd: true,
          events: [saved, reviewed, outside],
        }),
      ),
      "monthly_value",
    );
    expect(report.status).toBe("drafted");
    expect(report.draft?.subject).toBe("Votre mois en intelligence");
    expect(report.draft?.text).toContain("1 référence enregistrée");
    expect(report.draft?.text).toContain("ne mesurent ni les ventes");
    expect(report.draft?.text).not.toContain("old");
    expect(report.draft?.text).not.toContain("€");
  });

  it("marks month-end reports unavailable when no verified events exist", () => {
    const result = flow(
      evaluateLifecycle(facts({ asOf: "2026-10-31T22:00:00.000Z", monthEnd: true })),
      "monthly_value",
    );
    expect(result.status).toBe("blocked");
    expect(result.exclusions).toContain("verified_monthly_data_missing");
  });

  it("chooses one draft per evaluation and keeps lifecycle segments evidence-based", () => {
    const result = evaluateLifecycle(
      facts({
        signupAt: "2026-10-20T00:00:00.000Z",
        qualifiedSignals: [
          {
            id: "signal-2",
            headline: "Signal public",
            companyName: "Maison Exemple",
            canonicalUrl: "https://source.example/item",
            firstSeenAt: "2026-10-21T08:00:00.000Z",
            qualification: "actionable",
            status: "source_confirmed",
            sourcePurpose: "strategic",
          },
        ],
      }),
    );
    expect(result.filter((row) => row.status === "drafted")).toHaveLength(1);
    const derived = deriveSegments(
      facts({ events: [event("reference_saved", "ref-1")] }),
    );
    expect(derived).toContain("active_collector");
    expect(derived).not.toContain("paying_subscriber");
    expect(derived).not.toContain("cancellation_requested");
  });

  it("applies the seven-day campaign draft cap across evaluation windows", () => {
    const capped = evaluateLifecycle(
      facts({
        signupAt: "2026-10-20T00:00:00.000Z",
        recentDraftedAt: "2026-10-20T12:00:00.000Z",
      }),
    );
    expect(flow(capped, "first_value").status).toBe("suppressed");
    expect(flow(capped, "first_value").exclusions).toContain(
      "seven_day_campaign_draft_cap",
    );
    expect(flow(capped, "first_value").draft).toBeNull();
  });

  it("renders plaintext and escaped, responsive HTML without private source data", () => {
    const draft = composeEmail(facts(), "weekly_intelligence", {
      link: "explorer",
      signals: [
        {
          id: "x",
          headline: "A & B < C",
          companyName: "A & B",
          canonicalUrl: "https://source.example",
          firstSeenAt: asOf,
          qualification: "actionable",
          status: "source_confirmed",
          sourcePurpose: "commercial",
        },
      ],
    });
    expect(draft.text).toContain("Examiner dans Radar");
    expect(draft.html).toContain("max-width:600px");
    expect(draft.html).not.toContain("A & B < C");
    expect(draft.html).not.toContain("https://source.example");
  });
});
