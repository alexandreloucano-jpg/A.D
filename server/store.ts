import { neon } from "@neondatabase/serverless";
import { createHash, randomUUID } from "node:crypto";
import { referenceSchema, type Reference } from "../src/domain";
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
  async save(owner: string, input: unknown) {
    const reference = referenceSchema.parse(input);
    const fingerprint = digest(JSON.stringify(reference));
    await this.query(
      "INSERT INTO ad_saver(owner_id,id,reference,fingerprint,captured_at) VALUES($1,$2,$3::jsonb,$4,$5) ON CONFLICT(owner_id,id) DO NOTHING",
      [
        owner,
        reference.id,
        JSON.stringify(reference),
        fingerprint,
        reference.capturedAt,
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
