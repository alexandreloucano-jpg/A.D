import { once } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { database, ServiceError } from "../server/store.js";
import { configuration } from "../server/security.js";
import { handle } from "../server/service.js";
export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
) {
  try {
    const c = configuration();
    const roleOrigin = c.role === "app" ? c.app : c.gateway;
    // Vercel supplies Host. Never fabricate a canonical host for an alias POST,
    // or trust an arbitrary x-forwarded-host header from a request.
    const host = req.headers.host;
    if (host && (Array.isArray(host) || !/^[A-Za-z0-9.:-]+$/.test(host)))
      throw new ServiceError(400, "invalid_request_host");
    const target = req.url || "/";
    if (!target.startsWith("/") || target.startsWith("//"))
      throw new ServiceError(400, "invalid_request_target");
    const url = new URL(target, host ? "https://" + host : roleOrigin);
    const route = url.searchParams.get("route");
    if (route !== null) {
      url.pathname = "/" + route;
      url.searchParams.delete("route");
    }
    const requestHeaders = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value)
        requestHeaders.set(key, Array.isArray(value) ? value.join(",") : value);
    }
    const method = req.method || "GET";
    let raw: string | undefined;
    if (method !== "GET" && method !== "HEAD") {
      if (req.body !== undefined) {
        if (Buffer.isBuffer(req.body)) raw = req.body.toString("utf8");
        else if (typeof req.body === "string") raw = req.body;
        else if (
          requestHeaders.get("content-type")?.split(";")[0] ===
            "application/x-www-form-urlencoded" &&
          req.body &&
          typeof req.body === "object" &&
          !Array.isArray(req.body)
        ) {
          const form = new URLSearchParams();
          for (const [key, value] of Object.entries(req.body)) {
            for (const item of Array.isArray(value) ? value : [value]) {
              if (typeof item !== "string")
                throw new ServiceError(400, "invalid_form");
              form.append(key, item);
            }
          }
          raw = form.toString();
        } else raw = JSON.stringify(req.body);
      } else {
        const chunks: Buffer[] = [];
        let length = 0;
        for await (const chunk of req) {
          const buffer = Buffer.from(chunk);
          length += buffer.length;
          if (length > 512000) throw new ServiceError(413, "request_too_large");
          chunks.push(buffer);
        }
        raw = Buffer.concat(chunks).toString("utf8");
      }
      if (Buffer.byteLength(raw || "") > 512000)
        throw new ServiceError(413, "request_too_large");
    }
    const response = await handle(
      new Request(url, { method, headers: requestHeaders, body: raw }),
      database(),
      c,
    );
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (
      url.pathname.startsWith("/api/media/") &&
      response.body &&
      response.ok
    ) {
      const reader = response.body.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (res.destroyed) break;
          if (!res.write(Buffer.from(value))) await once(res, "drain");
        }
        res.end();
      } finally {
        await reader.cancel().catch(() => {});
      }
    } else res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    if (res.headersSent) {
      res.destroy(error instanceof Error ? error : undefined);
      return;
    }
    res.statusCode = error instanceof ServiceError ? error.status : 503;
    res.setHeader("content-type", "application/json");
    res.setHeader("cache-control", "no-store");
    res.end(
      JSON.stringify({
        error:
          error instanceof ServiceError
            ? error.code
            : "temporarily_unavailable",
        retryable: true,
      }),
    );
  }
}
