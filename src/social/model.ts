import { z } from "zod";
export const X_SCOPES = [
  "bookmark.read",
  "tweet.read",
  "users.read",
  "offline.access",
] as const;
export const xPageSchema = z.object({
  data: z
    .array(
      z.object({
        id: z.string().regex(/^\d+$/),
        text: z.string().max(30000),
        created_at: z.string().datetime().optional(),
        author_id: z.string().optional(),
        note_post: z.object({ text: z.string().max(100000) }).optional(),
        note_tweet: z.object({ text: z.string().max(100000) }).optional(),
      }),
    )
    .max(100)
    .optional(),
  meta: z
    .object({ next_token: z.string().min(1).max(3000).optional() })
    .optional(),
  errors: z.array(z.unknown()).optional(),
});
export function xPostId(value?: string) {
  if (!value) return null;
  try {
    const u = new URL(value);
    return ["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(
      u.hostname,
    ) && u.protocol === "https:"
      ? (u.pathname.match(/^\/(?:\w+|i\/web)\/status\/(\d+)\/?$/)?.[1] ?? null)
      : null;
  } catch {
    return null;
  }
}
export type XStatus = {
  permissions?: string[];
  requestedPermissions?: string[];
  error?: string | null;
  configured: boolean;
  connected: boolean;
  username: string;
  enabled: boolean;
  lastSyncAt: string | null;
  retryAt: number;
  catchingUp: boolean;
  importedCount: number;
  manualImportLimit: number;
  importAllowed: boolean;
  callback: string;
  blocker?: string;
};

export type ConnectionState =
  | "not_configured"
  | "ready"
  | "consent_required"
  | "verification_required"
  | "connected"
  | "expired"
  | "error";
export type ConnectionStatus = {
  state?: ConnectionState;
  configured: boolean;
  connected: boolean;
  hasAccount?: boolean;
  username?: string;
  permissions?: string[];
  lastSyncAt?: string | null;
  lastImportAt?: string | null;
  diagnosticId?: string | null;
  error?: string | null;
  catchingUp?: boolean;
  importedCount?: number;
  manualImportLimit?: number;
  importAllowed?: boolean;
};
export const CONNECTION_LABELS: Record<ConnectionState, string> = {
  not_configured: "non configuré",
  ready: "prêt à connecter",
  consent_required: "consentement requis",
  verification_required: "échange à vérifier",
  connected: "connecté",
  expired: "accès expiré",
  error: "erreur",
};
