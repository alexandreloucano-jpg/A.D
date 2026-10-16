import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";
import { get } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { owner, type Config } from "./security.js";
import { ServiceError, type Store } from "./store.js";
import { safeUrl } from "../src/domain.js";
const sha = z.string().regex(/^[a-f0-9]{64}$/),
  uuid = z.string().uuid();
const types = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
] as const;
const input = z
  .object({
    referenceId: uuid,
    sourceUrl: safeUrl,
    sha256: sha,
    size: z
      .number()
      .int()
      .positive()
      .max(24 * 1024 * 1024),
    mime: z.enum(types),
  })
  .strict();
type Asset = {
  sha256: string;
  pathname: string;
  mime: string;
  size: number;
  verified: boolean;
};
const json = (b: unknown) =>
  Response.json(b, { headers: { "cache-control": "private, no-store" } });
export function mediaSignature(bytes: Uint8Array, mime: string) {
  const b = Buffer.from(bytes);
  return mime === "image/jpeg"
    ? b[0] === 255 && b[1] === 216 && b[2] === 255
    : mime === "image/png"
      ? b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : mime === "image/gif"
        ? /^GIF8[79]a$/.test(b.subarray(0, 6).toString())
        : mime === "image/webp"
          ? b.subarray(0, 4).toString() === "RIFF" &&
            b.subarray(8, 12).toString() === "WEBP"
          : mime === "video/mp4"
            ? b.subarray(4, 8).toString() === "ftyp"
            : false;
}
export function mediaRange(value: string, size: number) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!m || (!m[1] && !m[2]))
    throw new ServiceError(416, "media_range_invalid");
  const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2])),
    end = m[1]
      ? m[2]
        ? Math.min(Number(m[2]), size - 1)
        : size - 1
      : size - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start >= size ||
    end < start
  )
    throw new ServiceError(416, "media_range_invalid");
  return { start, end };
}
export async function mediaRoute(r: Request, s: Store, c: Config) {
  const session = await owner(
    r,
    s,
    c,
    r.method !== "GET" && r.method !== "HEAD",
  );
  const path = new URL(r.url).pathname.slice("/api/media".length);
  const configured = !!process.env.BLOB_READ_WRITE_TOKEN;
  if (path === "/status" && r.method === "GET") {
    const [b] = await s.query(
      "SELECT reserved_bytes FROM ad_media_budget WHERE owner_id=$1",
      [session.owner],
    );
    return json({
      configured,
      private: true,
      usedBytes: Number(b?.reserved_bytes || 0),
      limitBytes: 943718400,
    });
  }
  if (!configured)
    throw new ServiceError(503, "private_media_storage_unavailable");
  const find = async (hash: string) => {
    const [a] = await s.query(
      "SELECT sha256,pathname,mime,size,verified FROM ad_media_assets WHERE owner_id=$1 AND sha256=$2",
      [session.owner, hash],
    );
    if (!a) throw new ServiceError(404, "media_missing");
    return a as unknown as Asset;
  };
  if (path === "/prepare" && r.method === "POST") {
    const b = input.parse(await r.json());
    if (b.mime !== "video/mp4" && b.size > 8 * 1024 * 1024)
      throw new ServiceError(413, "media_file_too_large");
    if (!(await s.read(session.owner, b.referenceId)))
      throw new ServiceError(404, "reference_not_found");
    const sources = await s.query(
      "SELECT data FROM ad_records WHERE namespace='intake-source' AND data->>'owner'=$1 AND data->>'referenceId'=$2",
      [session.owner, b.referenceId],
    );
    if (
      !sources.some((row) => {
        const d = row.data as { images?: string[]; videos?: string[] };
        return [...(d.images || []), ...(d.videos || [])].includes(b.sourceUrl);
      })
    )
      throw new ServiceError(403, "media_source_not_owned");
    await s.quota("media-prepare:" + session.owner, 120);
    const lease = randomUUID();
    const lock = await s.query(
      "INSERT INTO ad_records(namespace,key,data,expires_at) VALUES('media-budget-lock',$1,$2::jsonb,now()+interval '20 seconds') ON CONFLICT(namespace,key) DO UPDATE SET data=excluded.data,expires_at=excluded.expires_at WHERE ad_records.expires_at<now() RETURNING key",
      [session.owner, JSON.stringify({ lease })],
    );
    if (!lock.length) throw new ServiceError(409, "media_transfer_busy");
    try {
      const old = await s.query(
        "SELECT * FROM ad_media_assets WHERE owner_id=$1 AND sha256=$2",
        [session.owner, b.sha256],
      );
      if (!old.length) {
        await s.quota("media-files:" + session.owner, 1500, 30 * 86400);
        await s.query(
          "INSERT INTO ad_media_budget(owner_id) VALUES($1) ON CONFLICT DO NOTHING",
          [session.owner],
        );
        const pathname = `saver/${session.owner}/${b.sha256}.${({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "video/mp4": "mp4" } as const)[b.mime]}`;
        const inserted = await s.query(
          "WITH budget AS (UPDATE ad_media_budget SET reserved_bytes=reserved_bytes+$3 WHERE owner_id=$1 AND reserved_bytes+$3<=943718400 RETURNING owner_id) INSERT INTO ad_media_assets(owner_id,sha256,pathname,mime,size) SELECT owner_id,$2,$4,$5,$3 FROM budget RETURNING sha256",
          [session.owner, b.sha256, b.size, pathname, b.mime],
        );
        if (!inserted.length)
          throw new ServiceError(409, "media_free_storage_full");
      }
      const asset = await find(b.sha256);
      if (asset.size !== b.size || asset.mime !== b.mime)
        throw new ServiceError(409, "media_metadata_conflict");
      await s.query(
        "INSERT INTO ad_media_links(owner_id,reference_id,source_url,sha256) VALUES($1,$2,$3,$4) ON CONFLICT(owner_id,reference_id,source_url) DO NOTHING",
        [session.owner, b.referenceId, b.sourceUrl, b.sha256],
      );
      const [link] = await s.query(
        "SELECT sha256 FROM ad_media_links WHERE owner_id=$1 AND reference_id=$2 AND source_url=$3",
        [session.owner, b.referenceId, b.sourceUrl],
      );
      if (link?.sha256 !== b.sha256)
        throw new ServiceError(409, "media_source_version_conflict");
      return json(asset);
    } finally {
      await s.query(
        "DELETE FROM ad_records WHERE namespace='media-budget-lock' AND key=$1 AND data->>'lease'=$2",
        [session.owner, lease],
      );
    }
  }
  if (path === "/upload" && r.method === "POST") {
    const body = (await r.json()) as HandleUploadBody;
    if (body.type !== "blob.generate-client-token")
      throw new ServiceError(400, "media_upload_event_invalid");
    const result = await handleUpload({
      request: r,
      body,
      onBeforeGenerateToken: async (pathname, payload, multipart) => {
        if (multipart)
          throw new ServiceError(400, "media_multipart_not_required");
        const hash = sha.parse(JSON.parse(payload || "{}").sha256);
        const asset = await find(hash);
        if (asset.verified || asset.pathname !== pathname)
          throw new ServiceError(403, "media_upload_path_invalid");
        await s.quota("media-upload-token:" + session.owner, 120);
        return {
          allowedContentTypes: [asset.mime],
          maximumSizeInBytes: asset.size,
          validUntil: Date.now() + 5 * 60000,
          addRandomSuffix: false,
          allowOverwrite: false,
        };
      },
    });
    return json(result);
  }
  const finish = /^\/([a-f0-9]{64})\/confirm$/.exec(path);
  if (finish && r.method === "POST") {
    const a = await find(finish[1]);
    if (!a.verified) {
      await s.quota("media-confirm:" + session.owner, 120);
      const file = await get(a.pathname, {
        access: "private",
        useCache: false,
      });
      if (!file || file.statusCode !== 200)
        throw new ServiceError(409, "media_upload_incomplete");
      const reader = file.stream.getReader(),
        hash = createHash("sha256");
      let size = 0;
      let head = Buffer.alloc(0);
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > a.size) throw new ServiceError(409, "media_hash_mismatch");
          hash.update(value);
          if (head.length < 16)
            head = Buffer.concat([head, Buffer.from(value)]).subarray(0, 16);
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      if (
        size !== a.size ||
        hash.digest("hex") !== a.sha256 ||
        !mediaSignature(head, a.mime)
      )
        throw new ServiceError(409, "media_hash_mismatch");
      await s.query(
        "UPDATE ad_media_assets SET verified=true,verified_at=now() WHERE owner_id=$1 AND sha256=$2",
        [session.owner, a.sha256],
      );
    }
    const verified = await find(a.sha256);
    return json({
      sha256: verified.sha256,
      bytes: verified.size,
      verified: verified.verified,
    });
  }
  const reference = /^\/reference\/([a-f0-9-]+)$/.exec(path);
  if (reference && r.method === "GET") {
    const id = uuid.parse(reference[1]);
    if (!(await s.read(session.owner, id)))
      throw new ServiceError(404, "reference_not_found");
    const entries = await s.query(
      'SELECT l.source_url AS "sourceUrl",a.sha256,a.mime,a.size,a.verified FROM ad_media_links l JOIN ad_media_assets a ON a.owner_id=l.owner_id AND a.sha256=l.sha256 WHERE l.owner_id=$1 AND l.reference_id=$2',
      [session.owner, id],
    );
    return json({
      items: entries.map((a) => ({
        ...a,
        url: a.verified ? "/api/media/" + a.sha256 : null,
      })),
    });
  }
  const binary = /^\/([a-f0-9]{64})$/.exec(path);
  if (binary && (r.method === "GET" || r.method === "HEAD")) {
    const a = await find(binary[1]);
    if (!a.verified) throw new ServiceError(404, "media_unverified");
    await s.quota("media-read:" + session.owner, 120);
    const headers = new Headers({
      "content-type": a.mime,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "accept-ranges": "bytes",
      "content-security-policy": "default-src 'none'; sandbox",
    });
    let range: { start: number; end: number } | undefined;
    const raw = r.headers.get("range");
    if (raw) range = mediaRange(raw, a.size);
    const size = range ? range.end - range.start + 1 : a.size;
    headers.set("content-length", String(size));
    if (range)
      headers.set(
        "content-range",
        `bytes ${range.start}-${range.end}/${a.size}`,
      );
    if (r.method === "HEAD")
      return new Response(null, { status: range ? 206 : 200, headers });
    const file = await get(a.pathname, {
      access: "private",
      ...(range
        ? { headers: { range: `bytes=${range.start}-${range.end}` } }
        : {}),
    });
    if (!file || file.statusCode !== 200)
      throw new ServiceError(404, "media_missing");
    if (range && !file.headers.get("content-range")) {
      await file.stream.cancel();
      throw new ServiceError(503, "media_range_unavailable");
    }
    return new Response(file.stream, { status: range ? 206 : 200, headers });
  }
  throw new ServiceError(404, "not_found");
}
