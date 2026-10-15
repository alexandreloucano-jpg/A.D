import { useEffect, useRef, useState } from "react";
import type { Reference } from "../domain";
import type { RemoteSaver } from "../remote-saver";
import { Modal } from "../components/ui";
import { ReferenceMedia } from "../components/ReferenceMedia";
import { directImageUrl } from "../media";
import {
  anchorFor,
  paragraphs,
  annotationSchema,
  documentSchema,
  type Anchor,
  type Annotation,
  type ReaderDocument,
} from "./model";
type Answer = {
  explicit: string;
  inferences: string;
  unknowns: string;
  citations: { paragraphId: string; quote: string }[];
  provenance?: {
    provider: string;
    model: string;
    generatedAt: string;
    contentVersion: string;
  };
};
export function Reader({
  reference,
  remote,
  persisted,
  close,
  annotationId,
}: {
  reference: Reference;
  remote: RemoteSaver;
  persisted: boolean;
  close: () => void;
  annotationId?: string;
}) {
  const root = useRef<HTMLDivElement>(null),
    pending = useRef<{ key: string; id: string } | null>(null);
  const [doc, setDoc] = useState<ReaderDocument | null>(null),
    [annotations, setAnnotations] = useState<Annotation[]>([]),
    [selection, setSelection] = useState<Anchor | null>(null),
    [note, setNote] = useState(() => {
      try {
        return sessionStorage.getItem("ad.reader.note." + reference.id) || "";
      } catch {
        return "";
      }
    }),
    [question, setQuestion] = useState(""),
    [answer, setAnswer] = useState<Answer | null>(null),
    [manual, setManual] = useState(""),
    [editingText, setEditingText] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [editing, setEditing] = useState<Annotation | null>(null),
    [aiAvailable, setAiAvailable] = useState(false),
    [mediaError, setMediaError] = useState(false);
  const [versions, setVersions] = useState<
    { version: string; updatedAt: string; provenance: string }[]
  >([]);
  const [hasOriginal, setHasOriginal] = useState(false);
  const [taste, setTaste] = useState<{
    humanAnnotations: unknown[];
    aiInterpretations: unknown[];
  } | null>(null);
  const availableText = doc?.text ?? reference.content;
  const version = doc?.version;
  const image = directImageUrl(reference.url),
    pdf = reference.url && /\.pdf$/i.test(new URL(reference.url).pathname);
  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await remote.reader<{
        document: unknown;
        annotations: unknown[];
        aiAvailable: boolean;
        hasOriginal?: boolean;
        versions?: typeof versions;
      }>("/api/reader/" + reference.id);
      const document = documentSchema.parse(data.document);
      setDoc(document);
      setManual(document.text);
      setAnnotations(
        data.annotations.map((row) => annotationSchema.parse(row)),
      );
      setAiAvailable(data.aiAvailable);
      setHasOriginal(!!data.hasOriginal);
      setVersions(data.versions || []);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Lecture serveur interrompue. Réessayez.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (remote.connected && persisted) void load();
  }, [reference.id, remote.connected, persisted]);
  useEffect(() => {
    try {
      sessionStorage.setItem("ad.reader.note." + reference.id, note);
    } catch {
      /* In-memory draft retained. */
    }
  }, [reference.id, note]);
  useEffect(() => {
    const read = () => {
      const native = window.getSelection();
      if (!root.current || !native?.rangeCount || native.isCollapsed) return;
      const range = native.getRangeAt(0);
      if (
        !root.current.contains(range.startContainer) ||
        !root.current.contains(range.endContainer)
      )
        return;
      const before = range.cloneRange();
      before.selectNodeContents(root.current);
      before.setEnd(range.startContainer, range.startOffset);
      const start = before.toString().length,
        end = start + range.toString().length;
      if (
        end > start &&
        end - start <= 10000 &&
        availableText.slice(start, end) === range.toString()
      )
        setSelection(anchorFor(availableText, start, end));
    };
    document.addEventListener("selectionchange", read);
    return () => document.removeEventListener("selectionchange", read);
  }, [availableText]);
  useEffect(() => {
    if (annotationId && annotations.length) {
      const a = annotations.find((row) => row.id === annotationId);
      if (a && a.contentVersion === version) jump(a.anchor.start);
    }
  }, [annotationId, annotations, version]);
  function jump(start: number) {
    const p = paragraphs(availableText).find(
      (row) => row.start <= start && row.end > start,
    );
    if (p)
      document
        .getElementById("reader-" + p.id)
        ?.scrollIntoView({ block: "center", behavior: "auto" });
  }
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Enregistrement interrompu. Le brouillon est conservé.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function save(kind: "highlight" | "note") {
    if (!selection || !version) return;
    const key = JSON.stringify({ kind, selection, version, note });
    if (pending.current?.key !== key)
      pending.current = { key, id: crypto.randomUUID() };
    await run(async () => {
      const result = await remote.reader<{
        annotation: unknown;
        verified: boolean;
      }>("/api/reader/" + reference.id + "/annotations", "POST", {
        id: pending.current!.id,
        contentVersion: version,
        kind,
        anchor: selection,
        note: kind === "note" ? note : "",
      });
      if (!result.verified)
        throw Error(
          "Relecture serveur non confirmée. Le brouillon est conservé.",
        );
      const a = annotationSchema.parse(result.annotation);
      setAnnotations((rows) => [...rows.filter((row) => row.id !== a.id), a]);
      pending.current = null;
      setNotice("Annotation sauvegardée et relue sur le serveur.");
      setNote("");
    });
  }
  function renderText(text: string, start: number) {
    const cuts = new Set([0, text.length]);
    const current = annotations.filter(
      (a) =>
        a.contentVersion === version &&
        a.anchor.start < start + text.length &&
        a.anchor.end > start,
    );
    for (const a of current) {
      cuts.add(Math.max(0, a.anchor.start - start));
      cuts.add(Math.min(text.length, a.anchor.end - start));
    }
    const points = [...cuts].sort((a, b) => a - b);
    return points.slice(0, -1).map((point, i) => {
      const end = points[i + 1],
        highlighted = current.some(
          (a) => a.anchor.start <= start + point && a.anchor.end >= start + end,
        );
      return highlighted ? (
        <mark key={point}>{text.slice(point, end)}</mark>
      ) : (
        text.slice(point, end)
      );
    });
  }
  return (
    <Modal title={reference.title} close={close}>
      <div className="reader-shell">
        <header className="reader-meta">
          <p>
            {reference.origin === "grok"
              ? "Source conservée depuis Grok"
              : "Référence personnelle"}{" "}
            · Enregistrée le{" "}
            {new Date(reference.capturedAt).toLocaleDateString("fr-FR")}
          </p>
          <p>
            Publication :{" "}
            {doc?.publishedAt
              ? new Date(doc.publishedAt).toLocaleDateString("fr-FR")
              : "date non renseignée"}
          </p>
          {reference.url && (
            <a href={reference.url} target="_blank" rel="noreferrer">
              Ouvrir la source originale ↗
            </a>
          )}
          {remote.connected && persisted && doc && reference.url && !image && (
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const result = await remote.reader<{
                    document: unknown;
                    verified: boolean;
                    originalPreserved: boolean;
                  }>("/api/reader/" + reference.id + "/extract", "POST", {
                    expectedVersion: doc.version,
                  });
                  if (!result.verified || !result.originalPreserved)
                    throw Error("Extraction non confirmée.");
                  setDoc(documentSchema.parse(result.document));
                  setSelection(null);
                  setAnswer(null);
                  setNotice(
                    "Texte extrait ; original et versions précédentes conservés.",
                  );
                  await load();
                })
              }
            >
              Extraire le texte de la source autorisée
            </button>
          )}
          {doc && (hasOriginal || doc.provenance === "extraction") && (
            <p>
              Texte extrait depuis la source.{" "}
              <a
                href={
                  "/api/reader/" +
                  reference.id +
                  "/original?version=" +
                  doc.version
                }
              >
                Télécharger l’original conservé
              </a>
            </p>
          )}
          {versions.length > 1 && doc && (
            <label>
              Version du texte
              <select
                aria-label="Version du texte"
                value={doc.version}
                disabled={busy}
                onChange={(e) => {
                  const selected = e.target.value;
                  void run(async () => {
                    const result = await remote.reader<{
                      document: unknown;
                      hasOriginal: boolean;
                    }>("/api/reader/" + reference.id + "/version/" + selected);
                    setDoc(documentSchema.parse(result.document));
                    setHasOriginal(result.hasOriginal);
                    setSelection(null);
                    setAnswer(null);
                    setNotice(
                      "Version conservée ouverte. Rechargez la lecture serveur pour revenir à la version courante.",
                    );
                  });
                }}
              >
                {versions.map((v) => (
                  <option key={v.version} value={v.version}>
                    {new Date(v.updatedAt).toLocaleString("fr-FR")} ·{" "}
                    {v.provenance} · {v.version.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button onClick={close}>Retour à la bibliothèque</button>
        </header>
        {loading && <p role="status">Ouverture du lecteur…</p>}
        {error && (
          <div role="alert">
            <p>{error}</p>
            {remote.connected && persisted && (
              <button onClick={() => void load()}>
                Réessayer la lecture serveur
              </button>
            )}
          </div>
        )}
        {!remote.connected && (
          <p role="status">
            Lecture disponible. Connectez le Saver privé dans les réglages pour
            conserver des annotations côté serveur.
          </p>
        )}
        {remote.connected && !persisted && (
          <div>
            <p>
              Cette référence est locale. Copiez-la dans votre Saver privé pour
              l’annoter.
            </p>
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await remote.save(reference);
                  setNotice("Référence relue dans votre Saver privé.");
                })
              }
            >
              Copier cette référence dans mon Saver privé
            </button>
          </div>
        )}
        <div className="reader-columns">
          <section
            aria-label="Source originale et texte conservé"
            className="reader-source"
          >
            {image && <ReferenceMedia url={image} title={reference.title} />}
            {pdf && (
              <div className="reader-pdf">
                <p>
                  PDF original : son affichage dépend de l’accès autorisé par la
                  source. Aucune extraction PDF n’est configurée.
                </p>
                {!mediaError ? (
                  <iframe
                    title={"PDF — " + reference.title}
                    src={reference.url}
                    sandbox="allow-same-origin"
                    onError={() => setMediaError(true)}
                  />
                ) : (
                  <p role="alert">
                    Le PDF n’a pas pu être affiché. Ouvrez sa source originale.
                  </p>
                )}
              </div>
            )}
            {availableText ? (
              <>
                <p className="reader-provenance">
                  {doc?.provenance === "manual"
                    ? "Texte ajouté manuellement · la référence originale reste intacte"
                    : "Texte réellement conservé lors de la capture · il peut s’agir d’un extrait ou d’une note, pas de l’article complet"}
                </p>
                <div
                  className="reader-text"
                  ref={root}
                  tabIndex={0}
                  aria-label="Texte de la référence"
                >
                  {paragraphs(availableText).map((p) =>
                    p.separator ? (
                      p.text
                    ) : (
                      <span
                        key={p.id}
                        id={"reader-" + p.id}
                        data-paragraph={p.id}
                      >
                        {renderText(p.text, p.start)}
                      </span>
                    ),
                  )}
                </div>
              </>
            ) : (
              !image &&
              !pdf && (
                <p>
                  Seul le lien a été conservé. Aucun contenu d’article n’a été
                  extrait ; la source n’a pas été téléchargée. Ouvrez-la ou
                  ajoutez du texte manuellement.
                </p>
              )
            )}
            <details
              open={editingText}
              onToggle={(e) => {
                setEditingText(e.currentTarget.open);
                if (e.currentTarget.open && !manual) setManual(availableText);
              }}
            >
              <summary>Ajouter ou corriger le texte de lecture</summary>
              <p>
                Le texte original de la référence est préservé. Une nouvelle
                version de lecture sera créée.
              </p>
              <textarea
                aria-label="Texte de lecture manuel"
                value={manual}
                maxLength={200000}
                onChange={(e) => setManual(e.target.value)}
              />
              <button
                disabled={!doc || !manual.trim() || busy || !persisted}
                onClick={() =>
                  void run(async () => {
                    const result = await remote.reader<{
                      document: unknown;
                      verified: boolean;
                    }>("/api/reader/" + reference.id + "/document", "PUT", {
                      text: manual,
                      expectedVersion: version,
                    });
                    if (!result.verified)
                      throw Error("Relecture du texte non confirmée.");
                    setDoc(documentSchema.parse(result.document));
                    setSelection(null);
                    setNotice(
                      "Nouvelle version de lecture enregistrée. Les anciens ancrages restent signalés.",
                    );
                  })
                }
              >
                Enregistrer une nouvelle version
              </button>
            </details>
          </section>
          <aside
            className="reader-annotations"
            aria-label="Annotations humaines et questions contextuelles"
          >
            <h3>Votre sélection</h3>
            {selection ? (
              <blockquote>{selection.exact}</blockquote>
            ) : (
              <p>
                Sélectionnez un passage du texte avec la souris ou la sélection
                native du téléphone.
              </p>
            )}
            <div className="reader-selection-actions">
              <button
                disabled={!selection || !doc || busy || !persisted}
                onClick={() => void save("highlight")}
              >
                Surligner
              </button>
              <button
                disabled={!selection}
                onClick={() => document.getElementById("reader-note")?.focus()}
              >
                Ajouter une note
              </button>
              <button
                disabled={!selection}
                onClick={() =>
                  document.getElementById("reader-question")?.focus()
                }
              >
                Poser une question
              </button>
            </div>
            <label htmlFor="reader-note">Note humaine</label>
            <textarea
              id="reader-note"
              value={note}
              maxLength={5000}
              onChange={(e) => setNote(e.target.value)}
            />
            <button
              disabled={
                !selection || !note.trim() || !doc || busy || !persisted
              }
              onClick={() => void save("note")}
            >
              Enregistrer la note
            </button>
            <h3>Annotations enregistrées</h3>
            {!annotations.length && (
              <p>Aucune annotation serveur relue pour cette référence.</p>
            )}
            {annotations.map((a) => (
              <article
                key={a.id}
                className="reader-annotation"
                data-stale={a.contentVersion !== version}
              >
                <button
                  onClick={() => jump(a.anchor.start)}
                  disabled={a.contentVersion !== version}
                >
                  {a.anchor.exact}
                </button>
                {a.contentVersion !== version && (
                  <p role="status">
                    Version précédente · ancrage à vérifier. Cette annotation
                    n’a pas été déplacée.
                  </p>
                )}
                <p>{a.note || "Surlignage humain"}</p>
                <small>
                  {a.id} · révision {a.revision}
                </small>
                <button
                  disabled={busy}
                  onClick={() => {
                    setEditing(a);
                    setNote(a.note);
                  }}
                >
                  Modifier la note
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const result = await remote.reader<{
                        deleted: boolean;
                        verified: boolean;
                      }>(
                        "/api/reader/" + reference.id + "/annotations/" + a.id,
                        "DELETE",
                        { revision: a.revision },
                      );
                      if (!result.deleted || !result.verified)
                        throw Error("Suppression non confirmée.");
                      setAnnotations((rows) =>
                        rows.filter((row) => row.id !== a.id),
                      );
                      setNotice("Annotation supprimée ; référence conservée.");
                    })
                  }
                >
                  Supprimer l’annotation
                </button>
              </article>
            ))}
            {editing && (
              <div>
                <p>
                  Modifier l’annotation sélectionnée. Le passage et sa version
                  restent inchangés.
                </p>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const result = await remote.reader<{
                        annotation: unknown;
                        verified: boolean;
                      }>(
                        "/api/reader/" +
                          reference.id +
                          "/annotations/" +
                          editing.id,
                        "PUT",
                        { note, revision: editing.revision },
                      );
                      if (!result.verified)
                        throw Error("Modification non confirmée.");
                      const a = annotationSchema.parse(result.annotation);
                      setAnnotations((rows) =>
                        rows.map((row) => (row.id === a.id ? a : row)),
                      );
                      setEditing(null);
                      setNote("");
                    })
                  }
                >
                  Enregistrer la modification
                </button>
                <button onClick={() => setEditing(null)}>
                  Annuler la modification
                </button>
              </div>
            )}
            <h3>Interprétation IA</h3>
            <label htmlFor="reader-question">Question sur ce passage</label>
            <textarea
              id="reader-question"
              value={question}
              maxLength={2000}
              onChange={(e) => setQuestion(e.target.value)}
            />
            {!aiAvailable && (
              <p role="status">
                L’assistant de lecture n’est pas encore disponible. Vous pouvez
                lire et annoter librement.
              </p>
            )}
            <button
              disabled={!aiAvailable || !selection || !question.trim() || busy}
              onClick={() =>
                void run(async () => {
                  const result = await remote.reader<{ answer: Answer }>(
                    "/api/reader/" + reference.id + "/question",
                    "POST",
                    { question, anchor: selection, contentVersion: version },
                  );
                  setAnswer(result.answer);
                })
              }
            >
              Demander une réponse sourcée
            </button>
            {answer && (
              <section>
                <h4>Interprétation IA</h4>
                {answer.provenance && (
                  <p>
                    {answer.provenance.provider} · {answer.provenance.model} ·{" "}
                    {new Date(answer.provenance.generatedAt).toLocaleString(
                      "fr-FR",
                    )}
                  </p>
                )}
                <p>Explicite : {answer.explicit}</p>
                <p>Déductions : {answer.inferences}</p>
                <p>La source ne permet pas de savoir : {answer.unknowns}</p>
                {answer.citations
                  .filter((c) =>
                    paragraphs(availableText).some(
                      (p) => p.id === c.paragraphId && p.text.includes(c.quote),
                    ),
                  )
                  .map((citation, i) => (
                    <button
                      key={i}
                      onClick={() =>
                        document
                          .getElementById("reader-" + citation.paragraphId)
                          ?.scrollIntoView({ block: "center" })
                      }
                    >
                      Voir le paragraphe cité : {citation.quote}
                    </button>
                  ))}
              </section>
            )}
          </aside>
        </div>
        {remote.connected && persisted && !reference.isInternalQA && (
          <details>
            <summary>Mémoire Taste de cette référence</summary>
            <p>
              Source, annotations humaines et interprétations IA restent
              distinctes. Aucune préférence confirmée n’est modifiée.
            </p>
            <button
              disabled={busy}
              onClick={() =>
                void run(async () =>
                  setTaste(
                    await remote.reader(
                      "/api/taste/context?reference=" + reference.id,
                    ),
                  ),
                )
              }
            >
              Relire le contexte Taste
            </button>
            {taste && (
              <p>
                {taste.humanAnnotations.length} annotation(s) humaine(s),{" "}
                {taste.aiInterpretations.length} interprétation(s) IA
                conservée(s).
              </p>
            )}
          </details>
        )}
        {notice && <p role="status">{notice}</p>}
      </div>
    </Modal>
  );
}
