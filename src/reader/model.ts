import { z } from "zod";
export const versionSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const documentSchema = z
  .object({
    referenceId: z.string().uuid(),
    version: versionSchema,
    text: z.string().max(200000),
    kind: z.enum(["text", "image", "pdf", "unavailable"]),
    provenance: z.enum(["capture", "manual", "extraction"]),
    publishedAt: z.string().datetime().nullable(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export const anchorSchema = z
  .object({
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
    exact: z.string().min(1).max(10000),
    prefix: z.string().max(64),
    suffix: z.string().max(64),
  })
  .strict();
export const annotationInput = z
  .object({
    id: z.string().uuid(),
    contentVersion: versionSchema,
    kind: z.enum(["highlight", "note"]),
    anchor: anchorSchema,
    note: z.string().max(5000),
  })
  .strict();
export const annotationSchema = annotationInput.extend({
  referenceId: z.string().uuid(),
  revision: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ReaderDocument = z.infer<typeof documentSchema>;
export type Anchor = z.infer<typeof anchorSchema>;
export type Annotation = z.infer<typeof annotationSchema>;
export function anchorFor(text: string, start: number, end: number): Anchor {
  return {
    start,
    end,
    exact: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - 64), start),
    suffix: text.slice(end, end + 64),
  };
}
export function anchorMatches(text: string, a: Anchor) {
  return (
    a.end > a.start &&
    a.end <= text.length &&
    JSON.stringify(anchorFor(text, a.start, a.end)) === JSON.stringify(a)
  );
}
export function paragraphs(text: string) {
  let offset = 0;
  return text.split(/(\n\s*\n)/).map((value) => {
    const block = {
      id: "p-" + offset,
      start: offset,
      end: offset + value.length,
      text: value,
      separator: /^\s*$/.test(value),
    };
    offset += value.length;
    return block;
  });
}
