import { z } from "zod";
import { creativeBoardSchema } from "./creative/model";
const text = z.string().trim().min(1).max(10000);
export const safeUrl = z
  .string()
  .url()
  .max(4096)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        ["https:", "http:"].includes(url.protocol) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }, "Utilisez un lien HTTP(S) sans identifiants.");
const date = z.string().datetime();
const id = z.string().uuid();
export const referenceSchema = z
  .object({
    id,
    title: text,
    content: z.string().max(10000),
    url: safeUrl.optional(),
    capturedAt: date,
    revision: z.number().int().positive(),
    origin: z.enum(["human", "grok"]),
    approvedAt: date,
    isInternalQA: z.boolean(),
    projectId: id.optional(),
  })
  .strict()
  .refine(
    (r) => r.origin !== "grok" || !!r.url,
    "Une proposition Grok doit conserver une URL source.",
  );
const projectSchema = z.object({ id, title: text, updatedAt: date }).strict();
const taskSchema = z
  .object({
    id,
    projectId: id,
    title: text,
    lane: z.enum(["NOW", "LATER", "KILL"]),
    origin: z.enum(["human", "ai"]),
    acceptedAt: date.optional(),
    updatedAt: date,
  })
  .strict()
  .refine(
    (t) => t.lane !== "NOW" || !!t.acceptedAt,
    "Une action NOW exige une acceptation humaine.",
  );
const signalSchema = z
  .object({
    id,
    brand: text,
    observedFact: text,
    sourceUrl: safeUrl,
    occurredAt: z.iso.date(),
    collectedAt: date,
    inference: z.string().max(10000),
  })
  .strict();
export const workspaceSchema = z
  .object({
    version: z.literal(1),
    revision: z.number().int().nonnegative(),
    references: z.array(referenceSchema).max(10000),
    projects: z.array(projectSchema).max(1000),
    tasks: z.array(taskSchema).max(10000),
    signals: z.array(signalSchema).max(10000),
    creativeBoards: z.array(creativeBoardSchema).max(1000).optional(),
  })
  .strict()
  .superRefine((s, ctx) => {
    const ids = [...s.references, ...s.projects, ...s.tasks, ...s.signals, ...(s.creativeBoards || [])].map(
      (x) => x.id,
    );
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({ code: "custom", message: "Identifiants dupliqués." });
    const projects = new Set(s.projects.map((p) => p.id));
    if (
      s.creativeBoards?.some((board) => !projects.has(board.projectId)) ||
      new Set((s.creativeBoards || []).map((board) => board.projectId)).size !== (s.creativeBoards || []).length
    ) ctx.addIssue({ code: "custom", message: "Dossier créatif associé introuvable ou dupliqué." });
    if (
      s.tasks.some((t) => !projects.has(t.projectId)) ||
      s.references.some((r) => r.projectId && !projects.has(r.projectId))
    )
      ctx.addIssue({ code: "custom", message: "Projet associé introuvable." });
  });
export type Workspace = z.infer<typeof workspaceSchema>;
export type Reference = z.infer<typeof referenceSchema>;
export type Task = Workspace["tasks"][number];
export const emptyWorkspace = (): Workspace => ({
  version: 1,
  revision: 0,
  references: [],
  projects: [],
  tasks: [],
  signals: [],
  creativeBoards: [],
});
export function newTask(
  projectId: string,
  title: string,
  origin: "human" | "ai" = "human",
): Task {
  return {
    id: crypto.randomUUID(),
    projectId,
    title,
    lane: "LATER",
    origin,
    updatedAt: new Date().toISOString(),
  };
}
export function transitionTask(
  task: Task,
  action: "accept" | "archive" | "restore",
  humanApproval: boolean,
): Task {
  if (!humanApproval)
    throw new Error("Une décision humaine explicite est nécessaire.");
  if (action === "accept" && task.lane !== "LATER")
    throw new Error("Seule une suggestion à examiner peut être acceptée.");
  if (action === "restore" && task.lane !== "KILL")
    throw new Error("Cette action n’est pas archivée.");
  const now = new Date().toISOString();
  return {
    ...task,
    lane: action === "accept" ? "NOW" : action === "archive" ? "KILL" : "LATER",
    acceptedAt: action === "accept" ? now : undefined,
    updatedAt: now,
  };
}
export const activeTasks = (s: Workspace) =>
  s.tasks.filter((t) => t.lane === "NOW");
export const rediscover = (s: Workspace) =>
  s.references.filter((r) => !r.isInternalQA);
export function makeReference(
  input: {
    title: string;
    content: string;
    url?: string;
    origin: "human" | "grok";
    projectId?: string;
  },
  ownerApproved: boolean,
): Reference {
  if (!ownerApproved)
    throw new Error("Validez la source avant de sauvegarder.");
  const now = new Date().toISOString();
  return referenceSchema.parse({
    ...input,
    id: crypto.randomUUID(),
    capturedAt: now,
    approvedAt: now,
    revision: 1,
    isInternalQA: false,
  });
}
export const SCOUT_TOOLS = [
  "get_saved_inspiration",
  "get_saver_capture",
  "save_inspiration_reference",
  "save_reference_batch",
] as const;
// Policy specification only: no network transport or authenticated gateway is connected.
export function scoutRequestAllowed(
  tool: string,
  audience: string,
  batchSize?: number,
): boolean {
  return (
    audience === "ad-saver-scout" &&
    (SCOUT_TOOLS as readonly string[]).includes(tool) &&
    (tool !== "save_reference_batch" ||
      (Number.isInteger(batchSize) && batchSize! >= 1 && batchSize! <= 20))
  );
}
