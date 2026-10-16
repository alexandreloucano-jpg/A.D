import { MarketPanel } from "../scout-market/MarketPanel";
import { ArrowUpRight, ArrowRight, Folder, Link, Plus } from "lucide-react";
import { dateLabel, type Route } from "../display";
import { rediscover, type Task, type Workspace } from "../domain";
export function HomeView({
  data,
  now,
  navigate,
  setProjectId,
  openReference,
  setModal,
}: {
  data: Workspace;
  now: Task[];
  navigate: (route: Route) => void;
  setProjectId: (id: string | null) => void;
  openReference: (id: string) => void;
  setModal: (value: "project") => void;
}) {
  const currentProject = now.length
    ? data.projects.find((p) => p.id === now[0].projectId)
    : undefined;
  return (
    <div className="home-layout">
      <section className={"home-focus" + (now.length ? " has-priority" : "")}>
        <p className="eyebrow">L’INTENTION AVANT L’ACTION</p>
        {now.length > 0 && (
          <span className="priority-label">NOW · ACCEPTÉ PAR VOUS</span>
        )}
        {currentProject && (
          <button
            className="priority-project"
            onClick={() => {
              navigate("projets");
              setProjectId(currentProject.id);
            }}
          >
            <Folder size={16} />
            <span>{currentProject.title}</span>
            <ArrowUpRight size={15} />
          </button>
        )}
        <h1>
          {now.length ? (
            <>{now[0].title}</>
          ) : (
            <>
              Sur quoi veux-tu
              <br />
              <em>avancer ?</em>
            </>
          )}
        </h1>
        {now[0]?.acceptedAt && (
          <p className="priority-date">
            Votre décision du {dateLabel(now[0].acceptedAt)}
          </p>
        )}
        <p className="intro">
          {now.length
            ? "Une direction choisie par vous. Le reste peut attendre."
            : "Rassembler les idées. Choisir une direction.\nFaire de la place à ce qui compte."}
        </p>
        <button
          className="primary"
          onClick={() => {
            navigate("projets");
            if (now.length) setProjectId(now[0].projectId);
          }}
        >
          {now.length ? "Continuer le projet" : "Choisir un projet"}
          <ArrowUpRight size={18} />
        </button>
        <div className="home-note">
          <ArrowRight className="small-cross" aria-hidden="true" size={19} />
          <p>
            {data.tasks.filter((t) => t.lane === "LATER").length
              ? `${data.tasks.filter((t) => t.lane === "LATER").length} idée${data.tasks.filter((t) => t.lane === "LATER").length > 1 ? "s" : ""} à examiner. Rien d’imposé.`
              : "Aucune priorité imposée. Vous gardez la main."}
          </p>
        </div>
      </section>
      <aside className="home-rail">
        <MarketPanel mode="home" />
        <section>
          <div className="section-label">
            <h2>Dossiers récents</h2>
            <button
              aria-label="Voir les projets"
              onClick={() => navigate("projets")}
            >
              <ArrowUpRight size={19} />
            </button>
          </div>
          {data.projects.length ? (
            data.projects
              .slice()
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
              .slice(0, 3)
              .map((p, i) => (
                <button
                  className="project-row"
                  data-current={p.id === currentProject?.id}
                  key={p.id}
                  onClick={() => {
                    navigate("projets");
                    setProjectId(p.id);
                  }}
                >
                  <span className="row-index">0{i + 1}</span>
                  <span>
                    {p.title}
                    <small>
                      {p.id === currentProject?.id
                        ? "Projet de votre action NOW"
                        : dateLabel(p.updatedAt)}
                    </small>
                  </span>
                  <ArrowUpRight size={17} />
                </button>
              ))
          ) : (
            <div className="rail-empty">
              <Folder size={24} strokeWidth={1} />
              <h3>Votre prochain chapitre.</h3>
              <p>Créez un premier dossier pour donner un cadre à vos idées.</p>
              <button
                className="text-button"
                onClick={() => setModal("project")}
              >
                Créer un projet <Plus size={15} />
              </button>
            </div>
          )}
        </section>
        <section>
          <div className="section-label">
            <h2>Dans votre bibliothèque</h2>
            <span>{rediscover(data).length.toString().padStart(2, "0")}</span>
          </div>
          {rediscover(data).length ? (
            rediscover(data)
              .slice(-2)
              .reverse()
              .map((r) => (
                <button
                  key={r.id}
                  className="reference-row"
                  onClick={() => {
                    openReference(r.id);
                  }}
                >
                  <Link size={18} />
                  <span>
                    {r.title}
                    <small>
                      {r.origin === "grok"
                        ? "Grok · source validée"
                        : "Capture personnelle"}
                    </small>
                  </span>
                  <ArrowUpRight size={17} />
                </button>
              ))
          ) : (
            <p className="rail-copy">
              Un lien, une phrase, une intuition.
              <br />
              Gardez ce qui mérite de rester.
            </p>
          )}
        </section>
      </aside>
      <div className="home-bottom">
        <span>CAPTURER → COMPRENDRE → CHOISIR</span>
        <span>UN ESPACE À VOUS.</span>
      </div>
    </div>
  );
}
