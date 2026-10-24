import {
  localOnlyIds,
  setLocalOnly,
  searchLocalCopies,
} from "./intake/local-archive";
import { canonicalSource, type IntakeItem } from "./intake/model";
import { AccountSettings } from "./AccountSettings";
import { parseSharedCapture } from "./share";
import { useRemoteSaver, RemoteSaverSettings } from "./remote-saver";
import { useWorkspaceNavigation } from "./hooks/useWorkspaceNavigation";
import {
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronLeft,
  Compass,
  Download,
  Folder,
  House,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CaptureForm, ProjectForm, SignalForm } from "./components/forms";
import { Modal } from "./components/ui";
import {
  activeTasks,
  emptyWorkspace,
  makeReference,
  referenceSchema,
  rediscover,
  SCOUT_TOOLS,
  transitionTask,
  type Task,
  type Workspace,
} from "./domain";
import {
  exportBackup,
  parseBackup,
  STORAGE_KEY,
  WorkspaceRepository,
} from "./storage";
import { ExplorerView } from "./views/ExplorerView";
import { HomeView } from "./views/HomeView";
import { ProjectsView } from "./views/ProjectsView";
import { SaverView } from "./views/SaverView";

const routes = [
  ["accueil", "Accueil", House],
  ["explorer", "Explorer", Compass],
  ["saver", "Saver", Bookmark],
  ["projets", "Projets", Folder],
] as const;
function errorLabel(error: unknown): string {
  if (error instanceof Error && error.name === "ZodError")
    return "Données invalides : vérifiez les champs, les liens et le format de sauvegarde.";
  return error instanceof Error
    ? error.message
    : "Une erreur empêche la sauvegarde. Votre brouillon est conservé.";
}
function download(text: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function App() {
  const [repository] = useState(() => new WorkspaceRepository(localStorage));
  const [initial] = useState(() => {
    try {
      return { data: repository.read(), error: "" };
    } catch (e) {
      return { data: emptyWorkspace(), error: errorLabel(e) };
    }
  });
  const [data, setData] = useState(initial.data);
  const [fatal, setFatal] = useState(initial.error);
  const remote = useRemoteSaver();
  const [readerMatches, setReaderMatches] = useState<
    {
      referenceId: string;
      annotationId: string | null;
      quote?: string;
      note?: string;
    }[]
  >([]);
  const pendingRemoteCapture = useRef<ReturnType<typeof makeReference> | null>(
    null,
  );
  const remoteIds = new Set(remote.references.map((row) => row.id));
  const localProjects = new Set(data.projects.map((row) => row.id));
  const displayData = {
    ...data,
    references: [
      ...data.references.filter((row) => !remoteIds.has(row.id)),
      ...remote.references.map((row) =>
        row.projectId && !localProjects.has(row.projectId)
          ? { ...row, projectId: undefined }
          : row,
      ),
    ].sort(
      (a, b) =>
        a.capturedAt.localeCompare(b.capturedAt) || a.id.localeCompare(b.id),
    ),
  };
  const {
    route,
    query,
    projectId,
    archive,
    expanded,
    filter,
    navigate,
    openReference,
    setQuery,
    setProjectId,
    setArchive,
    setExpanded,
    setFilter,
  } = useWorkspaceNavigation();
  const adminMode =
    new URLSearchParams(location.hash.split("?")[1] || "").get("admin") === "1";
  const [autoSyncError, setAutoSyncError] = useState("");
  const autoMigration = useRef(false);
  useEffect(() => {
    if (!remote.connected || autoMigration.current) return;
    const saved = new Set(remote.references.map((row) => row.id));
    let privateIds: Set<string>;
    try {
      privateIds = localOnlyIds();
    } catch {
      setAutoSyncError(
        "Choix local illisible : synchronisation cloud suspendue.",
      );
      return;
    }
    const pending = data.references.filter(
      (row) =>
        !row.isInternalQA && !saved.has(row.id) && !privateIds.has(row.id),
    );
    if (!pending.length) {
      setAutoSyncError("");
      return;
    }
    autoMigration.current = true;
    void remote
      .migrate(pending)
      .then(() => setAutoSyncError(""))
      .catch(() =>
        setAutoSyncError(
          "Certaines références ne sont pas encore synchronisées. Elles restent sur cet appareil ; la sauvegarde sera réessayée automatiquement.",
        ),
      )
      .finally(() => {
        autoMigration.current = false;
      });
  }, [remote.connected, remote.references, data.references]);
  const grokSetup =
    new URLSearchParams(location.hash.split("?")[1] || "").get("connect") ===
    "grok";
  const [modal, setModal] = useState<
    "capture" | "project" | "signal" | "settings" | null
  >(() =>
    grokSetup ||
    (adminMode &&
      new URLSearchParams(location.hash.split("?")[1] || "").get("settings") ===
        "1")
      ? "settings"
      : null,
  );
  const [captureContext, setCaptureContext] = useState<{
    url: string;
    title: string;
    content?: string;
    shared?: boolean;
  } | null>(null);
  useEffect(() => {
    let active = true;
    setReaderMatches([]);
    if (!remote.connected || route !== "saver" || !query.trim()) return;
    const timer = setTimeout(() => {
      void remote
        .reader<{ matches: typeof readerMatches }>(
          "/api/reader/search?q=" + encodeURIComponent(query.trim()),
        )
        .then((result) => {
          if (active) setReaderMatches(result.matches);
        })
        .catch(() => {
          if (active) setReaderMatches([]);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [remote.connected, query, route]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pendingImport, setPendingImport] = useState<Workspace | null>(null);
  useEffect(() => {
    const receive = (restore = false) => {
      try {
        let incoming = parseSharedCapture(location.hash);
        if (!incoming && restore) {
          try {
            const pending = sessionStorage.getItem("ad.pending-share.v1");
            if (pending) {
              const value = JSON.parse(pending);
              incoming = parseSharedCapture(
                "#/saver?" +
                  new URLSearchParams({
                    share: "1",
                    url: value.url || "",
                    title: value.title || "",
                    text: value.content || "",
                  }),
              );
            }
          } catch {
            /* Invalid incoming drafts never replace existing captures. */
          }
        }
        if (incoming) {
          try {
            sessionStorage.setItem(
              "ad.pending-share.v1",
              JSON.stringify(incoming),
            );
          } catch {
            /* Current form remains available. */
          }
        }
        if (!incoming) return;
        setCaptureContext(incoming);
        setModal("capture");
        setError("");
      } catch (e) {
        setError(errorLabel(e));
      }
    };
    receive(true);
    const change = () => receive();
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);

  useEffect(() => {
    const change = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        try {
          setData(repository.read());
          setFatal("");
          setNotice("Espace actualisé depuis un autre onglet.");
        } catch (e) {
          setFatal(errorLabel(e));
        }
      }
    };
    window.addEventListener("storage", change);
    return () => window.removeEventListener("storage", change);
  }, [repository]);
  function commit(next: Workspace, success: string) {
    if (fatal) {
      setError(
        "Lecture impossible. Exportez les données brutes avant toute récupération.",
      );
      return false;
    }
    try {
      setData(repository.commit(next));
      setError("");
      setNotice(success);
      return true;
    } catch (e) {
      setError(errorLabel(e));
      return false;
    }
  }
  async function importLocal(items: IntakeItem[], preferredIds?: string[]) {
    const current = repository.read(),
      references = [...current.references],
      ids: string[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const existing = references.find((r) => {
        try {
          return !!r.url && canonicalSource(r.url) === item.url;
        } catch {
          return false;
        }
      });
      const id = existing?.id || preferredIds?.[i] || crypto.randomUUID();
      ids.push(id);
      if (!existing && !references.some((r) => r.id === id)) {
        const now = new Date().toISOString();
        references.push(
          referenceSchema.parse({
            id,
            title: item.title,
            content: item.text,
            url: item.url,
            origin: "human",
            capturedAt: now,
            approvedAt: now,
            revision: 1,
            isInternalQA: false,
          }),
        );
      }
    }
    setLocalOnly(ids, !preferredIds);
    if (
      !commit(
        { ...current, references },
        "Signets enregistrés sur cet appareil.",
      )
    )
      throw Error(
        "La sauvegarde locale n’a pas été confirmée. Le lot est conservé.",
      );
    return ids;
  }
  function act(task: Task, action: "accept" | "archive" | "restore") {
    try {
      const updated = transitionTask(task, action, true);
      commit(
        {
          ...data,
          tasks: data.tasks.map((t) => (t.id === task.id ? updated : t)),
        },
        action === "accept"
          ? "Action acceptée. Elle est maintenant dans NOW."
          : action === "restore"
            ? "Suggestion restaurée dans LATER."
            : "Action écartée, conservée dans les archives.",
      );
    } catch (e) {
      setError(errorLabel(e));
    }
  }
  const project = data.projects.find((p) => p.id === projectId);
  const now = activeTasks(data);
  const [localMatches, setLocalMatches] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    setLocalMatches([]);
    if (!query.trim()) return;
    const timer = setTimeout(
      () =>
        void searchLocalCopies(query)
          .then((ids) => {
            if (active) setLocalMatches(ids);
          })
          .catch(() => {}),
      200,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, data.references]);
  const refs = rediscover(displayData).filter(
    (r) =>
      (r.title + " " + r.content + " " + (r.url || ""))
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()) ||
      readerMatches.some((hit) => hit.referenceId === r.id) ||
      localMatches.includes(r.id),
  );
  const projects = data.projects.filter((p) =>
    p.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const signals = data.signals.filter((s) =>
    (s.brand + " " + s.observedFact)
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase()),
  );
  const visibleReferenceCount = refs.filter(
    (r) => filter === "all" || (filter === "links" ? !!r.url : !r.url),
  ).length;
  const selected = routes.find(([key]) => key === route)!;
  return (
    <div className="app-frame">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Aller au contenu
      </a>
      <div className="workspace" data-view={route}>
        <header className="topbar">
          <a
            className="brand"
            href="#/accueil"
            onClick={(e) => {
              e.preventDefault();
              navigate("accueil");
            }}
            aria-label="A.D — Accueil"
          >
            A.D
            <span className="brand-line" />
            <span className="brand-caption">
              PRIVATE
              <br />
              INTELLIGENCE
            </span>
          </a>
          <nav aria-label="Navigation principale">
            {routes.map(([key, label, Icon]) => (
              <a
                key={key}
                href={"#/" + key}
                aria-current={route === key ? "page" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(key);
                }}
              >
                <Icon size={17} />
                <span>{label}</span>
              </a>
            ))}
          </nav>
          <div className="top-actions">
            <button
              className={
                "capture-button" + (route === "saver" ? " saver-capture" : "")
              }
              onClick={() => {
                setError("");
                setCaptureContext(null);
                setModal("capture");
              }}
              disabled={!!fatal}
            >
              <Plus size={17} />
              <span>Capturer</span>
            </button>
            <button
              className="icon-button"
              aria-label="Réglages et sauvegarde"
              onClick={() => setModal("settings")}
            >
              <Settings size={19} />
            </button>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} key={route}>
          <div className="section-meta">
            <span>
              <span className="workspace-label">
                ESPACE PERSONNEL <span className="meta-divider">/</span>{" "}
              </span>
              {selected[1].toUpperCase()}
            </span>
            <span className="local-state">
              <span />{" "}
              {remote.connected
                ? "Saver privé connecté"
                : "Local · Sites non connecté"}
            </span>
          </div>
          {fatal ? (
            <div role="alert" className="recovery">
              <h1>Vos données restent protégées.</h1>
              <p>
                Le contenu local ne peut pas être lu. Aucune donnée n’a été
                remplacée.
              </p>
              <p>{fatal}</p>
              <button
                onClick={() =>
                  download(
                    localStorage.getItem(STORAGE_KEY) || "",
                    "ad-recovery-raw.json",
                  )
                }
              >
                Exporter le contenu brut <Download size={16} />
              </button>
            </div>
          ) : (
            <>
              {route === "accueil" && (
                <HomeView
                  data={displayData}
                  now={now}
                  navigate={navigate}
                  setProjectId={setProjectId}
                  openReference={openReference}
                  setModal={setModal}
                  remote={remote}
                />
              )}
              {route !== "accueil" && (
                <div
                  className={
                    "content-page" +
                    (project && route === "projets" ? " project-detail" : "")
                  }
                >
                  <header className="page-heading">
                    <div>
                      <p className="eyebrow">
                        {route === "saver"
                          ? "SOURCES ET MÉMOIRE CRÉATIVE"
                          : route === "explorer"
                            ? "OBSERVER AVANT D’INTERPRÉTER"
                            : "DOSSIERS ET DÉCISIONS"}
                      </p>
                      <h1>
                        {project && route === "projets"
                          ? project.title
                          : selected[1]}
                        <span className="title-dot">.</span>
                      </h1>
                      <p>
                        {route === "saver"
                          ? "Les références que vous avez choisi de garder."
                          : route === "explorer"
                            ? "Des faits sourcés, des pistes à examiner."
                            : project
                              ? "Idées à examiner, actions acceptées et références."
                              : "Projets, tâches et références enregistrés."}
                      </p>
                    </div>
                    <button
                      className="primary"
                      onClick={() => {
                        setError("");
                        setCaptureContext(null);
                        setModal(
                          route === "saver"
                            ? "capture"
                            : route === "explorer"
                              ? "signal"
                              : "project",
                        );
                      }}
                    >
                      <Plus size={17} />
                      {route === "saver"
                        ? "Capturer"
                        : route === "explorer"
                          ? "Ajouter un signal"
                          : "Nouveau projet"}
                    </button>
                  </header>
                  <div className="collection-toolbar">
                    {project && route === "projets" ? (
                      <button
                        className="text-button"
                        onClick={() => setProjectId(null)}
                      >
                        <ChevronLeft size={18} />
                        Tous les projets
                      </button>
                    ) : (
                      <label className="search">
                        <Search size={17} />
                        <input
                          aria-label="Rechercher"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder={
                            route === "saver"
                              ? "Retrouver une référence…"
                              : "Rechercher…"
                          }
                        />
                      </label>
                    )}
                    <span className="result-count">
                      {route === "saver"
                        ? visibleReferenceCount
                        : route === "explorer"
                          ? signals.length
                          : projects.length}{" "}
                      {route === "saver"
                        ? visibleReferenceCount === 1
                          ? "référence"
                          : "références"
                        : route === "explorer"
                          ? signals.length === 1
                            ? "signal manuel"
                            : "signaux manuels"
                          : projects.length === 1
                            ? "dossier"
                            : "dossiers"}
                    </span>
                    {query && (
                      <button
                        className="clear-search"
                        aria-label="Effacer la recherche"
                        onClick={() => setQuery("")}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  <div
                    className="collection-scroll"
                    tabIndex={0}
                    aria-label={"Contenu " + selected[1]}
                  >
                    {route === "saver" && (
                      <SaverView
                        onLocalImport={importLocal}
                        onCapture={() => {
                          setError("");
                          setCaptureContext(null);
                          setModal("capture");
                        }}
                        adminMode={adminMode}
                        refs={refs}
                        expanded={expanded}
                        setExpanded={setExpanded}
                        query={query}
                        data={displayData}
                        serverIds={remoteIds}
                        remote={remote}
                        readerMatches={readerMatches}
                        filter={filter}
                        setFilter={setFilter}
                      />
                    )}
                    {route === "explorer" && (
                      <ExplorerView
                        signals={signals}
                        query={query}
                        onCapture={(source) => {
                          setError("");
                          setCaptureContext(source);
                          setModal("capture");
                        }}
                      />
                    )}
                    {route === "projets" && (
                      <ProjectsView
                        project={project}
                        archive={archive}
                        setArchive={setArchive}
                        setProjectId={setProjectId}
                        data={displayData}
                        commit={(next, message) =>
                          commit(
                            { ...next, references: data.references },
                            message,
                          )
                        }
                        act={act}
                        projects={projects}
                        query={query}
                        openReference={openReference}
                        remote={remote}
                        onCapture={() => {
                          setError("");
                          setCaptureContext(null);
                          setModal("capture");
                        }}
                      />
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
        <footer className="statusbar">
          <span>A.D / PRIVATE WORKSPACE</span>
          <button onClick={() => setModal("settings")}>
            <ShieldCheck size={13} />{" "}
            {remote.connected
              ? "Saver privé · autres données locales"
              : "Données dans ce navigateur"}{" "}
            <ArrowUpRight size={12} />
          </button>
        </footer>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{notice}</span>
          <button
            className="icon-button"
            aria-label="Masquer le message"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {error && !modal && (
        <div className="error-toast" role="alert">
          {error}
          <button onClick={() => setError("")}>Fermer</button>
        </div>
      )}
      {modal === "capture" && (
        <Modal title="Garder une idée." close={() => setModal(null)}>
          <CaptureForm
            key={
              captureContext?.shared
                ? captureContext.url + captureContext.content
                : "manual-capture"
            }
            sourceContext={captureContext}
            defaultProjectId={
              route === "projets" ? projectId || undefined : undefined
            }
            data={data}
            error={error}
            remote={remote.connected}
            save={async (input) => {
              try {
                let reference = makeReference(input, true);
                if (remote.connected) {
                  if (!pendingRemoteCapture.current) {
                    try {
                      const raw = sessionStorage.getItem(
                        "ad.pending-server-reference.v1",
                      );
                      if (raw)
                        pendingRemoteCapture.current = referenceSchema.parse(
                          JSON.parse(raw),
                        );
                    } catch {
                      /* A corrupt pending record never replaces a current draft. */
                    }
                  }
                  const previous = pendingRemoteCapture.current;
                  if (
                    previous &&
                    previous.title === reference.title &&
                    previous.content === reference.content &&
                    previous.url === reference.url &&
                    previous.origin === reference.origin &&
                    previous.projectId === reference.projectId
                  )
                    reference = previous;
                  pendingRemoteCapture.current = reference;
                  try {
                    sessionStorage.setItem(
                      "ad.pending-server-reference.v1",
                      JSON.stringify(reference),
                    );
                  } catch {
                    throw Error(
                      "Impossible de protéger le reçu de sauvegarde sur cet appareil. Le brouillon est conservé.",
                    );
                  }
                  const saved = await remote.save(reference);
                  pendingRemoteCapture.current = null;
                  try {
                    sessionStorage.removeItem("ad.pending-server-reference.v1");
                  } catch {
                    /* The verified server receipt remains valid. */
                  }
                  setNotice(
                    `Référence sauvegardée et relue sur le serveur · ${saved.id}`,
                  );
                  if (captureContext?.shared) {
                    try {
                      sessionStorage.removeItem("ad.pending-share.v1");
                    } catch {
                      /* Saved reference is verified. */
                    }
                  }
                  setModal(null);
                  openReference(saved.id);
                  return true;
                }
                if (
                  commit(
                    { ...data, references: [...data.references, reference] },
                    `Référence sauvegardée et relue localement · ${reference.id}`,
                  )
                ) {
                  if (captureContext?.shared) {
                    try {
                      sessionStorage.removeItem("ad.pending-share.v1");
                    } catch {
                      /* Saved reference is verified. */
                    }
                  }
                  setModal(null);
                  openReference(reference.id);
                  return true;
                }
              } catch (e) {
                setError(errorLabel(e));
              }
              return false;
            }}
          />
        </Modal>
      )}
      {modal === "project" && (
        <Modal title="Une nouvelle direction." close={() => setModal(null)}>
          <ProjectForm
            error={error}
            save={(title) => {
              const p = {
                id: crypto.randomUUID(),
                title,
                updatedAt: new Date().toISOString(),
              };
              if (
                commit(
                  { ...data, projects: [...data.projects, p] },
                  "Projet sauvegardé localement.",
                )
              ) {
                setModal(null);
                navigate("projets");
                setProjectId(p.id);
                return true;
              }
              return false;
            }}
          />
        </Modal>
      )}
      {modal === "signal" && (
        <Modal title="Un fait, une source." close={() => setModal(null)}>
          <SignalForm
            error={error}
            save={(signal) => {
              if (
                commit(
                  { ...data, signals: [...data.signals, signal] },
                  "Signal sourcé sauvegardé localement.",
                )
              ) {
                setModal(null);
                return true;
              }
              return false;
            }}
          />
        </Modal>
      )}
      {modal === "settings" && (
        <Modal
          title="Votre espace, vos données."
          close={() => {
            setModal(null);
            setPendingImport(null);
          }}
        >
          <div className="settings-content">
            {adminMode ? (
              <RemoteSaverSettings
                grokSetup={true}
                remote={remote}
                localReferences={data.references}
                backup={() =>
                  download(
                    exportBackup(data),
                    "ad-before-server-migration.json",
                  )
                }
              />
            ) : (
              <AccountSettings remote={remote} syncError={autoSyncError} />
            )}
            {adminMode && (
              <p className="local-info">
                Les projets et les signaux restent locaux. Le Saver privé est
                accessible uniquement après connexion propriétaire. Les données
                historiques Sites et l’API xAI restent indépendantes.
              </p>
            )}
            <details className="settings-backup">
              <summary>Sauvegarde et restauration</summary>
              <p>
                Les projets et signaux restent dans ce navigateur. Les
                références serveur sont privées et accessibles après connexion.
                Exportez une copie avant de changer d’appareil ; utilisez un
                appareil de confiance.
              </p>
              <div className="backup-actions">
                <button
                  onClick={() =>
                    download(
                      fatal
                        ? localStorage.getItem(STORAGE_KEY) || ""
                        : exportBackup(displayData),
                      "ad-workspace-backup.json",
                    )
                  }
                >
                  <Download size={16} />
                  Exporter mes données
                </button>
                <label className="file-button">
                  <Upload size={16} />
                  Importer une sauvegarde
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        if (file.size > 20_000_000)
                          throw new Error("20 Mo maximum.");
                        setPendingImport(parseBackup(await file.text()));
                        setError("");
                      } catch (err) {
                        setError(errorLabel(err));
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              {pendingImport && (
                <div className="import-confirm">
                  <p>
                    {pendingImport.projects.length} projet(s),{" "}
                    {pendingImport.references.length} référence(s),{" "}
                    {pendingImport.tasks.length} action(s). Cette importation
                    remplacera l’espace local. Exportez-le d’abord.
                  </p>
                  <button
                    className="primary"
                    disabled={!!fatal}
                    onClick={() => {
                      if (
                        commit(pendingImport, "Sauvegarde importée et relue.")
                      )
                        setPendingImport(null);
                    }}
                  >
                    Confirmer le remplacement
                  </button>
                  <button onClick={() => setPendingImport(null)}>
                    Annuler
                  </button>
                </div>
              )}
            </details>
            {adminMode && (
              <>
                <h3>Administration Grok Scout</h3>
                <p>
                  La passerelle dédiée dispose uniquement des quatre outils
                  Saver. Sa présence ne prouve pas une connexion dans Grok.
                  Utilisez le panneau ci-dessus pour créer ou révoquer un client
                  dédié.
                </p>
                <details>
                  <summary>Surface Saver prévue · 4 outils</summary>
                  <ul>
                    {SCOUT_TOOLS.map((t) => (
                      <li key={t}>
                        <code>{t}</code>
                      </li>
                    ))}
                  </ul>
                  <p>
                    Audience dédiée, autorisation serveur, révocation et quotas
                    persistants. La connexion Grok doit encore être vérifiée par
                    une sauvegarde avec UUID relu.
                  </p>
                </details>
                <p>
                  Vous pouvez conserver une proposition Grok manuellement :
                  capturez sa source réelle puis validez vous-même la
                  sauvegarde. Cela ne constitue pas un test Grok → MCP.
                </p>
                <h3>Application Sites existante</h3>
                <p>
                  Elle reste indépendante et inchangée. Aucune référence
                  historique Sites n’est importée par cette migration locale.
                </p>
              </>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
