import { neon } from "@neondatabase/serverless";
import { createHash, randomUUID } from "node:crypto";
import { referenceSchema, type Reference } from "../src/domain.js";
import {
  lifecycleEventSchema,
  type LifecycleEvent,
} from "../src/lifecycle/model.js";
export type Query = (
  sql: string,
  params?: unknown[],
) => Promise<Record<string, unknown>[]>;
export class ServiceError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
export const digest = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export class Store {
  constructor(readonly query: Query) {}
  async put(namespace: string, key: string, data: unknown, ttl?: number) {
    await this.query(
      "INSERT INTO ad_records(namespace,key,data,expires_at) VALUES($1,$2,$3::jsonb,$4) ON CONFLICT(namespace,key) DO UPDATE SET data=excluded.data, expires_at=excluded.expires_at",
      [
        namespace,
        key,
        JSON.stringify(data),
        ttl ? new Date(Date.now() + ttl * 1000).toISOString() : null,
      ],
    );
  }
  async get<T>(namespace: string, key: string): Promise<T | null> {
    const [row] = await this.query(
      "SELECT data FROM ad_records WHERE namespace=$1 AND key=$2 AND (expires_at IS NULL OR expires_at>now())",
      [namespace, key],
    );
    return row ? (row.data as T) : null;
  }
  async take<T>(namespace: string, key: string): Promise<T | null> {
    const [row] = await this.query(
      "DELETE FROM ad_records WHERE namespace=$1 AND key=$2 AND (expires_at IS NULL OR expires_at>now()) RETURNING data",
      [namespace, key],
    );
    return row ? (row.data as T) : null;
  }
  async remove(namespace: string, key: string) {
    await this.query("DELETE FROM ad_records WHERE namespace=$1 AND key=$2", [
      namespace,
      key,
    ]);
  }
  async quota(principal: string, limit: number, seconds = 60) {
    const bucketWindow = Math.floor(Date.now() / (seconds * 1000));
    const rows = await this.query(
      "INSERT INTO ad_quota(principal,bucket_window,used) VALUES($1,$2,1) ON CONFLICT(principal,bucket_window) DO UPDATE SET used=ad_quota.used+1 WHERE ad_quota.used<$3 RETURNING used",
      [principal, bucketWindow, limit],
    );
    if (!rows.length) throw new ServiceError(429, "rate_limited");
  }
  async audit(
    owner: string,
    principal: string,
    operation: string,
    outcome: string,
  ) {
    await this.query(
      "INSERT INTO ad_audit(id,owner_id,principal,operation,outcome) VALUES($1,$2,$3,$4,$5)",
      [randomUUID(), owner, principal, operation, outcome],
    );
  }
  async recordLifecycleEvent(
    owner: string,
    input: Omit<LifecycleEvent, "owner" | "recordedAt" | "id"> & {
      idempotencyKey: string;
    },
  ) {
    const recordedAt = new Date().toISOString();
    const event = lifecycleEventSchema.parse({
      id: input.type + ":" + input.idempotencyKey,
      owner,
      type: input.type,
      occurredAt: input.occurredAt,
      recordedAt,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
    });
    await this.query(
      "INSERT INTO ad_records(namespace,key,data) VALUES($1,$2,$3::jsonb) ON CONFLICT(namespace,key) DO NOTHING",
      [
        "lifecycle-event:" + owner,
        event.id,
        JSON.stringify(event),
      ],
    );
    return event;
  }
  async save(
    owner: string,
    input: unknown,
    options: { trackLifecycle?: boolean } = {},
  ) {
    const reference = referenceSchema.parse(input);
    const fingerprint = digest(JSON.stringify(reference));
    const trackLifecycle =
      options.trackLifecycle !== false && !reference.isInternalQA;
    const verifiedWriteAt = new Date().toISOString();
    const sql = trackLifecycle
      ? "WITH saved AS (INSERT INTO ad_saver(owner_id,id,reference,fingerprint,captured_at) VALUES($1,$2,$3::jsonb,$4,$5) ON CONFLICT(owner_id,id) DO NOTHING RETURNING id), saved_event AS (INSERT INTO ad_records(namespace,key,data) SELECT 'lifecycle-event:'||$1,'reference_saved:'||$2::text,jsonb_build_object('id','reference_saved:'||$2::text,'owner',$1,'type','reference_saved','occurredAt',$6::text,'recordedAt',$6::text,'sourceType','saver_reference','sourceId',$2::text) FROM saved ON CONFLICT(namespace,key) DO NOTHING), first_event AS (INSERT INTO ad_records(namespace,key,data) SELECT 'lifecycle-event:'||$1,'first_reference_saved:account-first-save',jsonb_build_object('id','first_reference_saved:account-first-save','owner',$1,'type','first_reference_saved','occurredAt',$6::text,'recordedAt',$6::text,'sourceType','saver_reference','sourceId',$2::text) FROM saved WHERE NOT EXISTS(SELECT 1 FROM ad_saver WHERE owner_id=$1 AND id<>$2) ON CONFLICT(namespace,key) DO NOTHING) SELECT id FROM saved"
      : "INSERT INTO ad_saver(owner_id,id,reference,fingerprint,captured_at) VALUES($1,$2,$3::jsonb,$4,$5) ON CONFLICT(owner_id,id) DO NOTHING RETURNING id";
    await this.query(
      sql,
      [
        owner,
        reference.id,
        JSON.stringify(reference),
        fingerprint,
        reference.capturedAt,
        ...(trackLifecycle ? [verifiedWriteAt] : []),
      ],
    );
    const readback = await this.read(owner, reference.id);
    if (!readback || digest(JSON.stringify(readback)) !== fingerprint)
      throw new ServiceError(409, "uuid_conflict_or_unverified_write");
    return readback;
  }
  async read(owner: string, id: string): Promise<Reference | null> {
    const [row] = await this.query(
      "SELECT reference FROM ad_saver WHERE owner_id=$1 AND id=$2",
      [owner, id],
    );
    return row ? referenceSchema.parse(row.reference) : null;
  }
  async list(owner: string, query = "", after = "", limit = 100) {
    return (
      await this.query(
        "SELECT reference FROM ad_saver WHERE owner_id=$1 AND id::text>$2 AND (reference->>'title' ILIKE $3 OR reference->>'content' ILIKE $3) ORDER BY id LIMIT $4",
        [owner, after, "%" + query.replace(/[\\%_]/g, "\\$&") + "%", limit],
      )
    ).map((row) => referenceSchema.parse(row.reference));
  }
}
let cached: Store | undefined;
export function database() {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) throw new ServiceError(503, "storage_not_configured");
  const sql = neon(url);
  cached = new Store(
    async (text, params = []) =>
      (await sql.query(text, params)) as Record<string, unknown>[],
  );
  return cached;
}
