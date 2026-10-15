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
    const url = new URL(req.url || "/", roleOrigin);
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
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
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
