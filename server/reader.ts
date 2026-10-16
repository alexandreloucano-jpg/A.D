import { aiAvailable, answerQuestion } from "./ai.js";
import { z } from "zod";
import { type Store, ServiceError, digest } from "./store.js";
import { owner, type Config } from "./security.js";
import { type Reference } from "../src/domain.js";
import { directImageUrl } from "../src/media.js";
import {
  documentSchema,
  annotationSchema,
  annotationInput,
  versionSchema,
  anchorMatches,
  type ReaderDocument,
  type Annotation,
} from "../src/reader/model.js";
export function documentFrom(reference: Reference): ReaderDocument {
  const image = directImageUrl(reference.url),
    pdf = reference.url && /\.pdf$/i.test(new URL(reference.url).pathname);
  const kind = image
    ? "image"
    : pdf
      ? "pdf"
      : reference.content
        ? "text"
        : "unavailable";
  const text = reference.content;
  return {
    referenceId: reference.id,
    version: digest(kind + "\n" + text),
    text,
    kind,
    provenance: "capture",
    publishedAt: null,
    updatedAt: reference.capturedAt,
  };
}
export class ReaderStore {
  constructor(readonly store: Store) {}
  async current(ownerId: string, reference: Reference) {
    const [row] = await this.store.query(
      "SELECT d.document FROM ad_reader_heads h JOIN ad_reader_documents d ON d.owner_id=h.owner_id AND d.reference_id=h.reference_id AND d.version=h.version WHERE h.owner_id=$1 AND h.reference_id=$2",
      [ownerId, reference.id],
    );
    if (row) return documentSchema.parse(row.document);
    const [origin] = await this.store.query(
      "SELECT data FROM ad_records WHERE namespace='x-origin' AND key LIKE $1 AND data->>'referenceId'=$2 LIMIT 1",
      [ownerId + ":%", reference.id],
    );
    const source = origin?.data as
      | { sourceText?: string; publishedAt?: string; importedAt?: string }
      | undefined;
    if (source?.sourceText) {
      const doc = documentFrom({ ...reference, content: source.sourceText });
      return {
        ...doc,
        publishedAt: source.publishedAt || null,
        updatedAt: source.importedAt || reference.capturedAt,
      };
    }
    return documentFrom(reference);
  }
  async annotations(ownerId: string, referenceId: string) {
    return (
      await this.store.query(
        "SELECT annotation FROM ad_reader_annotations WHERE owner_id=$1 AND reference_id=$2 ORDER BY id",
        [ownerId, referenceId],
      )
    ).map((row) => annotationSchema.parse(row.annotation));
  }
  async document(
    ownerId: string,
    reference: Reference,
    text: string,
    expected: string,
    options?: {
      provenance: "extraction";
      publishedAt: string | null;
      kind: "text" | "pdf";
    },
  ) {
    const previous = await this.current(ownerId, reference);
    if (previous.version !== expected)
      throw new ServiceError(409, "content_version_changed");
    await this.store.query(
      "INSERT INTO ad_reader_documents(owner_id,reference_id,version,document,is_current) VALUES($1,$2,$3,$4::jsonb,false) ON CONFLICT(owner_id,reference_id,version) DO NOTHING",
      [ownerId, reference.id, previous.version, JSON.stringify(previous)],
    );
    const next: ReaderDocument = {
      referenceId: reference.id,
      version: digest((options?.kind || "text") + "\n" + text),
      kind: options?.kind || "text",
      text,
      provenance: options?.provenance || "manual",
      publishedAt: options?.publishedAt ?? previous.publishedAt,
      updatedAt: new Date().toISOString(),
    };
    // The head CAS is atomic even across concurrent server instances. Snapshots are immutable.
    const [saved] = await this.store.query(
      `WITH snapshot AS (INSERT INTO ad_reader_documents(owner_id,reference_id,version,document,is_current) VALUES($1,$2,$3,$5::jsonb,false) ON CONFLICT(owner_id,reference_id,version) DO UPDATE SET document=ad_reader_documents.document RETURNING version) INSERT INTO ad_reader_heads(owner_id,reference_id,version) SELECT $1,$2,version FROM snapshot ON CONFLICT(owner_id,reference_id) DO UPDATE SET version=excluded.version WHERE ad_reader_heads.version=$4 RETURNING version`,
      [ownerId, reference.id, next.version, expected, JSON.stringify(next)],
    );
    if (!saved) throw new ServiceError(409, "content_version_changed");
    const verified = await this.current(ownerId, reference);
    if (verified.version !== next.version || verified.text !== text)
      throw new ServiceError(409, "document_readback_failed");
    return verified;
  }
  async create(ownerId: string, reference: Reference, input: unknown) {
    const valid = annotationInput.parse(input),
      doc = await this.current(ownerId, reference);
    if (
      doc.version !== valid.contentVersion ||
      !anchorMatches(doc.text, valid.anchor)
    )
      throw new ServiceError(409, "anchor_or_version_changed");
    await this.store.query(
      "INSERT INTO ad_reader_documents(owner_id,reference_id,version,document,is_current) VALUES($1,$2,$3,$4::jsonb,false) ON CONFLICT(owner_id,reference_id,version) DO NOTHING",
      [ownerId, reference.id, doc.version, JSON.stringify(doc)],
    );
    const now = new Date().toISOString();
    const annotation: Annotation = {
      ...valid,
      referenceId: reference.id,
      revision: 1,
      createdAt: now,
      updatedAt: now,
    };
    await this.store.query(
      "INSERT INTO ad_reader_annotations(owner_id,reference_id,id,annotation,revision) VALUES($1,$2,$3,$4::jsonb,1) ON CONFLICT(owner_id,id) DO NOTHING",
      [ownerId, reference.id, valid.id, JSON.stringify(annotation)],
    );
    const verified = await this.read(ownerId, reference.id, valid.id);
    if (
      !verified ||
      verified.contentVersion !== valid.contentVersion ||
      verified.kind !== valid.kind ||
      verified.note !== valid.note ||
      JSON.stringify(verified.anchor) !== JSON.stringify(valid.anchor)
    )
      throw new ServiceError(409, "annotation_conflict_or_unverified_write");
    return verified;
  }
  async read(ownerId: string, referenceId: string, id: string) {
    const [row] = await this.store.query(
      "SELECT annotation FROM ad_reader_annotations WHERE owner_id=$1 AND reference_id=$2 AND id=$3",
      [ownerId, referenceId, id],
    );
    return row ? annotationSchema.parse(row.annotation) : null;
  }
  async edit(
    ownerId: string,
    referenceId: string,
    id: string,
    note: string,
    revision: number,
  ) {
    const previous = await this.read(ownerId, referenceId, id);
    if (!previous) throw new ServiceError(404, "annotation_not_found");
    const next = {
      ...previous,
      note,
      revision: revision + 1,
      updatedAt: new Date().toISOString(),
    };
    const rows = await this.store.query(
      "UPDATE ad_reader_annotations SET annotation=$1::jsonb,revision=revision+1 WHERE owner_id=$2 AND reference_id=$3 AND id=$4 AND revision=$5 RETURNING id",
      [JSON.stringify(next), ownerId, referenceId, id, revision],
    );
    if (!rows.length) throw new ServiceError(409, "annotation_changed");
    const read = await this.read(ownerId, referenceId, id);
    if (!read || read.revision !== next.revision || read.note !== note)
      throw new ServiceError(409, "annotation_readback_failed");
    return read;
  }
  async remove(
    ownerId: string,
    referenceId: string,
    id: string,
    revision: number,
  ) {
    const rows = await this.store.query(
      "DELETE FROM ad_reader_annotations WHERE owner_id=$1 AND reference_id=$2 AND id=$3 AND revision=$4 RETURNING id",
      [ownerId, referenceId, id, revision],
    );
    if (!rows.length) throw new ServiceError(409, "annotation_changed");
    if (await this.read(ownerId, referenceId, id))
      throw new ServiceError(503, "annotation_delete_unverified");
  }
  async search(ownerId: string, q: string) {
    const needle = "%" + q.replace(/[\\%_]/g, "\\$&") + "%";
    return await this.store.query(
      `SELECT DISTINCT r.id AS "referenceId", a.id AS "annotationId", a.annotation->'anchor'->>'exact' AS quote, a.annotation->>'note' AS note FROM ad_saver r LEFT JOIN ad_reader_heads h ON h.owner_id=r.owner_id AND h.reference_id=r.id LEFT JOIN ad_reader_documents d ON d.owner_id=h.owner_id AND d.reference_id=h.reference_id AND d.version=h.version LEFT JOIN ad_reader_annotations a ON a.owner_id=r.owner_id AND a.reference_id=r.id LEFT JOIN ad_records io ON io.namespace='intake-source' AND io.data->>'owner'=r.owner_id AND io.data->>'referenceId'=r.id::text LEFT JOIN ad_records xo ON xo.namespace='x-origin' AND xo.key LIKE r.owner_id||':%' AND xo.data->>'referenceId'=r.id::text WHERE r.owner_id=$1 AND COALESCE((r.reference->>'isInternalQA')::boolean,false)=false AND (r.reference->>'title' ILIKE $2 OR r.reference->>'content' ILIKE $2 OR d.document->>'text' ILIKE $2 OR xo.data->>'sourceText' ILIKE $2 OR io.data->>'sourceText' ILIKE $2 OR (io.data->'tags')::text ILIKE $2 OR (io.data->'notes')::text ILIKE $2 OR a.annotation->>'note' ILIKE $2 OR a.annotation->'anchor'->>'exact' ILIKE $2) LIMIT 100`,
      [ownerId, needle],
    );
  }
}
export async function readerRoute(
  r: Request,
  s: Store,
  c: Config,
): Promise<Response> {
  const session = await owner(r, s, c, r.method !== "GET");
  const url = new URL(r.url);
  const db = new ReaderStore(s);
  const json = (value: unknown, status = 200) =>
    new Response(JSON.stringify(value), {
      status,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });
  if (url.pathname === "/api/reader/search") {
    if (r.method !== "GET") throw new ServiceError(405, "method_not_allowed");
    const query = z
      .string()
      .trim()
      .min(1)
      .max(300)
      .parse(url.searchParams.get("q"));
    return json({ matches: await db.search(session.owner, query) });
  }
  const match =
    /^\/api\/reader\/([a-f0-9-]+)(?:\/(document|annotations|question)(?:\/([a-f0-9-]+))?)?$/.exec(
      url.pathname,
    );
  if (!match) throw new ServiceError(404, "not_found");
  const referenceId = z.string().uuid().parse(match[1]),
    reference = await s.read(session.owner, referenceId);
  if (!reference) throw new ServiceError(404, "reference_not_found");
  if (r.method === "GET" && !match[2]) {
    const current = await db.current(session.owner, reference);
    const snapshots = await s.query(
      "SELECT document FROM ad_reader_documents WHERE owner_id=$1 AND reference_id=$2 ORDER BY version",
      [session.owner, reference.id],
    );
    const versions = [
      current,
      ...snapshots.map((row) => documentSchema.parse(row.document)),
    ]
      .filter(
        (doc, index, all) =>
          all.findIndex((other) => other.version === doc.version) === index,
      )
      .map((doc) => ({
        version: doc.version,
        updatedAt: doc.updatedAt,
        provenance: doc.provenance,
        kind: doc.kind,
      }));
    return json({
      document: current,
      annotations: await db.annotations(session.owner, reference.id),
      aiAvailable: aiAvailable(),
      hasOriginal: !!(await s.get(
        "reader-extraction",
        session.owner + ":" + reference.id + ":" + current.version,
      )),
      versions,
    });
  }
  const raw = await r.text();
  if (Buffer.byteLength(raw) > 220000)
    throw new ServiceError(413, "request_too_large");
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    throw new ServiceError(400, "invalid_json");
  }
  await s.quota("reader:" + session.owner, 60);
  if (match[2] === "document" && r.method === "PUT") {
    const valid = z
      .object({
        text: z.string().min(1).max(200000),
        expectedVersion: versionSchema,
      })
      .strict()
      .parse(input);
    return json({
      document: await db.document(
        session.owner,
        reference,
        valid.text,
        valid.expectedVersion,
      ),
      verified: true,
    });
  }
  if (match[2] === "annotations" && !match[3] && r.method === "POST")
    return json(
      {
        annotation: await db.create(session.owner, reference, input),
        verified: true,
      },
      201,
    );
  if (match[2] === "annotations" && match[3]) {
    const id = z.string().uuid().parse(match[3]);
    if (r.method === "PUT") {
      const valid = z
        .object({
          note: z.string().max(5000),
          revision: z.number().int().positive(),
        })
        .strict()
        .parse(input);
      return json({
        annotation: await db.edit(
          session.owner,
          reference.id,
          id,
          valid.note,
          valid.revision,
        ),
        verified: true,
      });
    }
    if (r.method === "DELETE") {
      const valid = z
        .object({ revision: z.number().int().positive() })
        .strict()
        .parse(input);
      await db.remove(session.owner, reference.id, id, valid.revision);
      return json({ deleted: true, verified: true });
    }
  }
  if (match[2] === "question" && r.method === "POST") {
    const valid = z
      .object({
        question: z.string().trim().min(1).max(2000),
        contentVersion: versionSchema,
        anchor: z.unknown(),
      })
      .strict()
      .parse(input);
    const doc = await db.current(session.owner, reference);
    if (doc.version !== valid.contentVersion)
      throw new ServiceError(409, "content_version_changed");
    return json({
      answer: await answerQuestion(s, session.owner, reference, doc, valid),
    });
  }
  throw new ServiceError(405, "method_not_allowed");
}
