import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { publicAddress, sourceUrl } from "../extraction.js";
import { ServiceError } from "../store.js";
import { SOURCES } from "./sources.js";
export function allowedUrl(raw: string) {
  const u = sourceUrl(raw);
  if (!SOURCES.some((s) => s.domain === u.hostname))
    throw new ServiceError(400, "market_host_not_allowed");
  return u;
}
export async function publicFetch(
  raw: string,
  headers: Record<string, string> = {},
): Promise<{
  text: string;
  status: number;
  etag: string | null;
  modified: string | null;
}> {
  let u = allowedUrl(raw);
  const deadline = Date.now() + 8000;
  for (let redirect = 0; redirect <= 3; redirect++) {
    const a = await Promise.race([
      lookup(u.hostname, { all: true }),
      new Promise<never>((_, reject) => {
        const t = setTimeout(
          () => reject(new ServiceError(504, "market_dns_timeout")),
          Math.max(1, deadline - Date.now()),
        );
        t.unref();
      }),
    ]);
    if (!a.length || a.some((x) => !publicAddress(x.address)))
      throw new ServiceError(400, "market_private_address");
    const selected = a[0];
    const res = await new Promise<{
      text: string;
      status: number;
      location?: string;
      etag: string | null;
      modified: string | null;
    }>((resolve, reject) => {
      const req = request(
        u,
        {
          agent: false,
          family: selected.family,
          lookup: (_h, _o, cb) => cb(null, selected.address, selected.family),
          headers: {
            "user-agent": "AD-Market/1.0 (private research; short excerpts)",
            accept:
              "text/html,application/rss+xml,application/atom+xml,text/plain",
            "accept-encoding": "identity",
            ...headers,
          },
        },
        (r) => {
          const status = r.statusCode || 502;
          const meta = {
            status,
            etag: r.headers.etag || null,
            modified: r.headers["last-modified"] || null,
          };
          if (status === 304 || (status >= 300 && status < 400)) {
            r.resume();
            resolve({ ...meta, text: "", location: r.headers.location });
            return;
          }
          if (status !== 200) {
            r.resume();
            reject(
              new ServiceError(
                status === 429 ? 429 : 502,
                "market_source_http_" + status,
              ),
            );
            return;
          }
          if (
            !/^(text\/(html|plain)|application\/(rss\+xml|atom\+xml|xml|xhtml\+xml))/.test(
              String(r.headers["content-type"]),
            ) ||
            (r.headers["content-encoding"] &&
              r.headers["content-encoding"] !== "identity")
          ) {
            r.destroy();
            reject(new ServiceError(415, "market_source_type"));
            return;
          }
          let bytes = 0;
          const parts: Buffer[] = [];
          r.on("data", (p: Buffer) => {
            bytes += p.length;
            if (bytes > 1500000) {
              r.destroy();
              reject(new ServiceError(413, "market_source_size"));
            } else parts.push(p);
          });
          r.on("error", reject);
          r.on("end", () =>
            resolve({ ...meta, text: Buffer.concat(parts).toString("utf8") }),
          );
        },
      );
      const timer = setTimeout(
        () => req.destroy(new ServiceError(504, "market_source_timeout")),
        Math.max(1, deadline - Date.now()),
      );
      req.on("close", () => clearTimeout(timer));
      req.on("error", reject);
      req.end();
    });
    if (res.location) {
      u = allowedUrl(new URL(res.location, u).href);
      continue;
    }
    return res;
  }
  throw new ServiceError(502, "market_redirect_limit");
}
export function robotsAllows(text: string, path: string) {
  // Conservative: deny any matching Disallow, regardless of user-agent; allow never broadens a denial.
  return !text.split("\n").some((line) => {
    const p = /^\s*Disallow:\s*([^#\s]+)/i.exec(line)?.[1];
    if (!p) return false;
    const re = new RegExp(
      "^" +
        p
          .split("*")
          .map((x) => x.replace(/[.+?^{}()|[\]\\]/g, "\\$&"))
          .join(".*")
          .replace(/\$$/, "$"),
    );
    return re.test(path);
  });
}
