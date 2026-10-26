import { randomUUID } from "node:crypto";
import { digest, type Store } from "../store.js";
import type { Finding } from "../../src/scout-market/schema.js";
import { SOURCE_REGISTRY } from "./sources.js";
import { qualifyFinding } from "../../src/scout-market/qualification.js";
function effectiveFinding(f: Finding) {
  const source = SOURCE_REGISTRY.find((s) => s.id === f.sourceId);
  return qualifyFinding({
    ...f,
    sourcePurpose: source?.purpose || f.sourcePurpose,
    sourceAccessStatus:
      f.sourceError || source?.accessStatus || f.sourceAccessStatus,
    ownerEventWindow: source?.ownerEventWindow || f.ownerEventWindow,
  });
}
export class MarketRepository {
  constructor(
    readonly store: Store,
    readonly owner: string,
  ) {}
  async findings() {
    return (
      await this.store.query(
        "SELECT o.data||jsonb_build_object('relationshipStatus',c.data->>'relationshipStatus','sourceError',src.data->>'errorCode') AS data FROM ad_market_opportunities o JOIN ad_market_companies c ON c.owner_id=o.owner_id AND c.id=o.company_id LEFT JOIN ad_market_sources src ON src.owner_id=o.owner_id AND src.source_id=o.data->>'sourceId' WHERE o.owner_id=$1 ORDER BY o.id",
        [this.owner],
      )
    ).map((r) => effectiveFinding(r.data as unknown as Finding));
  }
  async get(id: string) {
    const [r] = await this.store.query(
      "SELECT o.data||jsonb_build_object('relationshipStatus',c.data->>'relationshipStatus','sourceError',src.data->>'errorCode') AS data FROM ad_market_opportunities o JOIN ad_market_companies c ON c.owner_id=o.owner_id AND c.id=o.company_id LEFT JOIN ad_market_sources src ON src.owner_id=o.owner_id AND src.source_id=o.data->>'sourceId' WHERE o.owner_id=$1 AND o.id=$2",
      [this.owner, id],
    );
    return r?.data ? effectiveFinding(r.data as unknown as Finding) : undefined;
  }
  async ingest(f: Finding) {
    const now = new Date().toISOString();
    const proposedKey = digest(
      JSON.stringify([
        f.companyName.toLocaleLowerCase("fr"),
        f.eventType,
        f.eventStart ||
          f.eventDate ||
          f.headline
            .normalize("NFKD")
            .replace(/[^a-z0-9]/gi, "")
            .toLowerCase(),
        f.eventStart || f.eventDate
          ? f.eventEnd || null
          : f.publishedAt?.slice(0, 10) || null,
      ]),
    );
    const [previous] = await this.store.query(
      "SELECT event_key FROM ad_market_signals WHERE owner_id=$1 AND (canonical_url=$2 OR event_key=$3) LIMIT 1",
      [this.owner, f.canonicalUrl, proposedKey],
    );
    const rows = await this.store.query(
      `WITH company AS (
   INSERT INTO ad_market_companies(owner_id,id,canonical_name,data) VALUES($1,$2,$3,$4::jsonb)
   ON CONFLICT(owner_id,canonical_name) DO UPDATE SET canonical_name=excluded.canonical_name RETURNING id
  ), signal AS (
   INSERT INTO ad_market_signals(owner_id,id,company_id,canonical_url,event_key,data) SELECT $1,$5,id,$6,$7,$8::jsonb FROM company
   ON CONFLICT(owner_id,event_key) DO UPDATE SET data=ad_market_signals.data||jsonb_build_object('lastSeenAt',$13::text) RETURNING id,company_id
  ), evidence AS (
   INSERT INTO ad_market_evidence(owner_id,id,signal_id,url,data) SELECT $1,$9,id,$6,$10::jsonb FROM signal
   ON CONFLICT(owner_id,url) DO NOTHING RETURNING id
  ) INSERT INTO ad_market_opportunities(owner_id,id,company_id,signal_id,data)
   SELECT $1,$11,company_id,id,$12::jsonb||jsonb_build_object('companyId',company_id,'signalId',id) FROM signal
   ON CONFLICT(owner_id,signal_id) DO UPDATE SET data=ad_market_opportunities.data||jsonb_build_object('lastSeenAt',$13::text,'sourceCount',(SELECT count(*) FROM ad_market_evidence WHERE owner_id=$1 AND signal_id=excluded.signal_id)+(SELECT count(*) FROM evidence),'corroboratingPrimarySource',coalesce(ad_market_opportunities.data->>'corroboratingPrimarySource',$14::text)) RETURNING id,(xmax=0) AS inserted`,
      [
        this.owner,
        f.companyId,
        f.companyName.toLocaleLowerCase("fr"),
        JSON.stringify({
          name: f.companyName,
          entityType: f.entityType || "company",
          relationshipStatus: "unknown",
          websiteUrl: null,
          createdAt: now,
        }),
        f.signalId,
        f.canonicalUrl,
        previous?.event_key || proposedKey,
        JSON.stringify(f),
        f.evidenceId,
        JSON.stringify({
          id: f.evidenceId,
          url: f.canonicalUrl,
          publisher: f.publisher,
          publishedAt: f.publishedAt,
          collectedAt: now,
          excerpt: f.excerpt,
          claimSupported: f.reportedFact,
          sourceClass: f.sourceClass,
          httpStatus: 200,
          contentHash: f.contentHash,
        }),
        f.id,
        JSON.stringify(f),
        now,
        f.sourceClass === "official" ? f.canonicalUrl : null,
      ],
    );
    return rows[0]?.inserted === true;
  }
  async patch(
    id: string,
    patch: Record<string, unknown>,
    event: string,
    reason: string | null = null,
    value: number | null = null,
  ) {
    const stamp = new Date().toISOString();
    const eventTypes =
      patch.reviewState !== undefined
        ? [
            "opportunity_reviewed",
            ...(event === "accepted" || event === "rejected"
              ? ["decision_confirmed"]
              : []),
          ]
        : patch.projectId !== undefined
          ? ["work_dossier_linked"]
          : patch.stage === "won" && value !== null
            ? ["measurable_outcome_recorded"]
            : [];
    const outcomeOccurredAt =
      patch.stage === "won" &&
      typeof patch.stageEvidence === "object" &&
      patch.stageEvidence !== null &&
      "occurredAt" in patch.stageEvidence &&
      typeof patch.stageEvidence.occurredAt === "string"
        ? patch.stageEvidence.occurredAt
        : stamp;
    const [r] = await this.store.query(
      `WITH changed AS (UPDATE ad_market_opportunities SET data=data||$3::jsonb WHERE owner_id=$1 AND id=$2 AND NOT(data @> $6::jsonb) RETURNING data), feedback AS (INSERT INTO ad_market_feedback(owner_id,id,opportunity_id,data) SELECT $1,$4,$2,$5::jsonb FROM changed RETURNING id), lifecycle AS (INSERT INTO ad_records(namespace,key,data) SELECT 'lifecycle-event:'||$1,feedback.id::text||':'||event_type,jsonb_build_object('id',feedback.id::text||':'||event_type,'owner',$1,'type',event_type,'occurredAt',CASE WHEN event_type='measurable_outcome_recorded' THEN $8::text ELSE $9::text END,'recordedAt',$9::text,'sourceType','market_feedback','sourceId',$2::text) FROM feedback CROSS JOIN unnest($7::text[]) AS event_type ON CONFLICT(namespace,key) DO NOTHING) SELECT data FROM changed`,
      [
        this.owner,
        id,
        JSON.stringify({ ...patch, updatedAt: stamp }),
        randomUUID(),
        JSON.stringify({
          event,
          reason,
          outcomeValueEur: value,
          valueConfirmed: value !== null,
          occurredAt: stamp,
          createdAt: stamp,
        }),
        JSON.stringify(patch),
        eventTypes,
        outcomeOccurredAt,
        stamp,
      ],
    );
    return r?.data || (await this.get(id));
  }
}
