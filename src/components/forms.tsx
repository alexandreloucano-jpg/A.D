import { ArrowUpRight, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { safeUrl, type Workspace } from "../domain";
import { Field } from "./ui";
function useDraft(key: string, initialValue = "") {
  const [value, set] = useState(() => {
    try {
      return sessionStorage.getItem(key) || initialValue;
    } catch {
      return initialValue;
    }
  });
  function update(next: string) {
    set(next);
    try {
      sessionStorage.setItem(key, next);
    } catch {
      /* In-memory draft remains available. */
    }
  }
  return [value, update] as const;
}
export function CaptureForm({
  data,
  defaultProjectId,
  sourceContext,
  error,
  save,
  remote = false,
}: {
  remote?: boolean;
  data: Workspace;
  defaultProjectId?: string;
  sourceContext?: { url: string; title: string } | null;
  error: string;
  save: (input: {
    title: string;
    content: string;
    url?: string;
    origin: "human" | "grok";
    projectId?: string;
  }) => boolean | Promise<boolean>;
}) {
  const [title, setTitle] = useDraft("ad.draft.title", sourceContext?.title);
  const [content, setContent] = useDraft("ad.draft.content");
  const [url, setUrl] = useDraft("ad.draft.url", sourceContext?.url);
  const [origin, setOrigin] = useDraft("ad.draft.origin");
  const [projectId, setProjectId] = useDraft(
    "ad.draft.project",
    defaultProjectId,
  );
  const [localError, setLocalError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (url && !safeUrl.safeParse(url.trim()).success) {
      setLocalError("Utilisez un lien HTTP(S) sans identifiants.");
      return;
    }
    if (!title.trim() && !content.trim() && !url.trim()) {
      setLocalError("Ajoutez un lien ou une pensée.");
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      if (
        await save({
          title:
            title.trim() ||
            content.trim().slice(0, 90) ||
            new URL(url).hostname,
          content: content.trim(),
          url: url.trim() || undefined,
          origin: origin === "grok" ? "grok" : "human",
          projectId: projectId || undefined,
        })
      ) {
        setTitle("");
        setContent("");
        setUrl("");
        setOrigin("");
        setProjectId("");
      }
    } catch {
      setLocalError("Enregistrement interrompu. Le brouillon est conservé.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <p className="form-intro">
        Un lien ou quelques mots. Aucun classement imposé.
      </p>
      {sourceContext && (
        <p className="source-context">
          Piste à examiner pour « {sourceContext.title} ». Aucun NOW ne sera
          créé. Un éventuel brouillon existant est conservé.
        </p>
      )}
      <Field label="Lien source (facultatif)">
        <input
          type="url"
          required={origin === "grok"}
          value={url}
          maxLength={4096}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          autoFocus
        />
      </Field>
      <Field label="Titre (facultatif)">
        <input
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ce que vous souhaitez retenir"
        />
      </Field>
      <Field label="Votre pensée ou votre note">
        <textarea
          value={content}
          maxLength={10000}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          placeholder="Une idée à garder…"
        />
      </Field>
      <details>
        <summary>Provenance et projet</summary>
        <Field label="Provenance">
          <select
            value={origin || "human"}
            onChange={(e) => setOrigin(e.target.value)}
          >
            <option value="human">Capture personnelle</option>
            <option value="grok">Proposition Grok · ajout manuel</option>
          </select>
        </Field>
        <Field label="Associer à un projet">
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">Sans projet</option>
            {data.projects.map((p) => (
              <option value={p.id} key={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </Field>
      </details>
      {origin === "grok" && (
        <label className="check-field">
          <input type="checkbox" required />
          J’ai vérifié la source et j’autorise cette sauvegarde. Aucune tâche ne
          sera créée.
        </label>
      )}
      {(error || localError) && (
        <p role="alert" className="form-error">
          {error || localError}
        </p>
      )}
      <div className="form-footer">
        <span>
          {remote
            ? "Sauvegarde serveur avec relecture."
            : "Sauvegarde locale, sans analyse automatique."}
        </span>
        <button className="primary" type="submit" disabled={busy}>
          {origin === "grok" ? "Valider et sauvegarder" : "Sauvegarder"}
          <ArrowUpRight size={17} />
        </button>
      </div>
    </form>
  );
}
export function ProjectForm({
  error,
  save,
}: {
  error: string;
  save: (title: string) => boolean;
}) {
  const [title, setTitle] = useDraft("ad.draft.projectTitle");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (save(title.trim())) setTitle("");
      }}
    >
      <Field label="Nom du projet">
        <input
          autoFocus
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Une direction à explorer"
          pattern=".*\S.*"
        />
      </Field>
      <p className="muted">
        Un dossier vide, sans tâche ni priorité créée automatiquement.
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button className="primary" type="submit">
        Créer le projet
        <Plus size={17} />
      </button>
    </form>
  );
}
export function TaskForm({
  add,
  projectId,
}: {
  add: (title: string) => boolean;
  projectId: string;
}) {
  const [title, setTitle] = useDraft("ad.task." + projectId);
  return (
    <form
      className="task-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim() && add(title.trim())) setTitle("");
      }}
    >
      <input
        aria-label="Nouvelle suggestion"
        required
        maxLength={200}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Une idée à examiner…"
      />
      <button type="submit">
        <Plus size={17} />
        Ajouter à LATER
      </button>
    </form>
  );
}
export function SignalForm({
  error,
  save,
}: {
  error: string;
  save: (s: Workspace["signals"][number]) => boolean;
}) {
  const [brand, setBrand] = useDraft("ad.signal.brand");
  const [fact, setFact] = useDraft("ad.signal.fact");
  const [url, setUrl] = useDraft("ad.signal.url");
  const [date, setDate] = useDraft("ad.signal.date");
  const [inference, setInference] = useDraft("ad.signal.inference");
  const [localError, setLocalError] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!safeUrl.safeParse(url).success) {
          setLocalError(
            "La source doit être un lien HTTP(S) sans identifiants.",
          );
          return;
        }
        if (
          save({
            id: crypto.randomUUID(),
            brand: brand.trim(),
            observedFact: fact.trim(),
            sourceUrl: url,
            occurredAt: date,
            collectedAt: new Date().toISOString(),
            inference: inference.trim(),
          })
        ) {
          setBrand("");
          setFact("");
          setUrl("");
          setDate("");
          setInference("");
        }
      }}
    >
      <Field label="Marque ou sujet">
        <input
          autoFocus
          required
          maxLength={200}
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
        />
      </Field>
      <Field label="Fait observé">
        <textarea
          required
          maxLength={10000}
          value={fact}
          onChange={(e) => setFact(e.target.value)}
          rows={3}
        />
      </Field>
      <Field label="Lien de la source">
        <input
          type="url"
          required
          maxLength={4096}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </Field>
      <Field label="Date du fait">
        <input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </Field>
      <Field label="Interprétation (facultative, distincte du fait)">
        <textarea
          rows={2}
          maxLength={10000}
          value={inference}
          onChange={(e) => setInference(e.target.value)}
        />
      </Field>
      {(error || localError) && (
        <p className="form-error" role="alert">
          {error || localError}
        </p>
      )}
      <button type="submit" className="primary">
        Conserver ce signal
        <Plus size={17} />
      </button>
    </form>
  );
}
