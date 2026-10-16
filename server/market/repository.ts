import { randomUUID } from "node:crypto";
import type { Store } from "../store.js";
import type { Finding } from "../../src/scout-market/schema.js";
export class MarketRepository {
  constructor(
    readonly store: Store,
    readonly owner: string,
  ) {}
  async findings() {
    return (
      await this.store.query(
        "SELECT data FROM ad_market_opportunities WHERE owner_id=$1 ORDER BY id",
        [this.owner],
      )
    ).map((r) => r.data as unknown as Finding);
  }
  async get(id: string) {
    const [r] = await this.store.query(
      "SELECT data FROM ad_market_opportunities WHERE owner_id=$1 AND id=$2",
      [this.owner, id],
    );
    return r?.data as unknown as Finding | undefined;
  }
  async ingest(f: Finding) {
    const now = new Date().toISOString();
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
   ON CONFLICT(owner_id,signal_id) DO NOTHING RETURNING id`,
      [
        this.owner,
        f.companyId,
        f.companyName.toLocaleLowerCase("fr"),
        JSON.stringify({
          name: f.companyName,
          relationshipStatus: "unknown",
          websiteUrl: null,
          createdAt: now,
        }),
        f.signalId,
        f.canonicalUrl,
        f.canonicalUrl,
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
      ],
    );
    return rows.length > 0;
  }
  async patch(
    id: string,
    patch: Record<string, unknown>,
    event: string,
    reason: string | null = null,
    value: number | null = null,
  ) {
    const stamp = new Date().toISOString();
    const [r] = await this.store.query(
      `WITH changed AS (UPDATE ad_market_opportunities SET data=data||$3::jsonb WHERE owner_id=$1 AND id=$2 RETURNING data), feedback AS (INSERT INTO ad_market_feedback(owner_id,id,opportunity_id,data) SELECT $1,$4,$2,$5::jsonb FROM changed) SELECT data FROM changed`,
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
      ],
    );
    return r?.data;
  }
}
