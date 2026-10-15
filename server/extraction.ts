import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { z } from "zod";
import { ServiceError, digest, type Store } from "./store.js";
import { owner, type Config } from "./security.js";
import type { Reference } from "../src/domain.js";
import { versionSchema } from "../src/reader/model.js";
import { ReaderStore } from "./reader.js";
const MAX_BYTES = 5 * 1024 * 1024;
export function publicAddress(address: string) {
  try {
    let ip = ipaddr.parse(address);
    if (ip.kind() === "ipv6" && (ip as ipaddr.IPv6).isIPv4MappedAddress())
      ip = (ip as ipaddr.IPv6).toIPv4Address();
    return ip.range() === "unicast";
  } catch {
    return false;
  }
}
export function sourceUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ServiceError(400, "source_url_invalid");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    isIP(url.hostname.replace(/^\[|\]$/g, "")) ||
    url.hostname.toLowerCase() === "localhost" ||
    url.hostname.endsWith(".local") ||
    url.hostname.endsWith(".internal")
  )
    throw new ServiceError(400, "source_url_not_allowed");
  return url;
}
export async function fetchSource(
  raw: string,
  resolve: typeof lookup = lookup,
): Promise<{ bytes: Buffer; mime: string; url: string }> {
  let url = sourceUrl(raw);
  const deadline = Date.now() + 18000;
  for (let redirects = 0; redirects <= 3; redirects++) {
    let dnsTimer: ReturnType<typeof setTimeout> | undefined;
    const addresses = await Promise.race([
      resolve(url.hostname, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => {
        dnsTimer = setTimeout(
          () => reject(new ServiceError(504, "source_dns_timeout")),
          Math.max(1, deadline - Date.now()),
        );
      }),
    ]).finally(() => {
      if (dnsTimer) clearTimeout(dnsTimer);
    });
    if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
      throw new ServiceError(400, "source_private_address_rejected");
    const selected = addresses[0];
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new ServiceError(504, "source_timeout");
    const result = await new Promise<{
      status: number;
      location?: string;
      mime: string;
      bytes: Buffer;
    }>((accept, reject) => {
      const req = httpsRequest(
        url,
        {
          method: "GET",
          headers: {
            "user-agent": "AD-Saver-Reader/1.0",
            accept:
              "text/html,application/xhtml+xml,application/pdf,text/plain",
            "accept-encoding": "identity",
          },
          agent: false,
          family: selected.family,
          lookup: (_host, _options, callback) =>
            callback(null, selected.address, selected.family),
          timeout: remaining,
        },
        (response) => {
          const status = response.statusCode || 502,
            location = response.headers.location,
            mime = (response.headers["content-type"] || "")
              .split(";")[0]
              .toLowerCase();
          if (status >= 300 && status < 400) {
            response.resume();
            accept({ status, location, mime, bytes: Buffer.alloc(0) });
            return;
          }
          if (status !== 200) {
            response.resume();
            reject(
              new ServiceError(
                status === 401 || status === 403 ? 403 : 502,
                status === 401 || status === 403
                  ? "source_access_denied"
                  : "source_http_error",
              ),
            );
            return;
          }
          if (
            response.headers["content-encoding"] &&
            response.headers["content-encoding"] !== "identity"
          ) {
            response.destroy();
            reject(new ServiceError(415, "source_encoding_unsupported"));
            return;
          }
          if (
            ![
              "text/html",
              "application/xhtml+xml",
              "application/pdf",
              "text/plain",
            ].includes(mime)
          ) {
            response.destroy();
            reject(new ServiceError(415, "source_type_unsupported"));
            return;
          }
          if (Number(response.headers["content-length"]) > MAX_BYTES) {
            response.destroy();
            reject(new ServiceError(413, "source_too_large"));
            return;
          }
          let size = 0;
          const chunks: Buffer[] = [];
          response.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > MAX_BYTES) {
              response.destroy();
              reject(new ServiceError(413, "source_too_large"));
            } else chunks.push(chunk);
          });
          response.on("end", () =>
            accept({ status, mime, bytes: Buffer.concat(chunks) }),
          );
          response.on("error", () =>
            reject(new ServiceError(502, "source_download_interrupted")),
          );
        },
      );
      const hardTimer = setTimeout(() => {
        req.destroy();
        reject(new ServiceError(504, "source_timeout"));
      }, remaining);
      req.on("close", () => clearTimeout(hardTimer));
      req.on("timeout", () => {
        req.destroy();
        reject(new ServiceError(504, "source_timeout"));
      });
      req.on("error", () =>
        reject(new ServiceError(502, "source_unreachable")),
      );
      req.end();
    });
    if (result.status >= 300 && result.status < 400) {
      if (!result.location || redirects === 3)
        throw new ServiceError(400, "source_redirect_limit");
      url = sourceUrl(new URL(result.location, url).href);
      continue;
    }
    return { bytes: result.bytes, mime: result.mime, url: url.href };
  }
  throw new ServiceError(400, "source_redirect_limit");
}
export async function extractContent(bytes: Buffer, mime: string, url: string) {
  if (bytes.length > MAX_BYTES) throw new ServiceError(413, "source_too_large");
  if (mime === "application/pdf") {
    if (bytes.subarray(0, 5).toString() !== "%PDF-")
      throw new ServiceError(415, "source_pdf_invalid");
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loading = getDocument({
      data: new Uint8Array(bytes),
      useSystemFonts: false,
      disableFontFace: true,
      useWorkerFetch: false,
      stopAtErrors: true,
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const pdf = await Promise.race([
        loading.promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            void loading.destroy();
            reject(new ServiceError(504, "source_pdf_timeout"));
          }, 12000);
        }),
      ]);
      if (pdf.numPages > 50)
        throw new ServiceError(413, "source_pdf_page_limit");
      const pages: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i),
          content = await page.getTextContent();
        pages.push(
          content.items
            .map((item) =>
              "str" in item
                ? item.str + ("hasEOL" in item && item.hasEOL ? "\n" : " ")
                : "",
            )
            .join("")
            .trim(),
        );
        page.cleanup();
        if (pages.join("\n\n").length > 200000)
          throw new ServiceError(413, "source_text_too_large");
      }
      const text = pages.join("\n\n");
      if (!text.trim())
        throw new ServiceError(422, "source_pdf_has_no_text_layer");
      return {
        text,
        publishedAt: null,
        kind: "pdf" as const,
        pages: pdf.numPages,
      };
    } catch (e) {
      if (e instanceof ServiceError) throw e;
      throw new ServiceError(422, "source_pdf_unreadable_or_protected");
    } finally {
      if (timer) clearTimeout(timer);
      await loading.destroy();
    }
  }
  if (mime === "text/plain") {
    const text = bytes.toString("utf8");
    if (text.length > 200000)
      throw new ServiceError(413, "source_text_too_large");
    if (!text.trim()) throw new ServiceError(422, "source_empty");
    return { text, publishedAt: null, kind: "text" as const, pages: null };
  }
  const html = bytes.toString("utf8");
  const { document } = parseHTML(html);
  if (document.querySelectorAll("*").length > 60000)
    throw new ServiceError(413, "source_html_too_complex");
  const rawDate =
    document
      .querySelector('meta[property="article:published_time"]')
      ?.getAttribute("content") ||
    document.querySelector('meta[name="date"]')?.getAttribute("content");
  const publishedAt =
    rawDate && Number.isFinite(Date.parse(rawDate))
      ? new Date(rawDate).toISOString()
      : null;
  // Parsing is inert: no scripts, frames, stylesheet or image requests are executed.
  const article = new Readability(document as unknown as Document, {
    maxElemsToParse: 60000,
    charThreshold: 100,
  }).parse();
  if (!article?.textContent?.trim())
    throw new ServiceError(422, "source_article_unreadable");
  const text = article.textContent.replace(/\r\n/g, "\n").trim();
  if (text.length > 200000)
    throw new ServiceError(413, "source_text_too_large");
  return { text, publishedAt, kind: "text" as const, pages: null };
}
export async function extractRoute(
  request: Request,
  store: Store,
  c: Config,
  reference: Reference,
) {
  const session = await owner(request, store, c, true);
  if (request.method !== "POST")
    throw new ServiceError(405, "method_not_allowed");
  const input = z
    .object({ expectedVersion: versionSchema })
    .strict()
    .parse(await request.json());
  const reader = new ReaderStore(store);
  if (
    (await reader.current(session.owner, reference)).version !==
    input.expectedVersion
  )
    throw new ServiceError(409, "content_version_changed");
  if (!reference.url) throw new ServiceError(400, "source_url_missing");
  await store.quota("extraction:" + session.owner, 10, 3600);
  const source = await fetchSource(reference.url);
  const extracted = await extractContent(source.bytes, source.mime, source.url);
  const originalId = createHash("sha256").update(source.bytes).digest("hex");
  const key = session.owner + ":" + reference.id + ":" + originalId;
  const snapshot = {
    sourceUrl: source.url,
    mime: source.mime,
    sha256: originalId,
    bytesBase64: source.bytes.toString("base64"),
    fetchedAt: new Date().toISOString(),
  };
  await store.query(
    "INSERT INTO ad_records(namespace,key,data) VALUES('reader-original',$1,$2::jsonb) ON CONFLICT(namespace,key) DO NOTHING",
    [key, JSON.stringify(snapshot)],
  );
  const savedOriginal = await store.get<typeof snapshot>(
    "reader-original",
    key,
  );
  if (savedOriginal?.bytesBase64 !== snapshot.bytesBase64)
    throw new ServiceError(503, "source_original_unverified");
  const document = await reader.document(
    session.owner,
    reference,
    extracted.text,
    input.expectedVersion,
    {
      provenance: "extraction",
      publishedAt: extracted.publishedAt,
      kind: extracted.kind,
    },
  );
  await store.put(
    "reader-extraction",
    session.owner + ":" + reference.id + ":" + document.version,
    {
      originalKey: key,
      sourceUrl: source.url,
      mime: source.mime,
      pages: extracted.pages,
      extractedAt: snapshot.fetchedAt,
    },
  );
  return new Response(
    JSON.stringify({ document, verified: true, originalPreserved: true }),
    {
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    },
  );
}
export async function originalRoute(
  request: Request,
  store: Store,
  c: Config,
  reference: Reference,
) {
  const session = await owner(request, store, c);
  if (request.method !== "GET")
    throw new ServiceError(405, "method_not_allowed");
  const version = versionSchema.parse(
    new URL(request.url).searchParams.get("version"),
  );
  const mapping = await store.get<{ originalKey: string }>(
    "reader-extraction",
    session.owner + ":" + reference.id + ":" + version,
  );
  if (!mapping) throw new ServiceError(404, "original_not_available");
  const snapshot = await store.get<{ bytesBase64: string; mime: string }>(
    "reader-original",
    mapping.originalKey,
  );
  if (!snapshot) throw new ServiceError(404, "original_not_available");
  const bytes = Buffer.from(snapshot.bytesBase64, "base64");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": "application/octet-stream",
      "content-disposition": `attachment; filename="source-${reference.id}.${snapshot.mime === "application/pdf" ? "pdf" : "txt"}"`,
      "x-content-type-options": "nosniff",
      "content-security-policy": "sandbox; default-src 'none'",
      "cache-control": "no-store",
    },
  });
}
