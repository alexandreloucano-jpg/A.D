import { describe, it, expect } from "vitest";
import {
  activeTasks,
  emptyWorkspace,
  makeReference,
  newTask,
  rediscover,
  scoutRequestAllowed,
  safeUrl,
  transitionTask,
  workspaceSchema,
} from "../src/domain";
import {
  WorkspaceRepository,
  parseBackup,
  exportBackup,
  STORAGE_KEY,
  type StoragePort,
} from "../src/storage";
const projectId = "6d2742bd-99cf-492a-b8ab-e1fdb6679e46";
function memory() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
  };
}
function reference() {
  return makeReference(
    {
      title: "Reference de test",
      content: "Note de test",
      url: "https://example.org/reference",
      origin: "human",
    },
    true,
  );
}
describe("Autorité humaine", () => {
  it("garde les idées humaines et IA dans LATER", () => {
    expect(newTask(projectId, "Test").lane).toBe("LATER");
    expect(newTask(projectId, "Test", "ai").lane).toBe("LATER");
  });
  it("exige un geste humain et interdit les transitions implicites", () => {
    const t = newTask(projectId, "Test", "ai");
    expect(() => transitionTask(t, "accept", false)).toThrow();
    const accepted = transitionTask(t, "accept", true);
    expect(accepted.lane).toBe("NOW");
    expect(accepted.acceptedAt).toBeTruthy();
    expect(() => transitionTask(accepted, "accept", true)).toThrow();
  });
  it("exclut KILL de NOW et restaure uniquement dans LATER", () => {
    const accepted = transitionTask(newTask(projectId, "Test"), "accept", true);
    const killed = transitionTask(accepted, "archive", true);
    const s = emptyWorkspace();
    s.tasks = [killed];
    expect(activeTasks(s)).toEqual([]);
    expect(() => transitionTask(killed, "accept", true)).toThrow();
    const restored = transitionTask(killed, "restore", true);
    expect(restored.lane).toBe("LATER");
    expect(restored.acceptedAt).toBeUndefined();
  });
  it("refuse un import NOW sans acceptation et les références orphelines", () => {
    const s = emptyWorkspace();
    s.tasks = [{ ...newTask(projectId, "Test"), lane: "NOW" }];
    expect(() => workspaceSchema.parse(s)).toThrow();
  });
});
describe("Saver", () => {
  it("requiert la validation et refuse les URL exécutables ou identifiants", () => {
    expect(() =>
      makeReference({ title: "t", content: "", origin: "grok" }, false),
    ).toThrow();
    for (const url of [
      "javascript:alert(1)",
      "https://user:password@example.org",
    ])
      expect(() =>
        makeReference({ title: "t", content: "", origin: "human", url }, true),
      ).toThrow();
  });
  it("écarte les captures QA sans les effacer", () => {
    const s = emptyWorkspace();
    s.references = [reference(), { ...reference(), isInternalQA: true }];
    expect(rediscover(s)).toHaveLength(1);
    expect(s.references).toHaveLength(2);
  });
});
describe("Persistance et récupération", () => {
  it("confirme seulement après écriture et relecture avec ID identique", () => {
    const storage = memory();
    const repo = new WorkspaceRepository(storage);
    const s = repo.read();
    s.references.push(reference());
    const saved = repo.commit(s);
    const reread = new WorkspaceRepository(storage).read();
    expect(reread.references[0].id).toBe(saved.references[0].id);
    expect(reread.revision).toBe(1);
  });
  it("n’écrase pas une sauvegarde corrompue", () => {
    const storage = memory();
    storage.setItem(STORAGE_KEY, "broken");
    const repo = new WorkspaceRepository(storage);
    expect(() => repo.read()).toThrow();
    expect(storage.getItem(STORAGE_KEY)).toBe("broken");
  });
  it("propage les erreurs de quota et laisse la saisie disponible au caller", () => {
    const draft = reference();
    const storage: StoragePort = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceeded");
      },
    };
    const repo = new WorkspaceRepository(storage);
    const s = repo.read();
    expect(() => repo.commit({ ...s, references: [draft] })).toThrow(
      "QuotaExceeded",
    );
    expect(draft.content).toBe("Note de test");
  });
  it("refuse une confirmation si relecture incohérente", () => {
    const storage: StoragePort = { getItem: () => null, setItem: () => {} };
    const repo = new WorkspaceRepository(storage);
    repo.read();
    expect(() => repo.commit(emptyWorkspace())).toThrow("relecture");
  });
  it("empêche une écriture perdue depuis un onglet obsolète", () => {
    const storage = memory();
    const a = new WorkspaceRepository(storage),
      b = new WorkspaceRepository(storage);
    const sa = a.read(),
      sb = b.read();
    a.commit({ ...sa, references: [reference()] });
    expect(() => b.commit(sb)).toThrow("autre onglet");
    expect(a.read().references).toHaveLength(1);
  });
  it("exporte et importe sans changement des IDs et refuse les doublons", () => {
    const s = emptyWorkspace();
    s.references = [reference()];
    expect(parseBackup(exportBackup(s))).toEqual(s);
    s.references.push(s.references[0]);
    expect(() => parseBackup(JSON.stringify(s))).toThrow();
  });
});
describe("Spécification de politique Scout (pas un serveur connecté)", () => {
  it("refuse audiences globales et outils hors allowlist", () => {
    expect(scoutRequestAllowed("get_saver_capture", "global")).toBe(false);
    for (const tool of [
      "get_sandro_context",
      "update_founder_brief",
      "configure_operating_schedule",
      "capture_sandro_idea",
      "save_venture_thesis",
      "tools/call",
    ])
      expect(scoutRequestAllowed(tool, "ad-saver-scout")).toBe(false);
  });
  it("borne les lots à 1–20", () => {
    for (const n of [undefined, 0, 21, -1, 1.5])
      expect(
        scoutRequestAllowed("save_reference_batch", "ad-saver-scout", n),
      ).toBe(false);
    for (const n of [1, 20])
      expect(
        scoutRequestAllowed("save_reference_batch", "ad-saver-scout", n),
      ).toBe(true);
  });
});

it("refuse une proposition Grok sans source vérifiable", () => {
  expect(() =>
    makeReference(
      { title: "Sans source", content: "Note", origin: "grok" },
      true,
    ),
  ).toThrow();
});

it("valide sans exception les liens malformés", () => {
  expect(safeUrl.safeParse("invalide").success).toBe(false);
});
