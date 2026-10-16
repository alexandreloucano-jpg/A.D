import { z } from "zod";
export const MCP_MODERN_VERSION = "2026-07-28";
export const MCP_LEGACY_VERSIONS = [
  "2025-11-25",
  "2025-06-18",
  "2025-03-26",
] as const;
export const MCP_SUPPORTED_VERSIONS = [
  MCP_MODERN_VERSION,
  ...MCP_LEGACY_VERSIONS,
];
export const MCP_SERVER_INFO = { name: "ad-saver-scout", version: "1.1.0" };
type Failure = {
  code: number;
  message: string;
  data?: Record<string, unknown>;
};
type Protocol = {
  modern: boolean;
  version: string;
  params: unknown;
  failure?: Failure;
};
const object = z.record(z.string(), z.unknown());
function decodedName(header: string | null) {
  if (!header || /[^\x20-\x7e]/.test(header)) return null;
  if (!header.startsWith("=?base64?")) return header;
  const encoded = header.slice(9);
  if (
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      encoded,
    )
  )
    return null;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(
      Buffer.from(encoded, "base64"),
    );
  } catch {
    return null;
  }
}
export function mcpProtocol(
  r: Request,
  method: string,
  params: unknown,
): Protocol {
  const p = object.safeParse(params),
    metadata = p.success ? object.safeParse(p.data._meta) : null;
  const meta = metadata?.success ? metadata.data : null;
  const bodyVersion = meta?.["io.modelcontextprotocol/protocolVersion"];
  const header = r.headers.get("mcp-protocol-version");
  const modern =
    method === "server/discover" ||
    (typeof bodyVersion === "string" &&
      !MCP_LEGACY_VERSIONS.includes(
        bodyVersion as (typeof MCP_LEGACY_VERSIONS)[number],
      )) ||
    (!!header &&
      !MCP_LEGACY_VERSIONS.includes(
        header as (typeof MCP_LEGACY_VERSIONS)[number],
      ));
  const clean = p.success
    ? Object.fromEntries(
        Object.entries(p.data).filter(([key]) => key !== "_meta"),
      )
    : params;
  const state: Protocol = {
    modern,
    version: header || "2025-03-26",
    params: clean,
  };
  if (!modern) return state;
  const fail = (failure: Failure) => ({ ...state, failure });
  if (
    typeof bodyVersion !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(bodyVersion) ||
    !meta ||
    !object.safeParse(meta["io.modelcontextprotocol/clientCapabilities"])
      .success
  )
    return fail({
      code: -32602,
      message: "Required per-request MCP metadata is missing or invalid",
    });
  state.version = bodyVersion;
  if (
    header !== bodyVersion ||
    r.headers.get("mcp-method") !== method ||
    (["tools/call", "prompts/get", "resources/read"].includes(method) &&
      decodedName(r.headers.get("mcp-name")) !==
        (p.success
          ? method === "resources/read"
            ? p.data.uri
            : p.data.name
          : undefined))
  )
    return fail({
      code: -32020,
      message:
        "Required MCP headers are missing or do not match the request body",
    });
  if (bodyVersion !== MCP_MODERN_VERSION)
    return fail({
      code: -32022,
      message: "Unsupported protocol version",
      data: { supported: MCP_SUPPORTED_VERSIONS, requested: bodyVersion },
    });
  return state;
}
// Deliberately excludes identities, tokens, tool arguments and user content.
export function mcpDiscoveryLog(
  method: "initialize" | "server/discover" | "tools/list",
  requested: string,
  selected: string,
  toolCount?: number,
) {
  const date = (s: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "invalid_or_absent";
  console.info(
    JSON.stringify({
      event: "mcp_discovery",
      method,
      requestedVersion: date(requested),
      selectedVersion: date(selected),
      ...(toolCount === undefined ? {} : { toolCount }),
    }),
  );
}
