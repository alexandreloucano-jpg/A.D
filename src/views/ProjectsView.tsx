import { MarketPanel } from "../scout-market/MarketPanel";
import type { Finding } from "../scout-market/schema";
import type { EvidenceReceipt } from "../opportunity/model";
import { CreativeCanvas } from "../creative/CreativeCanvas";
import { StudioLeadsPanel } from "../marketing/StudioLeadsPanel";
import type { RemoteSaver } from "../remote-saver";
import { ArrowUpRight, Bookmark, Folder } from "lucide-react";
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
      {project ? (
        <>
          {(data.opportunityLinks||[]).filter(link=>link.projectId===project.id).map(link=>(
            <section key={link.id} className="opportunity-room-evidence" aria-label="Preuves de l'opportunité" style={{borderTop:"1px solid #d8d6d1",padding:"18px 0",marginBottom:24}}>
              <p className="eyebrow">RADAR → WORK · {link.status==="LINKED"?"LIEN SERVEUR CONFIRMÉ":"LIEN SERVEUR À REPRENDRE"}</p>
              <h2>{link.companyName}</h2>
              <p><strong>Fait rapporté :</strong> {link.reportedFact}</p>
              <p><strong>Source :</strong> <a href={link.sourceUrl} target="_blank" rel="noreferrer noopener">{link.publisher||"Voir la publication"} ↗</a> · Capturée le {new Date(link.capturedAt).toLocaleDateString("fr-FR")}</p>
              <details>
                <summary>Preuves figées ({link.evidence.length}) et inconnues ({link.unknowns.length})</summary>
                {link.evidence.map(e=><p key={e.id}><a href={e.url} target="_blank" rel="noreferrer noopener">{e.publisher||"Source originale"} ↗</a> — {e.claimSupported}</p>)}
                {link.unknowns.map((u,i)=><p key={i}>À vérifier : {u}</p>)}
              </details>
              {link.status!=="LINKED"&&<p role="status">Le dossier est localement conservé. Retournez sur l'opportunité Radar pour confirmer la liaison au serveur.</p>}
            </section>
          ))}
          <CreativeCanvas key={project.id} project={project} data={data} references={data.references} remote={remote} commit={commit} openReference={openReference} capture={onCapture} />
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
          <h2 className="linked-heading">Références associées</h2>
          {data.references
            .filter((r) => r.projectId === project.id && !r.isInternalQA)
            .map((r) => (
              <button
                key={r.id}
                className="reference-row"
                onClick={() => {
                  openReference(r.id);
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
      ) : (
        <>
          {projects.length ? (
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
              title={query ? "Aucune correspondance." : "Aucun dossier enregistré."}
            >
              {query ? (
                "Modifiez votre recherche ou effacez-la pour revoir vos dossiers."
              ) : (
                <>
                  Commencez par examiner une piste sourcée dans le{" "}
                  <a href="#/explorer">Radar</a>. Le dossier conservera ses preuves et ses inconnues.
                </>
              )}
            </Empty>
          )}

          <details className="work-secondary-panel">
            <summary>Opportunités enregistrées dans le pipeline</summary>
            <MarketPanel mode="pipeline" query={query} projects={data.projects} onOpenDossier={onOpenDossier}/>
          </details>

          {remote.connected && (
            <details className="work-secondary-panel studio-operations-panel">
              <summary>Demandes A.D Studio · activité distincte</summary>
              <StudioLeadsPanel remote={remote} />
            </details>
          )}
        </>
      )}
    </>
  );
}
