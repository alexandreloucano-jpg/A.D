import { randomUUID } from "node:crypto";
import { z } from "zod";
import { owner, type Config } from "./security.js";
import { Store, ServiceError, digest } from "./store.js";
import {
  normalizeIntake,
  intakeItemSchema,
  canonicalSource,
  type IntakeItem,
} from "../src/intake/model.js";
function stableId(seed: string) {
  const h = digest(seed).slice(0, 32).split("");
  h[12] = "8";
  h[16] = ["8", "9", "a", "b"][parseInt(h[16], 16) % 4];
  const s = h.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
export async function intakeRoute(r: Request, s: Store, c: Config) {
  if (c.role !== "app") throw new ServiceError(404, "not_found");
  const session = await owner(r, s, c, r.method !== "GET");
  if (r.method === "GET") {
    const ids = z
      .array(z.string().uuid())
      .max(100)
      .parse(
        (new URL(r.url).searchParams.get("ids") || "")
          .split(",")
          .filter(Boolean),
      );
    const rows = ids.length
      ? await s.query(
          "SELECT data FROM ad_records WHERE namespace='intake-source' AND data->>'owner'=$1 AND data->>'referenceId'=ANY($2::text[])",
          [session.owner, ids],
        )
      : [];
    return Response.json(
      {
        sources: rows.map((row) => {
          const d = row.data as Record<string, unknown>;
          return {
            referenceId: d.referenceId,
            images: d.images,
            tags: d.tags,
            publishedAt: d.publishedAt,
            notes: d.notes || [],
          };
        }),
      },
      { headers: { "cache-control": "no-store" } },
    );
  }
  if (r.method !== "POST") throw new ServiceError(405, "method_not_allowed");
  const raw = await r.text();
  if (Buffer.byteLength(raw) > 400000)
    throw new ServiceError(413, "request_too_large");
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new ServiceError(400, "invalid_json");
  }
  const input = z
    .object({
      method: z.enum(["file", "browser", "paste"]),
      items: z.array(intakeItemSchema).min(1).max(20),
    })
    .strict()
    .parse(data);
  let items: IntakeItem[];
  try {
    items = input.items.map(normalizeIntake);
  } catch {
    throw new ServiceError(400, "intake_source_invalid");
  }
  await s.quota("intake:" + session.owner, 500, 3600);
  const nonce = randomUUID();
  const lease = await s.query(
    "INSERT INTO ad_records(namespace,key,data,expires_at) VALUES('intake-lock',$1,$2::jsonb,now()+interval '2 minutes') ON CONFLICT(namespace,key) DO UPDATE SET data=excluded.data,expires_at=excluded.expires_at WHERE ad_records.expires_at<now() RETURNING key",
    [session.owner, JSON.stringify({ nonce })],
  );
  if (!lease.length) throw new ServiceError(409, "intake_busy");
  const results: {
    url: string;
    id?: string;
    verified: boolean;
    existing?: boolean;
    error?: string;
  }[] = [];
  try {
    const known = await s.query(
      "SELECT id,reference->>'url' AS url FROM ad_saver WHERE owner_id=$1 ORDER BY captured_at LIMIT 10001",
      [session.owner],
    );
    if (known.length > 10000) throw new ServiceError(409, "library_limit");
    const byUrl = new Map<string, string>();
    for (const row of known) {
      if (typeof row.url === "string") {
        try {
          byUrl.set(canonicalSource(row.url), String(row.id));
        } catch {}
      }
    }
    for (const item of items) {
      try {
        const sourceKey = session.owner + ":" + digest(item.url),
          previous = await s.get<{
            referenceId: string;
            notes?: string[];
            tags?: string[];
            images?: string[];
          }>("intake-source", sourceKey);
        const mergedNotes = [
          ...new Set([...(previous?.notes || []), ...item.notes]),
        ];
        if (mergedNotes.length > 100)
          throw new ServiceError(409, "intake_notes_limit");
        const found = previous?.referenceId || byUrl.get(item.url);
        let ref = found ? await s.read(session.owner, found) : null;
        if (previous && !ref)
          throw new ServiceError(409, "existing_reference_missing");
        const existing = !!ref,
          now = new Date().toISOString();
        if (!ref) {
          const x = item.url.match(/^https:\/\/x\.com\/i\/web\/status\/(\d+)$/);
          const id = stableId(
            x
              ? "ad-x-bookmark:" + session.owner + ":" + x[1]
              : "ad-intake:" + session.owner + ":" + item.url,
          );
          ref = await s.read(session.owner, id);
          if (!ref)
            ref = await s.save(session.owner, {
              id,
              title: item.title,
              content: item.text,
              url: item.url,
              origin: "human",
              capturedAt: now,
              approvedAt: now,
              revision: 1,
              isInternalQA: false,
            });
        }
        // Existing human titles, content, annotations and groups are never overwritten.
        if (previous) {
          await s.put("intake-source", sourceKey, {
            ...previous,
            notes: mergedNotes,
            tags: [...new Set([...(previous.tags || []), ...item.tags])],
            images: [
              ...new Set([...(previous.images || []), ...item.images]),
            ].slice(0, 8),
          });
        } else
          await s.put("intake-source", sourceKey, {
            owner: session.owner,
            referenceId: ref.id,
            method: input.method,
            sourceUrl: item.url,
            sourceText: item.text,
            images: item.images,
            tags: item.tags,
            notes: item.notes,
            publishedAt: item.publishedAt || null,
            sourceDate: item.sourceDate || null,
            receivedAt: now,
          });
        const source = await s.get<{ referenceId: string }>(
            "intake-source",
            sourceKey,
          ),
          readback = await s.read(session.owner, ref.id);
        if (!readback || source?.referenceId !== ref.id)
          throw new ServiceError(503, "intake_readback_failed");
        byUrl.set(item.url, ref.id);
        results.push({
          url: item.url,
          id: readback.id,
          verified: true,
          existing,
        });
      } catch (e) {
        results.push({
          url: item.url,
          verified: false,
          error:
            e instanceof ServiceError
              ? e.code
              : "intake_temporarily_unavailable",
        });
      }
    }
    await s.audit(
      session.owner,
      "owner",
      "intake_import",
      results.every((r) => r.verified) ? "verified" : "partial",
    );
    return Response.json(
      { results },
      { headers: { "cache-control": "no-store" } },
    );
  } finally {
    await s.query(
      "DELETE FROM ad_records WHERE namespace='intake-lock' AND key=$1 AND data->>'nonce'=$2",
      [session.owner, nonce],
    );
  }
}
