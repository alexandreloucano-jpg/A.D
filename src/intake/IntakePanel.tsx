import { useEffect, useRef, useState } from "react";
import { ClipboardPaste, FileUp, Download, BookmarkPlus } from "lucide-react";
import { Modal } from "../components/ui";
import type { RemoteSaver } from "../remote-saver";
import {
  uniqueIntake,
  canonicalSource,
  normalizeIntake,
  type IntakeItem,
} from "./model";
import { saveLocalCopies, downloadLocalMedia } from "./local-archive";
import { parseBookmarkFile } from "./parse";
const DRAFT = "ad.intake.draft.v1";
type Draft = {
  items: IntakeItem[];
  method: "file" | "browser" | "paste";
  nonce?: string;
  receipts: Record<string, string>;
};
export function IntakePanel({
  remote,
  groups,
  onSaved,
  onLocalImport,
}: {
  onLocalImport: (
    items: IntakeItem[],
    preferredIds?: string[],
  ) => Promise<string[]>;
  remote: RemoteSaver;
  groups: { id: string; name: string }[];
  onSaved: (ids: string[], group: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState<Draft | null>(null),
    [selected, setSelected] = useState<Set<string>>(new Set()),
    [link, setLink] = useState(""),
    [group, setGroup] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [visible, setVisible] = useState(30);
  const [localOnly, setLocalOnly] = useState(false);
  const [phase, setPhase] = useState<"references" | "content">("references");
  const [total, setTotal] = useState(0);
  const pendingNonce = useRef<string | undefined>(undefined);
  const locked = useRef(false),
    file = useRef<HTMLInputElement>(null);
  function remember(next: Draft) {
    sessionStorage.setItem(DRAFT, JSON.stringify(next));
    if (sessionStorage.getItem(DRAFT) !== JSON.stringify(next))
      throw Error(
        "La copie de reprise n’a pas été confirmée. Aucun import lancé.",
      );
    pendingNonce.current = next.nonce;
    setDraft(next);
  }
  function preview(items: unknown[], method: Draft["method"], nonce?: string) {
    if (locked.current)
      throw Error(
        "Un import est en cours. La nouvelle capture reste à reprendre.",
      );
    const parsed = uniqueIntake(items);
    const next: Draft = { items: parsed.items, method, nonce, receipts: {} };
    remember(next);
    setSelected(new Set(parsed.items.map((i) => i.url)));
    setProgress(0);
    setVisible(30);
    setError("");
    setNotice(
      parsed.duplicates
        ? `${parsed.duplicates} doublon(s) écarté(s) du lot.`
        : "",
    );
    setOpen(true);
  }
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT);
      if (raw) {
        const d = JSON.parse(raw);
        const parsed = uniqueIntake(d.items);
        if (!["file", "browser", "paste"].includes(d.method))
          throw Error("draft");
        pendingNonce.current = d.nonce;
        setDraft({ ...d, items: parsed.items });
        setSelected(new Set(parsed.items.map((i) => i.url)));
        setOpen(true);
      }
    } catch {
      setError(
        "La capture en attente est illisible. Elle n’a pas été supprimée.",
      );
    }
    const receive = (event: MessageEvent) => {
      if (
        event.source !== window ||
        event.origin !== location.origin ||
        event.data?.type !== "AD_SAVER_CAPTURE"
      )
        return;
      try {
        if (!/^[a-f0-9-]{36}$/i.test(event.data.nonce || ""))
          throw Error("Lien de capture invalide.");
        if (pendingNonce.current === event.data.nonce) {
          setOpen(true);
          return;
        }
        preview(event.data.items, "browser", event.data.nonce);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Capture invalide.");
        setOpen(true);
      }
    };
    window.addEventListener("message", receive);
    window.postMessage({ type: "AD_SAVER_READY" }, location.origin);
    return () => window.removeEventListener("message", receive);
  }, []);
  function pasteText(value: string) {
    setLink(value);
    const url = value
      .match(/https?:\/\/[^\s<>"']+/)?.[0]
      ?.replace(/[),.;!?]+$/, "");
    if (!url)
      throw Error(
        "Collez le lien partagé depuis X, Instagram, LinkedIn ou une autre source.",
      );
    preview(
      [
        normalizeIntake({
          url,
          title: "",
          text: value === url ? "" : value.slice(0, 10000),
          images: [],
          tags: [],
        }),
      ],
      "paste",
    );
  }
  async function clipboard() {
    setError("");
    setOpen(true);
    try {
      pasteText(await navigator.clipboard.readText());
    } catch {
      setError(
        "Collez le lien dans le champ ci-dessous. Le presse-papiers n’a pas été lu.",
      );
    }
  }
  async function save() {
    if (locked.current || !draft) return;
    locked.current = true;
    setBusy(true);
    setError("");
    let next = { ...draft, receipts: { ...draft.receipts } };
    try {
      const chosen = draft.items.filter((i) => selected.has(i.url));
      if (!chosen.length) throw Error("Sélectionnez au moins une référence.");
      setPhase("references");
      setProgress(0);
      setTotal(chosen.length);
      const todo = chosen.filter((i) => !next.receipts[i.url]);
      if (localOnly || !remote.connected) {
        const ids = await onLocalImport(todo);
        for (let i = 0; i < todo.length; i++)
          next.receipts[todo[i].url] = ids[i];
        remember(next);
        setProgress(chosen.length);
        todo.length = 0;
      }
      while (todo.length) {
        const batch: IntakeItem[] = [];
        while (todo.length && batch.length < 20) {
          const row = todo[0];
          if (
            batch.length &&
            new TextEncoder().encode(
              JSON.stringify({ method: draft.method, items: [...batch, row] }),
            ).byteLength > 300000
          )
            break;
          batch.push(todo.shift()!);
        }
        const receipt = await remote.reader<{
          results: {
            url: string;
            id?: string;
            verified: boolean;
            error?: string;
          }[];
        }>("/api/intake", "POST", { method: draft.method, items: batch });
        const expected = new Set(batch.map((i) => i.url));
        let failed = false;
        for (const row of receipt.results) {
          if (
            !expected.delete(row.url) ||
            !row.verified ||
            !row.id ||
            !/^[a-f0-9-]{36}$/i.test(row.id)
          ) {
            failed = true;
            continue;
          }
          next.receipts[row.url] = row.id;
        }
        remember(next);
        if (failed)
          throw Error(
            "Import partiel : certaines références ne sont pas confirmées. La capture et les UUID déjà vérifiés sont conservés pour la reprise.",
          );
        setProgress(Object.keys(next.receipts).length);
        if (expected.size)
          throw Error(
            "Réponse incomplète : le lot reste disponible pour reprise.",
          );
      }
      const ids = chosen.map((i) => next.receipts[i.url]);
      if (!localOnly && remote.connected) await onLocalImport(chosen, ids);
      setPhase("content");
      setProgress(0);
      await saveLocalCopies(chosen, ids, next.nonce, (done) =>
        setProgress(done),
      );
      void downloadLocalMedia(ids).catch(() =>
        setNotice(
          "Le texte est conservé. La copie des médias a été interrompue ; utilisez Reprendre sur les cartes concernées.",
        ),
      );

      if (!(await onSaved(ids, group)))
        throw Error(
          "Les références sont enregistrées ; le classement n’a pas été confirmé. Réessayez sans créer de nouvelles copies.",
        );
      const remaining = next.items.filter((i) => !selected.has(i.url));
      if (remaining.length) {
        remember({ ...next, items: remaining, receipts: {} });
        setSelected(new Set(remaining.map((i) => i.url)));
      } else {
        sessionStorage.removeItem(DRAFT);
        if (next.nonce)
          window.postMessage(
            { type: "AD_SAVER_CAPTURE_SAVED", nonce: next.nonce },
            location.origin,
          );
        setDraft(null);
      }
      if (remote.connected && !localOnly) await remote.refresh();
      setNotice(
        `${ids.length} référence(s) conservée(s) avec UUID et relecture. Le texte est local ; la conservation des fichiers média est suivie sur chaque carte. Vos annotations et groupes existants sont conservés.`,
      );
      setProgress(0);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Import interrompu. La capture est conservée.",
      );
      if (remote.connected && !localOnly) await remote.refresh();
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <div className="saver-intake-actions">
        <button onClick={() => void clipboard()}>
          <ClipboardPaste size={16} />
          Coller une publication
        </button>
        <button
          onClick={() => {
            setOpen(true);
            setError("");
          }}
        >
          <BookmarkPlus size={16} />
          Importer des signets
        </button>
      </div>
      {open && (
        <Modal
          title="Ajouter à Saver"
          close={() => {
            if (!busy) setOpen(false);
          }}
        >
          <div className="intake-shell">
            <p>
              Vos références restent dans A.D. L’enregistrement se fait après
              votre validation, avec relecture et sans doublons. Le mode local
              ne demande aucune connexion.
            </p>
            <details className="intake-inputs" open={!draft}>
              <summary>Ajouter un lien ou un fichier</summary>
              <div className="intake-entry">
                <label>
                  Lien ou texte partagé
                  <textarea
                    aria-label="Lien ou texte partagé"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    maxLength={10000}
                    placeholder="Partager → Copier le lien, puis coller ici"
                  />
                </label>
                <button
                  disabled={busy || !link.trim()}
                  onClick={() => {
                    try {
                      pasteText(link);
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : "Lien invalide.",
                      );
                    }
                  }}
                >
                  Prévisualiser le lien
                </button>
              </div>
              <div className="intake-file-actions">
                <input
                  ref={file}
                  hidden
                  type="file"
                  accept=".csv,.json,.html,.htm,.txt"
                  aria-label="Fichier de signets"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setError("");
                    try {
                      if (f.size > 12000000)
                        throw Error("Fichier limité à 12 Mo.");
                      const parsed = parseBookmarkFile(await f.text(), f.name);
                      preview(parsed.items, "file");
                      setNotice(
                        parsed.duplicates
                          ? `${parsed.duplicates} doublon(s) écarté(s).`
                          : "",
                      );
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : "Fichier non reconnu.",
                      );
                    } finally {
                      if (file.current) file.current.value = "";
                    }
                  }}
                />
                <button disabled={busy} onClick={() => file.current?.click()}>
                  <FileUp size={16} />
                  Choisir un fichier CSV, JSON ou HTML
                </button>
                <a href="/ad-saver-extension.zip" download>
                  <Download size={16} />
                  Extension A.D pour Chrome / Edge
                </a>
              </div>
              <details>
                <summary>Capture depuis le navigateur ou l’iPhone</summary>
                <p>
                  Sur iPhone : partagez la publication, copiez son lien, puis
                  utilisez « Coller une publication ». Aucune récupération des
                  cookies ou des jetons n’est nécessaire.
                </p>
                <p>
                  L’extension A.D peut importer les signets X via votre session
                  navigateur ; elle peut aussi capturer les publications
                  affichées dans votre onglet X, à votre demande. Elle prépare
                  l’import ici via l’interface privée de X, sans crédits API
                  officiels. Les données de connexion restent dans l’extension.
                  Elle est livrée en ZIP de développement ; sa distribution en
                  magasin nécessite un compte éditeur. Ce ZIP ne s’installe pas
                  sur iPhone.
                </p>
              </details>
            </details>
            {draft && (
              <>
                <div className="intake-preview-heading">
                  <strong>{draft.items.length} référence(s) à examiner</strong>
                  <button
                    disabled={busy}
                    onClick={() =>
                      setSelected(
                        selected.size === draft.items.length
                          ? new Set()
                          : new Set(draft.items.map((i) => i.url)),
                      )
                    }
                  >
                    {selected.size === draft.items.length
                      ? "Tout désélectionner"
                      : "Tout sélectionner"}
                  </button>
                </div>
                <ul className="intake-preview">
                  {draft.items.slice(0, visible).map((item) => (
                    <li key={item.url}>
                      <label>
                        <input
                          type="checkbox"
                          checked={selected.has(item.url)}
                          disabled={busy}
                          onChange={(e) =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(item.url);
                              else next.delete(item.url);
                              return next;
                            })
                          }
                        />
                        <span>
                          <strong>{item.title}</strong>
                          <small>
                            {new URL(item.url).hostname}
                            {draft.receipts[item.url] ? " · UUID vérifié" : ""}
                          </small>
                          <span>{item.text.slice(0, 180)}</span>
                          {item.notes.length > 0 && (
                            <small>
                              Notes importées : {item.notes.join(" · ")}
                            </small>
                          )}
                          {item.tags.length > 0 && (
                            <small>
                              Tags du fichier : {item.tags.join(", ")}
                            </small>
                          )}
                        </span>
                      </label>
                      <a
                        href={canonicalSource(item.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Source
                      </a>
                    </li>
                  ))}
                </ul>
                {draft.items.length > visible && (
                  <button onClick={() => setVisible((v) => v + 50)}>
                    Afficher les références suivantes
                  </button>
                )}
                <label>
                  Collection
                  <select
                    aria-label="Collection de l’import"
                    value={group}
                    onChange={(e) => setGroup(e.target.value)}
                    disabled={busy}
                  >
                    <option value="">Sans ajout à une collection</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </label>
                <p>
                  Les tags du fichier sont conservés comme provenance. Aucun
                  groupe IA, tâche ou préférence confirmée n’est créé
                  automatiquement.
                </p>
              </>
            )}
            {!remote.connected && (
              <p>
                <a className="primary" href="/api/auth/google/login">
                  Se connecter avec Google pour la copie cloud (facultatif)
                </a>{" "}
                L’enregistrement local fonctionne sans connexion. La capture en
                attente reste dans ce navigateur.
              </p>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {notice && <p role="status">{notice}</p>}
            {draft && remote.connected && (
              <label className="intake-local-option">
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={localOnly}
                  onChange={(e) => setLocalOnly(e.target.checked)}
                />{" "}
                Conserver uniquement sur cet appareil
              </label>
            )}
            {draft && (
              <div className="intake-footer">
                <button
                  className="primary"
                  disabled={busy || !selected.size}
                  onClick={() => void save()}
                >
                  {busy
                    ? `${phase === "content" ? "Copie du contenu" : "Enregistrement"}… ${progress}/${total}`
                    : `Enregistrer ${selected.size} référence(s) sélectionnée(s)`}
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    sessionStorage.removeItem(DRAFT);
                    setDraft(null);
                    setNotice(
                      "Capture écartée. Aucune référence existante supprimée.",
                    );
                  }}
                >
                  Écarter cette capture
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
