import { z } from "zod";

const uuid = z.string().uuid();
const written = (max: number) => z.string().trim().max(max);
export const creativeDirectionSchema = z.object({
  letter: z.enum(["A", "B"]),
  title: written(100),
  thesis: written(1800),
  visualGrammar: written(1800),
  production: written(1800),
}).strict();
export const creativeRevisionSchema = z.object({
  id: uuid,
  number: z.number().int().min(1),
  createdAt: z.string().datetime(),
  brief: written(3000),
  referenceIds: z.array(uuid).max(12),
  unknowns: z.array(z.string().max(350)).max(6).default([]),
  directions: z.tuple([creativeDirectionSchema, creativeDirectionSchema]),
  origin: z.enum(["HUMAN", "STRUCTURED_TEMPLATE", "CONFIGURED_AI"]),
  approvedDirection: z.enum(["A", "B"]).nullable(),
  approvedAt: z.string().datetime().nullable(),
  aiProvenance: z.object({
    provider: z.string().min(1).max(60),
    model: z.string().min(1).max(120),
    generatedAt: z.string().datetime(),
  }).strict().optional(),
}).strict().superRefine((value, ctx) => {
  if (value.directions[0].letter !== "A" || value.directions[1].letter !== "B")
    ctx.addIssue({code:"custom",message:"Les pistes A et B doivent rester distinctes."});
  if (new Set(value.referenceIds).size !== value.referenceIds.length)
    ctx.addIssue({code:"custom",message:"Une source ne peut être reliée deux fois."});
  if (value.approvedDirection && !value.approvedAt)
    ctx.addIssue({code:"custom",message:"La validation exige une date."});
  if (!value.approvedDirection && value.approvedAt)
    ctx.addIssue({code:"custom",message:"Une date de validation exige une piste approuvée."});
  if (value.origin === "CONFIGURED_AI" && !value.aiProvenance)
    ctx.addIssue({code:"custom",message:"L'origine IA doit conserver la provenance."});
});
export const creativeBoardSchema = z.object({
  id: uuid,
  projectId: uuid,
  revisions: z.array(creativeRevisionSchema).min(1).max(60),
}).strict().superRefine((board, ctx) => {
  if (board.revisions.some((revision, i) => revision.number !== i + 1))
    ctx.addIssue({code:"custom",message:"Historique de versions discontinu."});
});
export type CreativeDirection = z.infer<typeof creativeDirectionSchema>;
export type CreativeRevision = z.infer<typeof creativeRevisionSchema>;
export type CreativeBoard = z.infer<typeof creativeBoardSchema>;

export function blankDirections(): [CreativeDirection, CreativeDirection] {
  return [
    {letter:"A",title:"",thesis:"",visualGrammar:"",production:""},
    {letter:"B",title:"",thesis:"",visualGrammar:"",production:""},
  ];
}

/** Offline structured starting point, NEVER represented as an AI generation. */
export function creativeStartingPoints(brief: string, referenceTitles: string[]) {
  const context = brief.trim().slice(0, 400);
  const sources = referenceTitles.slice(0, 3).join(" · ");
  return creativeDirectionSchema.array().length(2).parse([
    {
      letter:"A",title:"Origine / Le territoire",
      thesis:"Hypothèse à affiner : partir de ce qui rend cette maison singulière. " + context,
      visualGrammar:"Identifier une lumière, une matière et un vocabulaire visuel originaux. Références à examiner : " + (sources || "aucune sélectionnée"),
      production:"Préciser les lieux, talents, droits et coûts. Aucun devis fournisseur vérifié.",
    },
    {
      letter:"B",title:"Signature / L'icône",
      thesis:"Hypothèse alternative : organiser le récit autour du produit ou geste le plus reconnaissable. " + context,
      visualGrammar:"Construire un traitement distinct de A : compositions, casting et rythme centrés sur un objet signature. Références à interpréter : " + (sources || "aucune sélectionnée"),
      production:"Définir les images indispensables, les formats et les autorisations. Production non budgétée.",
    },
  ]) as [CreativeDirection,CreativeDirection];
}
export function nextCreativeRevision(
  board: CreativeBoard | undefined,
  projectId: string,
  input: Pick<CreativeRevision,"brief"|"referenceIds"|"directions"|"origin"|"aiProvenance"> & { unknowns?: string[] },
  approvedDirection: "A"|"B"|null = null,
): CreativeBoard {
  const now = new Date().toISOString();
  const revision = creativeRevisionSchema.parse({
    ...input,
    id: crypto.randomUUID(),
    number: (board?.revisions.length ?? 0) + 1,
    createdAt:now,
    approvedDirection,
    approvedAt:approvedDirection ? now : null,
  });
  return creativeBoardSchema.parse({
    id:board?.id??crypto.randomUUID(),
    projectId,
    revisions:[...(board?.revisions??[]),revision],
  });
}
export function latestCreative(board: CreativeBoard | undefined) {
  return board?.revisions.at(-1);
}
export const creativeAIResponse = z.object({
  directions:z.tuple([creativeDirectionSchema,creativeDirectionSchema]),
  unknowns:z.array(z.string().max(350)).max(6),
  provenance:z.object({
    provider:z.string().min(1),
    model:z.string().min(1),
    generatedAt:z.string().datetime(),
  }).strict(),
  requiresApproval:z.literal(true),
}).strict();
