import { MarketPanel } from "../scout-market/MarketPanel";
import type { Finding } from "../scout-market/schema";
import type { EvidenceReceipt } from "../opportunity/model";
import { WorkRoom } from "../work/WorkRoom";
import type { RemoteSaver } from "../remote-saver";
import { ArrowUpRight, Folder } from "lucide-react";
import { TaskForm } from "../components/forms";
import { Empty } from "../components/ui";
import { dateLabel } from "../display";
import { newTask, type Task, type Workspace } from "../domain";
export function ProjectsView({
  project,
  archive,
  setArchive,
  setProjectId,
  data,
  commit,
  act,
  projects,
  query,
  openReference,
  remote,
  onCapture,
  onOpenDossier,
}: {
  project: Workspace["projects"][number] | undefined;
  archive: boolean;
  setArchive: (v: boolean) => void;
  setProjectId: (id: string | null) => void;
  data: Workspace;
  commit: (data: Workspace, message: string) => boolean;
  act: (task: Task, action: "accept" | "archive" | "restore") => void;
  projects: Workspace["projects"];
  query: string;
  openReference: (id: string) => void;
  remote: RemoteSaver;
  onCapture: () => void;
  onOpenDossier:(finding:Finding,evidence:EvidenceReceipt[])=>Promise<void>;
}) {
  const acceptedCount = (id: string) =>
    data.tasks.filter((t) => t.projectId === id && t.lane === "NOW").length;
  const laterCount = (id: string) =>
    data.tasks.filter((t) => t.projectId === id && t.lane === "LATER").length;
  return (
    <>
      {!project && (
        <MarketPanel mode="pipeline" query={query} projects={data.projects} onOpenDossier={onOpenDossier}/>
      )}
      {project ? (
        <>
          <WorkRoom key={project.id} project={project} data={data} remote={remote}
            commit={commit} openReference={openReference} capture={onCapture}>
          <div className="project-controls">
            <h2>{archive ? "Actions écartées" : "Actions du projet"}</h2>
            <button
              className="text-button"
              onClick={() => setArchive(!archive)}
            >
              {archive ? "Voir les actions" : "Archives"} (
              {
                data.tasks.filter(
                  (t) => t.projectId === project.id && t.lane === "KILL",
                ).length
              }
              )
            </button>
          </div>
          {!archive && (
            <TaskForm
              key={project.id}
              projectId={project.id}
              add={(title) =>
                commit(
                  {
                    ...data,
                    tasks: [...data.tasks, newTask(project.id, title)],
                    projects: data.projects.map((p) =>
                      p.id === project.id
                        ? {
                            ...p,
                            updatedAt: new Date().toISOString(),
                          }
                        : p,
                    ),
                  },
                  "Suggestion conservée dans LATER. Aucune priorité créée.",
                )
              }
            />
          )}
          {archive &&
            !data.tasks.some(
              (t) => t.projectId === project.id && t.lane === "KILL",
            ) && (
              <p className="inline-empty">
                Aucune action écartée. Vos archives restent récupérables ici.
              </p>
            )}
          <div className="task-list">
            {data.tasks
              .filter(
                (t) =>
                  t.projectId === project.id &&
                  (archive ? t.lane === "KILL" : t.lane !== "KILL"),
              )
              .map((t) => (
                <article className="task-row" key={t.id}>
                  <div>
                    <span className="task-lane">
                      {t.lane === "NOW"
                        ? "NOW · ACCEPTÉ"
                        : t.lane === "LATER"
                          ? "LATER · À EXAMINER"
                          : "KILL · ÉCARTÉ"}
                    </span>
                    <h3>{t.title}</h3>
                  </div>
                  <div className="task-actions">
                    {t.lane === "LATER" && (
                      <button
                        className="small-primary"
                        onClick={() => act(t, "accept")}
                      >
                        Accepter dans NOW
                      </button>
                    )}
                    {t.lane !== "KILL" ? (
                      <button
                        className="text-button"
                        onClick={() => act(t, "archive")}
                      >
                        Écarter
                      </button>
                    ) : (
                      <button
                        className="text-button"
                        onClick={() => act(t, "restore")}
                      >
                        Restaurer dans LATER
                      </button>
                    )}
                  </div>
                </article>
              ))}
          </div>
          </WorkRoom>
        </>
      ) : projects.length ? (
        <div className="project-grid">
          {projects.map((p, i) => (
            <button
              className="project-card"
              key={p.id}
              onClick={() => {
                setProjectId(p.id);
                setArchive(false);
              }}
            >
              <div>
                <span className="row-index">
                  DOSSIER / {(i + 1).toString().padStart(2, "0")}
                </span>
                <Folder size={21} strokeWidth={1.3} />
              </div>
              <h2>{p.title}</h2>
              <div className="project-progress">
                <span>
                  {acceptedCount(p.id) === 0 ? (
                    "Aucune action acceptée"
                  ) : (
                    <>
                      <strong>{acceptedCount(p.id)}</strong>
                      {acceptedCount(p.id) === 1
                        ? "action acceptée"
                        : "actions acceptées"}
                    </>
                  )}
                </span>
                <span>
                  <strong>{laterCount(p.id)}</strong>
                  {laterCount(p.id) === 1
                    ? "idée à examiner"
                    : "idées à examiner"}
                </span>
              </div>
              <div className="project-card-footer">
                <time>{dateLabel(p.updatedAt)}</time>
                <span>
                  Ouvrir le dossier <ArrowUpRight size={16} />
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <Empty
          icon={<Folder size={30} strokeWidth={1} />}
          title={
            query
              ? "Aucune correspondance."
              : "Aucun dossier enregistré."
          }
        >
          Créez un dossier pour y conserver vos actions et références.
        </Empty>
      )}
    </>
  );
}
