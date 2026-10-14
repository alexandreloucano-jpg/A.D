import { ArrowUpRight, Bookmark, Folder } from "lucide-react";
import { TaskForm } from "../components/forms";
import { Empty } from "../components/ui";
import { dateLabel, type Route } from "../display";
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
  navigate,
  setExpanded,
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
  navigate: (route: Route) => void;
  setExpanded: (id: string | null) => void;
}) {
  return project ? (
    <>
      <div className="project-controls">
        <h2>{archive ? "Actions écartées" : "Actions du projet"}</h2>
        <button className="text-button" onClick={() => setArchive(!archive)}>
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
      <h2 className="linked-heading">Références associées</h2>
      {data.references
        .filter((r) => r.projectId === project.id && !r.isInternalQA)
        .map((r) => (
          <button
            key={r.id}
            className="reference-row"
            onClick={() => {
              navigate("saver");
              setExpanded(r.id);
            }}
          >
            <Bookmark size={17} />
            <span>{r.title}</span>
            <ArrowUpRight size={16} />
          </button>
        ))}
      {!data.references.some((r) => r.projectId === project.id) && (
        <p className="muted">
          Associez une référence à ce dossier lors de sa capture.
        </p>
      )}
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
            <ArrowUpRight size={21} />
          </div>
          <h2>{p.title}</h2>
          <p>
            {
              data.tasks.filter((t) => t.projectId === p.id && t.lane === "NOW")
                .length
            }{" "}
            action(s) acceptée(s) ·{" "}
            {
              data.tasks.filter(
                (t) => t.projectId === p.id && t.lane === "LATER",
              ).length
            }{" "}
            à examiner
          </p>
          <time>{dateLabel(p.updatedAt)}</time>
        </button>
      ))}
    </div>
  ) : (
    <Empty
      icon={<Folder size={30} strokeWidth={1} />}
      title={
        query
          ? "Aucune correspondance."
          : "Une direction commence par un dossier."
      }
    >
      Créez un projet. Les idées resteront à examiner jusqu’à votre décision.
    </Empty>
  );
}
