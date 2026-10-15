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
  callback: string;
  blocker?: string;
};
