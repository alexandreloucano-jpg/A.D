import { useRef, useState } from "react";
import { useScoutMarket } from "./useScoutMarket";
import { marketRequest } from "./client";
import { stages, type Finding, type MarketAction } from "./schema";
import {
  compareFindings,
  homepageFinding,
  existingRelationship,
} from "./qualification";
import "./market.css";
const labels: Record<string, string> = {
  budget_evidence: "Indices de capacité financière",
  funding: "Financement",
  marketing_hire: "Recrutement marketing",
  expansion: "Expansion",
  repositioning: "Repositionnement",
  low: "faible",
  medium: "moyenne",
  high: "élevée",
  discovered: "Découverte",
  qualified: "Qualifiée",
  contact_identified: "Interlocuteur identifié",
  proposal_drafted: "Brouillon préparé",
  contacted: "Contact effectué",
  meeting: "Rendez-vous",
  negotiation: "Négociation",
  won: "Gagnée",
  lost: "Perdue",
  brand_launch: "Lancement de marque",
  store_opening: "Ouverture de boutique",
  product_launch: "Lancement de produit",
  brand_collaboration: "Collaboration",
  major_hire: "Évolution de direction",
  campaign_launch: "Campagne",
  hospitality_renovation: "Rénovation",
  commercial_event: "Événement commercial",
  other_verified_event: "Annonce à qualifier",
  new: "À examiner",
  reviewing: "En cours de revue",
  saved: "En pipeline",
  rejected: "Refusée",
  snoozed: "Reportée",
  unknown: "Non vérifiée",
  existing: "Relation existante",
  cold: "Prospect froid confirmé",
  blocked: "Exclue",
  service_fit: "Adéquation des prestations",
  trigger_strength: "Déclencheur commercial",
  time_relevance: "Actualité",
  creative_opportunity: "Espace créatif",
  decision_maker_access: "Accès au décisionnaire",
  taste_fit: "Préférences Taste confirmées",
};
const label = (v: string) => labels[v] || v;
const date = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("fr-FR") : "Non établie";
export function MarketPanel({
  mode = "explorer",
  query = "",
  projects = [],
}: {
  mode?: "explorer" | "home" | "pipeline";
  query?: string;
  projects?: { id: string; title: string }[];
}) {
  const returnFocus = useRef<HTMLElement | null>(null);
  const m = useScoutMarket(query, mode),
    [view, setView] = useState("Opportunités"),
    [sector, setSector] = useState(""),
    [city, setCity] = useState(""),
    [event, setEvent] = useState(""),
    [confidence, setConfidence] = useState(""),
    [stage, setStage] = useState(""),
    [coverage, setCoverage] = useState(""),
    [days, setDays] = useState("45"),
    [selected, setSelected] = useState<Finding | null>(null),
    [actions, setActions] = useState<MarketAction[]>([]),
    [history, setHistory] = useState<
      { event: string; reason: string | null; occurredAt: string }[]
    >([]),
    [detailError, setDetailError] = useState(""),
    [reason, setReason] = useState(""),
    [draft, setDraft] = useState(""),
    [interaction, setInteraction] = useState(""),
    [nextStage, setNextStage] = useState("qualified"),
    [linkedProject, setLinkedProject] = useState("");
  function closeDetail() {
    setSelected(null);
    requestAnimationFrame(() => returnFocus.current?.focus());
  }
  async function inspect(f: Finding) {
    returnFocus.current = document.activeElement as HTMLElement;
    setDetailError("");
    setSelected(f);
    setReason("");
    setDraft(
      f.nextAction ||
        "Vérifier le calendrier, les prestataires et le besoin créatif pour " +
          f.companyName +
          ".",
    );
    try {
      const detail = await marketRequest<{
        actions: MarketAction[];
        timeline?: typeof history;
      }>("/opportunities/" + f.id);
      setActions(detail.actions);
      setHistory(detail.timeline || []);
    } catch {
      setDetailError(
        "La lecture du détail a échoué. Fermez puis réessayez ; la référence reste conservée.",
      );
      setActions([]);
    }
  }
  async function operation(path: string, body: unknown) {
    if (await m.mutate(path, body)) {
      if (selected) {
        try {
          const detail = await marketRequest<{
            opportunity: Finding;
            actions: MarketAction[];
            timeline?: typeof history;
          }>("/opportunities/" + selected.id);
          setSelected(detail.opportunity);
          setActions(detail.actions);
          setHistory(detail.timeline || []);
        } catch {
          setDetailError(
            "Décision enregistrée ; relecture du détail indisponible. Fermez puis actualisez.",
          );
        }
      }
    }
  }
  const items = (mode === "home" ? m.observations : m.items)
    .filter(
      (f) =>
        (mode !== "pipeline" || f.reviewState === "saved") &&
        (mode !== "home" || homepageFinding(f)) &&
        (view === "Rejetées" || f.relationshipStatus !== "blocked") &&
        (!sector || f.sector === sector) &&
        (!city || f.city === city) &&
        (!event || f.eventType === event) &&
        (!confidence || f.confidence === confidence) &&
        (!stage || f.stage === stage) &&
        (!coverage || f.coverage >= Number(coverage)) &&
        (!f.publishedAt ||
          Date.now() - Date.parse(f.publishedAt) < Number(days) * 86400000) &&
        (mode !== "home" || !["rejected", "snoozed"].includes(f.reviewState)) &&
        (mode === "pipeline"
          ? true
          : view === "Rejetées"
            ? f.reviewState === "rejected" || f.relationshipStatus === "blocked"
            : view === "Enregistrées"
              ? f.reviewState === "saved"
              : view === "À vérifier"
                ? f.classification === "commercial" &&
                  f.qualification === "verify"
                : view === "Opportunités"
                  ? f.classification === "commercial" &&
                    !["rejected", "snoozed"].includes(f.reviewState)
                  : view === "Signaux culturels"
                    ? f.classification === "cultural" &&
                      !["rejected", "snoozed"].includes(f.reviewState)
                    : !["rejected", "snoozed"].includes(f.reviewState)),
    )
    .sort(compareFindings);
  const displayed =
    mode === "home" || (mode === "explorer" && view === "Opportunités")
      ? items.slice(0, 5)
      : items;
  if (mode === "home" && !m.status?.enabled) return null;
  if (!m.loading && !m.status?.enabled)
    return mode === "home" ? null : (
      <section className="market-unavailable" aria-label="Radar marché">
        <p>
          {m.error || "Radar privé non activé."}{" "}
          <a href="/api/auth/google/login">Se connecter à A.D</a>
        </p>
      </section>
    );
  return (
    <section
      className={"market-panel market-" + mode}
      aria-label={mode === "home" ? "Le marché aujourd’hui" : "Radar marché"}
    >
      <header className="market-heading">
        <div>
          <p className="eyebrow">
            {mode === "home"
              ? "LE MARCHÉ AUJOURD’HUI"
              : mode === "pipeline"
                ? "PIPELINE PRIVÉ"
                : "RADAR · BUSINESS CRÉATIF"}
          </p>
          <h2>
            {mode === "home"
              ? "À examiner."
              : mode === "pipeline"
                ? "Opportunités enregistrées"
                : "Où créer de la valeur."}
          </h2>
        </div>
        {mode === "explorer" && m.status?.enabled && (
          <button disabled={m.busy} onClick={() => void m.runScan()}>
            {m.busy
              ? "Collecte en cours…"
              : m.status.lastRun?.paused
                ? "Reprendre le scan"
                : "Lancer un scan manuel"}
          </button>
        )}
      </header>
      {m.error && (
        <p role="alert">
          {m.error} <button onClick={() => void m.refresh()}>Actualiser</button>
        </p>
      )}
      {m.loading && <p role="status">Lecture du radar privé…</p>}
      {m.status && !m.status.enabled && (
        <p>
          Le radar n’est pas activé. Vos observations locales restent
          disponibles.
        </p>
      )}
      {m.status?.enabled && mode !== "home" && (
        <details className="market-scan-details">
          <summary>
            {m.items.filter((f) => f.classification === "commercial").length}{" "}
            opportunités ·{" "}
            {m.items.filter((f) => f.classification === "cultural").length}{" "}
            signaux culturels ·{" "}
            {m.status.lastRun?.status === "partial"
              ? "scan partiel"
              : m.status.lastRun?.status === "failed"
                ? "scan en erreur"
                : "suivi du scan"}
          </summary>
          <p className="market-meta">
            {m.status.sourceCount} source publique · IA désactivée · aucune
            dépense ni prospection automatique.
            <br />
            {m.status.lastRun
              ? `${m.status.lastRun.status === "partial" ? "Scan partiel" : m.status.lastRun.status === "failed" ? "Scan en erreur" : "Dernier scan"} · ${m.status.lastRun.itemsSeen} pages examinées · ${m.status.lastRun.insertedCount} signaux ajoutés · ${date(m.status.lastRun.finishedAt)}${m.status.lastRun.paused ? " · reprise disponible" : ""}`
              : "Aucun scan effectué."}
            {m.status.lastRun?.failures.length
              ? ` · ${m.status.lastRun.failures.length} échec(s) de source`
              : ""}
            {m.status.stale ? " · résultats à actualiser" : ""}
          </p>
        </details>
      )}
      {mode === "explorer" && m.sources.length > 0 && (
        <details className="market-source-registry">
          <summary>Sources et état réel des connexions</summary>
          {(["commercial", "strategic"] as const).map((purpose) => (
            <section key={purpose}>
              <h3>
                {purpose === "commercial"
                  ? "Détection commerciale"
                  : "Intelligence stratégique / Taste"}
              </h3>
              {m.sources
                .filter((s) => s.purpose === purpose)
                .map((s) => (
                  <article key={s.id}>
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {s.name} ↗
                    </a>
                    <strong>
                      {" "}
                      ·{" "}
                      {s.connected
                        ? "Collecte et extraction confirmées"
                        : s.enabled
                          ? "Collecteur activé · extraction non confirmée"
                          : s.accessStatus === "permission_required"
                            ? "Autorisation nécessaire"
                            : s.accessStatus === "endpoint_unverified"
                              ? "Adresse / accès non vérifié"
                              : "Référence · non connectée"}
                    </strong>
                    <p>{s.accessNote}</p>
                    {s.lastIngestedAt && (
                      <p>
                        Dernière extraction persistée : {date(s.lastIngestedAt)}
                      </p>
                    )}
                  </article>
                ))}
            </section>
          ))}
          <p>
            Aucune référence stratégique ne confirme automatiquement une
            préférence Taste.
          </p>
        </details>
      )}
      {mode === "explorer" && (
        <>
          <nav aria-label="Sections du radar" className="market-tabs">
            {[
              "Opportunités",
              "Signaux culturels",
              "À vérifier",
              "Enregistrées",
              "Rejetées",
            ].map((v) => (
              <button
                aria-pressed={view === v}
                onClick={() => setView(v)}
                key={v}
              >
                {v}
              </button>
            ))}
          </nav>
          <details>
            <summary>Filtrer le marché</summary>
            <div className="market-filters">
              {[
                {
                  label: "Secteur",
                  value: sector,
                  set: setSector,
                  options: [...new Set(m.items.map((f) => f.sector))],
                },
                {
                  label: "Zone",
                  value: city,
                  set: setCity,
                  options: ["Paris"],
                },
                {
                  label: "Type de signal",
                  value: event,
                  set: setEvent,
                  options: [...new Set(m.items.map((f) => f.eventType))],
                },
                {
                  label: "Confiance",
                  value: confidence,
                  set: setConfidence,
                  options: ["low", "medium", "high"],
                },
                {
                  label: "Étape",
                  value: stage,
                  set: setStage,
                  options: [...stages],
                },
                {
                  label: "Couverture minimale",
                  value: coverage,
                  set: setCoverage,
                  options: ["0.6", "0.8", "1"],
                },
              ].map((f) => (
                <label key={f.label}>
                  {f.label}
                  <select
                    value={f.value}
                    onChange={(e) => f.set(e.target.value)}
                  >
                    <option value="">Tout</option>
                    {f.options.map((o) => (
                      <option key={o} value={o}>
                        {label(o)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <label>
                Période
                <select value={days} onChange={(e) => setDays(e.target.value)}>
                  <option value="7">7 jours</option>
                  <option value="30">30 jours</option>
                  <option value="45">45 jours</option>
                </select>
              </label>
            </div>
          </details>
        </>
      )}
      {mode === "home" && m.actions[0] && (
        <p>PROCHAINE ACTION · NOW acceptée : {m.actions[0].proposalText}</p>
      )}
      <div className="market-findings">
        {displayed.map((f) => (
          <article className="market-finding" key={f.id}>
            <span className="eyebrow">
              {f.companyName} · {f.city || "Zone à vérifier"}
            </span>
            <p className="market-meta">
              {f.classification === "commercial"
                ? "OPPORTUNITÉ COMMERCIALE"
                : "SIGNAL CULTUREL / TREND"}
              {f.relationshipStatus === "existing"
                ? " · relation existante"
                : ""}
              {f.arrondissement ? " · " + f.arrondissement : ""}
              {f.qualification === "verify"
                ? " · à qualifier"
                : f.qualification === "past"
                  ? " · événement passé"
                  : ""}
            </p>
            <h3>{f.headline}</h3>
            <p>{f.whyNow}</p>
            {f.classification === "commercial" && (
              <>
                <p>{f.potentialNeed}</p>
                <p className="market-next">
                  <strong>À examiner :</strong> {f.nextAction}
                </p>
              </>
            )}
            <p className="market-meta">
              Rapporté · {f.publisher} · publié le {date(f.publishedAt)} · fait
              : {date(f.eventDate)} · collecté le {date(f.firstSeenAt)}
              <br />
              {label(f.eventType)} · {f.sourceCount} source · confiance{" "}
              {label(f.confidence)} · {label(f.reviewState)}
              <br />
              Score documenté{" "}
              {f.score === null ? "à vérifier" : f.score + "/100"} · couverture{" "}
              {Math.round(f.coverage * 100)} % · aucune probabilité de
              signature.
            </p>
            <a href={f.canonicalUrl} target="_blank" rel="noreferrer">
              Source originale ↗
            </a>{" "}
            <button onClick={() => void inspect(f)}>Examiner</button>
          </article>
        ))}
      </div>
      {items.length > displayed.length && (
        <p className="market-meta">
          Les cinq premières opportunités sont priorisées. Les filtres
          permettent de cibler un autre secteur ou événement.
        </p>
      )}
      {!m.loading && m.status?.enabled && !items.length && (
        <p>
          Aucune opportunité suffisamment qualifiée dans cette sélection.
          Consultez les signaux culturels ou actualisez les sources.{" "}
          {m.status.lastRun
            ? "Les résultats précédents restent conservés."
            : "Lancez une collecte publique."}
        </p>
      )}
      {selected && (
        <div
          className="market-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={"Examiner " + selected.companyName}
          onKeyDown={(e) => {
            if (e.key === "Escape") closeDetail();
            if (e.key === "Tab") {
              const nodes = e.currentTarget.querySelectorAll<HTMLElement>(
                "button:not(:disabled),a[href],select:not(:disabled),textarea:not(:disabled),input:not(:disabled)",
              );
              const first = nodes[0],
                last = nodes[nodes.length - 1];
              if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last?.focus();
              } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first?.focus();
              }
            }
          }}
        >
          <div className="market-detail">
            {m.error && <p role="alert">{m.error}</p>}
            {detailError && <p role="alert">{detailError}</p>}
            <button autoFocus onClick={closeDetail}>
              Fermer
            </button>
            <h2>{selected.companyName}</h2>
            <h3>Faits et preuves</h3>
            <p>{selected.reportedFact}</p>
            <blockquote>{selected.excerpt}</blockquote>
            <a href={selected.canonicalUrl} target="_blank" rel="noreferrer">
              Rapporté par {selected.publisher} ↗
            </a>
            <p>
              Publié : {date(selected.publishedAt)} · Fait :{" "}
              {date(selected.eventDate)} · Collecté :{" "}
              {date(selected.firstSeenAt)}
            </p>
            <h3>Pourquoi maintenant</h3>
            <p>{selected.whyNow}</p>
            <h3>Hypothèse commerciale</h3>
            <p>{selected.potentialNeed}</p>
            <p>Prestations envisageables : {selected.services.join(", ")}</p>
            <p>{selected.creativeAngle}</p>
            <p>
              {selected.budgetBasis ||
                "Budget créatif non établi ; aucun montant inventé."}
            </p>
            <h3>Interlocuteur à qualifier</h3>
            <p>
              {selected.contactApproach?.department ||
                "Aucun interlocuteur identifié."}{" "}
              ·{" "}
              {selected.contactApproach?.basis === "reported_role"
                ? "fonction citée dans la source ; accessibilité non vérifiée"
                : "hypothèse de service à approcher, aucun contact personnel vérifié"}
            </p>
            <h3>Prochaine action à examiner</h3>
            <p>{selected.nextAction}</p>
            <h3>Questions inconnues</h3>
            <ul>
              {selected.knownUnknowns.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
            <h3>Scoring et justification</h3>
            {Object.entries(selected.factors).map(([key, f]) => (
              <p key={key}>
                {label(key)} : {f.value ?? "inconnu"} · {f.reason}
              </p>
            ))}
            <h3>Historique de décision</h3>
            {history.length ? (
              history.map((h, i) => (
                <p key={i}>
                  {date(h.occurredAt)} · {label(h.event)} ·{" "}
                  {h.reason || "Décision conservée."}
                </p>
              ))
            ) : (
              <p>Aucune décision enregistrée.</p>
            )}
            <h3>Décision humaine</h3>
            <label>
              Motif / notes
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <div className="market-buttons">
              {[
                ["save", "Sauvegarder en pipeline"],
                ["reject", "Refuser"],
                ["snooze", "Reporter"],
                ["reopen", "Réexaminer"],
              ].map(([decision, label]) => (
                <button
                  disabled={m.busy}
                  key={decision}
                  onClick={() =>
                    void operation(
                      "/opportunities/" + selected.id + "/review",
                      { decision, ...(reason ? { reason } : {}) },
                    )
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <h3>Associer un projet existant</h3>
            {projects.length ? (
              <label>
                Projet
                <select
                  value={linkedProject}
                  onChange={(e) => setLinkedProject(e.target.value)}
                >
                  <option value="">Choisir un dossier</option>
                  {projects.map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
                <button
                  disabled={
                    m.busy || !linkedProject || selected.reviewState !== "saved"
                  }
                  onClick={() =>
                    void operation(
                      "/opportunities/" + selected.id + "/project",
                      { projectId: linkedProject, humanApproval: true },
                    )
                  }
                >
                  Associer après sauvegarde en pipeline
                </button>
              </label>
            ) : (
              <p>
                Créez d’abord un dossier dans Projets pour l’associer. Le
                pipeline est déjà conservé côté serveur.
              </p>
            )}
            {selected.projectId && (
              <p>
                Projet associé ·{" "}
                {projects.find((p) => p.id === selected.projectId)?.title ||
                  "dossier lié"}
              </p>
            )}
            <h3>Relation et exclusions</h3>
            <p>
              Relation : {label(selected.relationshipStatus || "unknown")}.
              {existingRelationship(selected.companyName)
                ? "Relation existante déclarée par vous : aucune approche à froid."
                : "Aucune relation existante n’est déduite automatiquement."}
            </p>
            <div className="market-buttons">
              {[
                ["unknown", "Réinclure / relation inconnue"],
                ["existing", "Relation existante"],
                ["cold", "Prospect froid confirmé"],
                ["blocked", "Exclure cette entreprise"],
              ].map(([status, label]) => (
                <button
                  disabled={
                    m.busy ||
                    (existingRelationship(selected.companyName) &&
                      status !== "existing" &&
                      status !== "blocked")
                  }
                  key={status}
                  onClick={() =>
                    void operation(
                      "/companies/" + selected.companyId + "/relationship",
                      { status, humanApproval: true },
                    )
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <h3>Approche · brouillon privé</h3>
            <textarea
              aria-label="Brouillon d’approche"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button
              disabled={m.busy}
              onClick={() =>
                void operation(
                  "/opportunities/" + selected.id + "/draft-action",
                  {
                    actionText: draft,
                    sourceEvidenceIds: [selected.evidenceId],
                  },
                )
              }
            >
              Conserver une proposition LATER
            </button>
            {actions.map((a) => (
              <div key={a.id}>
                <p>
                  {a.lane} · {a.proposalText}
                </p>
                {a.lane === "LATER" && (
                  <button
                    disabled={m.busy}
                    onClick={() =>
                      void operation("/actions/" + a.id + "/accept", {
                        humanApproval: true,
                      })
                    }
                  >
                    J’accepte cette action NOW
                  </button>
                )}
                <button
                  disabled={m.busy}
                  onClick={() =>
                    void operation(
                      "/actions/" +
                        a.id +
                        (a.lane === "KILL" ? "/restore" : "/archive"),
                      { humanApproval: true },
                    )
                  }
                >
                  {a.lane === "KILL" ? "Restaurer dans LATER" : "Écarter"}
                </button>
              </div>
            ))}
            <h3>Interaction réellement effectuée</h3>
            <label>
              Étape
              <select
                value={nextStage}
                onChange={(e) => setNextStage(e.target.value)}
              >
                {stages.map((s) => (
                  <option key={s} value={s}>
                    {label(s)}
                  </option>
                ))}
              </select>
            </label>
            <textarea
              aria-label="Preuve de l’interaction"
              value={interaction}
              onChange={(e) => setInteraction(e.target.value)}
            />
            <button
              disabled={m.busy || interaction.trim().length < 5}
              onClick={() =>
                void operation("/opportunities/" + selected.id + "/advance", {
                  stage: nextStage,
                  occurredAt: new Date().toISOString(),
                  confirmation: true,
                  evidence: interaction,
                })
              }
            >
              Confirmer l’événement effectué
            </button>
            <p>
              Aucun message n’est envoyé. Aucune préférence Taste n’est
              modifiée.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
