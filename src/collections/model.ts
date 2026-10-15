import { z } from "zod";
export const collectionSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(80),
    referenceIds: z
      .array(z.string().uuid())
      .max(2000)
      .refine((ids) => new Set(ids).size === ids.length),
    createdAt: z.string().datetime(),
    origin: z.enum(["human", "grok-approved", "ai-approved"]).optional(),
    approvedAt: z.string().datetime().optional(),
    aiProvenance: z
      .object({
        provider: z.string().max(80),
        model: z.string().max(200),
        generatedAt: z.string().datetime(),
      })
      .strict()
      .optional(),
    rationale: z.string().max(2000).optional(),
    sources: z
      .array(
        z
          .object({
            referenceId: z.string().uuid(),
            quote: z.string().min(1).max(1500),
          })
          .strict(),
      )
      .max(40)
      .optional(),
  })
  .strict();
export const collectionsSchema = z
  .object({
    version: z.literal(1),
    revision: z.number().int().nonnegative(),
    groups: z
      .array(collectionSchema)
      .max(100)
      .refine(
        (groups) => new Set(groups.map((g) => g.id)).size === groups.length,
      ),
  })
  .strict();
export type Collections = z.infer<typeof collectionsSchema>;
export const emptyCollections = (): Collections => ({
  version: 1,
  revision: 0,
  groups: [],
});
export const COLLECTIONS_KEY = "ad.saver.collections.v1";
export const proposalsSchema = z
  .object({
    groups: z
      .array(
        collectionSchema.pick({
          name: true,
          referenceIds: true,
          rationale: true,
          sources: true,
        }),
      )
      .min(1)
      .max(20),
  })
  .strict();
export function validateProposals(
  input: unknown,
  knownIds: Set<string>,
  existingNames: string[],
  sourceTexts?: Map<string, string>,
) {
  const parsed = proposalsSchema.parse(input);
  const names = new Set(existingNames.map((n) => n.toLocaleLowerCase()));
  for (const group of parsed.groups) {
    if (names.has(group.name.toLocaleLowerCase()))
      throw Error("Un groupe de ce nom existe déjà. Renommez la proposition.");
    names.add(group.name.toLocaleLowerCase());
    if (
      group.sources?.some(
        (source) =>
          !group.referenceIds.includes(source.referenceId) ||
          !sourceTexts?.get(source.referenceId)?.includes(source.quote),
      )
    )
      throw Error(
        "Une citation du groupe ne correspond pas aux sources disponibles.",
      );
    if (group.referenceIds.some((id) => !knownIds.has(id)))
      throw Error(
        "La proposition contient une référence inconnue ou non accessible.",
      );
  }
  return parsed.groups;
}
