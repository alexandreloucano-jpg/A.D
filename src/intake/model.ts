import { z } from "zod";
import { safeUrl } from "../domain.js";
export const intakeItemSchema = z
  .object({
    title: z.string().trim().max(10000).default(""),
    text: z.string().max(10000).default(""),
    url: safeUrl,
    author: z.string().trim().max(200).optional(),
    publishedAt: z.string().datetime().optional(),
    sourceDate: z.string().max(100).optional(),
    images: z.array(safeUrl).max(8).default([]),
    videos: z.array(safeUrl).max(4).default([]),
    originalText: z.string().max(200000).optional(),
    notes: z.array(z.string().trim().min(1).max(2000)).max(10).default([]),
    tags: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  })
  .strict();
export type IntakeItem = z.infer<typeof intakeItemSchema>;
export function canonicalSource(value: string): string {
  const parsed = safeUrl.parse(value),
    u = new URL(parsed);
  for (const key of u.searchParams.keys())
    if (
      /^(access_token|refresh_token|id_token|authorization|api_key|client_secret|password|session|auth)$/i.test(
        key,
      )
    )
      throw Error(
        "Ce lien contient un paramètre sensible. Utilisez le lien de partage de la publication.",
      );
  if (
    [
      "x.com",
      "www.x.com",
      "twitter.com",
      "www.twitter.com",
      "mobile.twitter.com",
    ].includes(u.hostname)
  ) {
    const post = u.pathname.match(
      /^\/(?:[\w]+|i\/web)\/status\/(\d+)(?:\/.*)?$/,
    );
    if (post) return "https://x.com/i/web/status/" + post[1];
  }
  if (["instagram.com", "www.instagram.com"].includes(u.hostname)) {
    const post = u.pathname.match(/^\/(p|reel|tv)\/([\w-]+)\/?$/);
    if (post)
      return "https://www.instagram.com/" + post[1] + "/" + post[2] + "/";
  }
  for (const key of [...u.searchParams.keys()])
    if (/^utm_|^(fbclid|igsh|igshid|gclid)$/i.test(key))
      u.searchParams.delete(key);
  u.hash = "";
  u.searchParams.sort();
  return u.href;
}
export function publicImage(value: string): boolean {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(
        u.hostname,
      ) &&
      !u.hostname.includes(":") &&
      !/[?&](access_token|token|key|secret|auth)=/i.test(u.search)
    );
  } catch {
    return false;
  }
}
export function normalizeIntake(raw: unknown): IntakeItem {
  const row = intakeItemSchema.parse(raw);
  row.url = canonicalSource(row.url);
  row.title = row.title || row.text.slice(0, 100) || new URL(row.url).hostname;
  row.images = row.images.filter(publicImage);
  row.videos = row.videos.filter(publicImage);
  return row;
}
export function uniqueIntake(rows: unknown[]): {
  items: IntakeItem[];
  duplicates: number;
} {
  if (rows.length > 2000)
    throw Error("Import limité à 2 000 références par fichier.");
  const byUrl = new Map<string, IntakeItem>();
  let duplicates = 0;
  for (const raw of rows) {
    const row = normalizeIntake(raw),
      existing = byUrl.get(row.url);
    if (existing) {
      duplicates++;
      existing.videos = [...new Set([...existing.videos, ...row.videos])].slice(
        0,
        4,
      );
      const notes = [...new Set([...existing.notes, ...row.notes])];
      if (notes.length > 10)
        throw Error(
          "Plus de dix notes pour une même référence : scindez le fichier pour conserver toutes les notes.",
        );
      existing.notes = notes;
      existing.tags = [...new Set([...existing.tags, ...row.tags])].slice(
        0,
        30,
      );
      existing.images = [...new Set([...existing.images, ...row.images])].slice(
        0,
        8,
      );
    } else byUrl.set(row.url, row);
  }
  return { items: [...byUrl.values()], duplicates };
}
