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
import { useEffect, useState } from "react";
import { CaptureForm, ProjectForm, SignalForm } from "./components/forms";
import { Modal } from "./components/ui";
import {
  activeTasks,
  emptyWorkspace,
  makeReference,
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
  const [modal, setModal] = useState<
    "capture" | "project" | "signal" | "settings" | null
  >(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pendingImport, setPendingImport] = useState<Workspace | null>(null);
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
  const refs = rediscover(data).filter((r) =>
    (r.title + " " + r.content + " " + (r.url || ""))
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase()),
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
              DIRECTION
              <br />
              CRÉATIVE
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
              ESPACE PERSONNEL <span className="meta-divider">/</span>{" "}
              {selected[1].toUpperCase()}
            </span>
            <span className="local-state">
              <span /> Local · Sites non connecté
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
                  data={data}
                  now={now}
                  navigate={navigate}
                  setProjectId={setProjectId}
                  openReference={openReference}
                  setModal={setModal}
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
                          ? "VOTRE MÉMOIRE CRÉATIVE"
                          : route === "explorer"
                            ? "OBSERVER AVANT D’INTERPRÉTER"
                            : "DONNER UNE FORME AUX IDÉES"}
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
                              : "Des directions choisies, à votre rythme."}
                      </p>
                    </div>
                    <button
                      className="primary"
                      onClick={() => {
                        setError("");
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
                            ? "signal"
                            : "signaux"
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
                        refs={refs}
                        expanded={expanded}
                        setExpanded={setExpanded}
                        query={query}
                        data={data}
                        filter={filter}
                        setFilter={setFilter}
                      />
                    )}
                    {route === "explorer" && (
                      <ExplorerView signals={signals} query={query} />
                    )}
                    {route === "projets" && (
                      <ProjectsView
                        project={project}
                        archive={archive}
                        setArchive={setArchive}
                        setProjectId={setProjectId}
                        data={data}
                        commit={commit}
                        act={act}
                        projects={projects}
                        query={query}
                        openReference={openReference}
                      />
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
        <footer className="statusbar">
          <span>A.D / ATELIER PERSONNEL</span>
          <button onClick={() => setModal("settings")}>
            <ShieldCheck size={13} /> Données dans ce navigateur{" "}
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
            defaultProjectId={
              route === "projets" ? projectId || undefined : undefined
            }
            data={data}
            error={error}
            save={(input) => {
              try {
                const reference = makeReference(input, true);
                if (
                  commit(
                    { ...data, references: [...data.references, reference] },
                    `Référence sauvegardée et relue localement · ${reference.id}`,
                  )
                ) {
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
            <p className="local-info">
              Cette reconstruction fonctionne localement. Aucun compte, aucune
              donnée Sites, aucune API xAI et aucune synchronisation ne sont
              connectés.
            </p>
            <h3>Sauvegarde personnelle</h3>
            <p>
              Les données restent dans ce navigateur, sans chiffrement
              applicatif. Exportez une copie avant de changer d’appareil ou
              d’effacer les données du navigateur. Utilisez un appareil de
              confiance.
            </p>
            <div className="backup-actions">
              <button
                onClick={() =>
                  download(
                    fatal
                      ? localStorage.getItem(STORAGE_KEY) || ""
                      : exportBackup(data),
                    "ad-local-backup.json",
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
                    if (commit(pendingImport, "Sauvegarde importée et relue."))
                      setPendingImport(null);
                  }}
                >
                  Confirmer le remplacement
                </button>
                <button onClick={() => setPendingImport(null)}>Annuler</button>
              </div>
            )}
            <h3>
              Grok Scout <span className="connection-badge">Non connecté</span>
            </h3>
            <p>
              Le code et l’authentification de la passerelle Sites ne sont pas
              récupérés. Aucun jeton propriétaire n’est demandé ni réutilisé. La
              connexion distante reste désactivée.
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
                Audience dédiée, autorisation serveur, révocation et quotas à
                vérifier avant toute connexion. Cette liste décrit une règle,
                pas une connexion active.
              </p>
            </details>
            <p>
              Vous pouvez conserver une proposition Grok manuellement : capturez
              sa source réelle puis validez vous-même la sauvegarde. Cela ne
              constitue pas un test Grok → MCP.
            </p>
            <h3>Application Sites existante</h3>
            <p>
              Elle reste indépendante et inchangée. Aucune migration ni
              publication effectuée.
            </p>
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
