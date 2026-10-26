import { useEffect, useMemo, useRef, useState } from "react";
import { useScoutMarket, type MarketFilters } from "./useScoutMarket";
import { marketRequest } from "./client";
import { MarketTimeline } from "./MarketTimeline";
import { evidenceReceiptSchema, type EvidenceReceipt } from "../opportunity/model";
import { stages, type Finding, type MarketAction } from "./schema";
import {
  compareFindings,
  existingRelationship,
} from "./qualification";
import "./market.css";
const labels: Record<string, string> = {
  budget_evidence: "Indices de capacité financière",
  funding: "Financement",
  marketing_hire: "Recrutement marketing",
  expansion: "Expansion",
  repositioning: "Repositionnement",
  public_excerpt_verified: "extrait public vérifié",
  public_listing_verified: "page publique vérifiée",
  historical_source_receipt: "preuve historique conservée",
  permission_required: "autorisation de l’éditeur nécessaire",
  access_blocked: "accès bloqué",
  market_source_http_403: "accès refusé par la source (403)",
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
  onOpenDossier,
}: {
  mode?: "explorer" | "home" | "pipeline";
  query?: string;
  projects?: { id: string; title: string }[];
  onOpenDossier?: (finding: Finding, evidence: EvidenceReceipt[]) => Promise<void>;
}) {
  const returnFocus = useRef<HTMLElement | null>(null);
  const [view, setView] = useState("Nouveaux clients");
  const [reviewFilter, setReviewFilter] = useState("active");
  const [showAll, setShowAll] = useState(false);
  const [referenceFilter, setReferenceFilter] = useState("");
  const [sector, setSector] = useState("");
  const [city, setCity] = useState("");
  const [event, setEvent] = useState("");
  const [confidence, setConfidence] = useState("");
  const [stage, setStage] = useState("");
  const [coverage, setCoverage] = useState("");
  const [days, setDays] = useState("45");
  const serverFilters = useMemo<MarketFilters>(() => ({
    classification: mode !== "explorer"
      ? undefined
      : view === "Nouveaux clients"
        ? "commercial"
        : view === "Analyses stratégiques"
          ? "strategic"
          : view === "Signaux culturels"
            ? "cultural"
            : view === "Recherche manuelle"
              ? "research"
              : undefined,
    status: mode === "explorer" && ["new", "reviewing", "saved", "snoozed"].includes(reviewFilter)
      ? reviewFilter
      : undefined,
    qualification: mode === "explorer" && reviewFilter === "verify" ? "verify" : undefined,
    activeOnly: reviewFilter === "active",
    sector,
    city,
    eventType: event,
    confidence,
    stage,
    minCoverage: coverage,
    days,
  }), [mode, view, reviewFilter, sector, city, event, confidence, stage, coverage, days]);
  const m = useScoutMarket(query, mode, serverFilters);
  const [selected, setSelected] = useState<Finding | null>(null),
    [actions, setActions] = useState<MarketAction[]>([]),
    [history, setHistory] = useState<
      { event: string; reason: string | null; occurredAt: string }[]
    >([]),
    [detailError, setDetailError] = useState(""),
    [reason, setReason] = useState(""),
    [draft, setDraft] = useState(""),
    [interaction, setInteraction] = useState(""),
    [nextStage, setNextStage] = useState("qualified"),
    [linkedProject, setLinkedProject] = useState(""),
    [verifiedEvidence, setVerifiedEvidence] = useState<EvidenceReceipt[]>([]),
    [openingDossier, setOpeningDossier] = useState(false);
  useEffect(() => setShowAll(false), [query, view, reviewFilter, sector, city, event, confidence, stage, coverage, days, referenceFilter]);
  function closeDetail() {
    setSelected(null);
    requestAnimationFrame(() => returnFocus.current?.focus());
  }
  async function inspect(f: Finding) {
    returnFocus.current = document.activeElement as HTMLElement;
    setDetailError("");
    setSelected(f);
    setReason("");
    setVerifiedEvidence([]);
    setDraft(
      f.nextAction ||
        "Vérifier le calendrier, les prestataires et le besoin créatif pour " +
          f.companyName +
          ".",
    );
    try {
      const detail = await marketRequest<{
        actions: MarketAction[];
        evidence?: unknown[];
        timeline?: typeof history;
      }>("/opportunities/" + f.id);
      setActions(detail.actions);
      setVerifiedEvidence((detail.evidence||[]).flatMap(raw=>{
        const parsed=evidenceReceiptSchema.safeParse(raw);
        return parsed.success?[parsed.data]:[];
      }));
      setHistory(detail.timeline || []);
    } catch {
      setDetailError(
        "La lecture du détail a échoué. Fermez puis réessayez ; la référence reste conservée.",
      );
      setActions([]);
      setVerifiedEvidence([]);
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
  const items = m.items
    .filter(
      (f) =>
        (mode !== "pipeline" || f.reviewState === "saved") &&
        (mode !== "home" ||
          (f.classification === "commercial"
            ? !["reference_only", "past", "cultural"].includes(f.lookalike?.gate || "") &&
              !f.sourceError && f.relationshipStatus !== "blocked"
            : f.classification === "strategic" || f.classification === "cultural")) &&
        (reviewFilter === "rejected" || reviewFilter === "all" || f.relationshipStatus !== "blocked") &&
        (!sector || f.sector === sector) &&
        (!referenceFilter || f.lookalike?.archetype === referenceFilter) &&
        (!city || f.city === city) &&
        (!event || f.eventType === event) &&
        (!confidence || f.confidence === confidence) &&
        (!stage || f.stage === stage) &&
        (!coverage || f.coverage >= Number(coverage)) &&
        ((f.eventDate &&
          Date.parse(f.eventDate) >= Date.now() - 14 * 86400000) ||
          !f.publishedAt ||
          Date.now() - Date.parse(f.publishedAt) < Number(days) * 86400000) &&
        (mode !== "home" || !["rejected", "snoozed"].includes(f.reviewState)) &&
        (reviewFilter === "active" || reviewFilter === "all" ||
          (reviewFilter === "watchlist"
            ? f.lookalike?.gate === "lookalike_watchlist"
            : reviewFilter === "verify"
              ? f.qualification === "verify"
              : reviewFilter === "rejected"
                ? f.reviewState === "rejected" || f.relationshipStatus === "blocked"
                : f.reviewState === reviewFilter)) &&
        (mode === "home" || reviewFilter !== "active" || !["rejected", "snoozed"].includes(f.reviewState)) &&
        (mode === "home"
          ? true
          : mode === "pipeline"
            ? true
            : view === "Tous les signaux"
              ? true
              : view === "Nouveaux clients"
                ? f.classification === "commercial" &&
                  !["reference_only", "cultural", "past"].includes(f.lookalike?.gate || "")
                : view === "Analyses stratégiques"
                  ? f.classification === "strategic"
                  : view === "Recherche manuelle"
                    ? f.classification === "research"
                    : view === "Signaux culturels"
                      ? f.classification === "cultural"
                      : true),
    )
    .sort(compareFindings);
  const refined = !!query.trim() || !!sector || !!city || !!event || !!confidence || !!stage || !!coverage || days !== "45" || !!referenceFilter || reviewFilter !== "active";
  const displayed = mode === "home"
    ? items
    : mode === "explorer" && view === "Nouveaux clients" && !refined && !showAll
      ? items.slice(0, 5)
      : items;
  const commercialRows = displayed.filter((finding) => finding.classification === "commercial");
  const newsRows = displayed.filter(
    (finding) => finding.classification === "strategic" || finding.classification === "cultural",
  );
  const homeGroups = [
    {
      title: "Radar",
      rows: commercialRows.slice(0, 3),
      total: commercialRows.length,
      label: "PISTE COMMERCIALE",
    },
    {
      title: "Actualités",
      rows: newsRows.slice(0, 3),
      total: newsRows.length,
      label: "CONTEXTE",
    },
  ];
  if (mode === "home" && (m.loading || !m.status?.enabled))
    return (
      <section
        className="market-panel market-home"
        aria-label="Le marché aujourd’hui"
      >
        <header className="market-heading">
          <h2>Radar & actualités</h2>
        </header>
        <div className="market-home-state" aria-live="polite">
          <p>
            {m.loading
              ? "Chargement du Radar…"
              : m.error || "Radar privé non activé. Les données locales restent conservées."}
          </p>
          {!m.loading && <a href="/api/auth/login">Se connecter à A.D</a>}
        </div>
      </section>
    );
  if (!m.loading && !m.status?.enabled && mode !== "home")
    return (
      <section className="market-unavailable" aria-label="Radar marché">
        <p>
          {m.error || "Radar privé non activé."}{" "}
          <a href="/api/auth/login">Se connecter à A.D</a>
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
                : "PARIS · RADAR POUR DA INDÉPENDANT"}
          </p>
          <h2>
            {mode === "home"
              ? "Radar & actualités"
              : mode === "pipeline"
                ? "Opportunités enregistrées"
                : "Explorer le marché."}
          </h2>
        </div>
        {mode === "explorer" && m.status?.enabled && (
          <button disabled={m.busy} onClick={() => void m.runScan()}>
            {m.busy
              ? "Actualisation en cours…"
              : m.status.lastRun?.paused
                ? "Reprendre le scan"
                : m.status.lastRun
                  ? "Actualiser le Radar"
                  : "Lancer le premier scan"}
          </button>
        )}
      </header>
      {m.error && (
        <p role="alert">
          {m.error} <button onClick={() => void m.refresh()}>Actualiser</button>
        </p>
      )}
      {m.loading && <p role="status">Lecture du radar privé…</p>}
      {m.status && !m.status.enabled && mode !== "home" && (
        <p>
          Le radar n’est pas activé. Vos observations locales restent
          disponibles.
        </p>
      )}
      {mode === "explorer" && (
        <>
          <nav aria-label="Types de signaux" className="market-tabs">
            {[
              "Tous les signaux",
              "Nouveaux clients",
              "Analyses stratégiques",
              "Signaux culturels",
              "Recherche manuelle",
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
          <p className="market-catalog-hint">
            Cherchez une marque, un titre ou un besoin, puis réduisez la sélection par secteur, zone et signal.
          </p>
          <div className="market-catalog-facets" aria-label="Filtres du Radar">
            <label>
              État de revue
              <select value={reviewFilter} onChange={(e) => setReviewFilter(e.target.value)}>
                <option value="active">En cours</option>
                <option value="all">Tous les états</option>
                <option value="watchlist">À surveiller</option>
                <option value="verify">À vérifier</option>
                <option value="new">À examiner</option>
                <option value="reviewing">En revue</option>
                <option value="saved">En pipeline</option>
                <option value="snoozed">Reportées</option>
                <option value="rejected">Refusées / exclues</option>
              </select>
            </label>
            {[
              {
                label: "Secteur",
                value: sector,
                set: setSector,
                options: m.facets.sectors,
              },
              {
                label: "Zone",
                value: city,
                set: setCity,
                options: m.facets.cities,
              },
              {
                label: "Type de signal",
                value: event,
                set: setEvent,
                options: m.facets.eventTypes,
              },
            ].map((f) => (
              <label key={f.label}>
                {f.label}
                <select value={f.value} onChange={(e) => f.set(e.target.value)}>
                  <option value="">Tous</option>
                  {f.options.map((o) => <option key={o} value={o}>{label(o)}</option>)}
                </select>
              </label>
            ))}
          </div>
          <div className="market-result-summary" aria-live="polite">
            <span>
              {displayed.length} résultat{displayed.length === 1 ? "" : "s"} affiché{displayed.length === 1 ? "" : "s"}
              {m.nextCursor ? " · d’autres résultats sont disponibles" : ""}
            </span>
            {(reviewFilter !== "active" || sector || city || event || confidence || stage || coverage || days !== "45" || referenceFilter) && (
              <button type="button" className="market-reset-filters" onClick={() => {
                setReviewFilter("active");
                setSector(""); setCity(""); setEvent("");
                setConfidence(""); setStage(""); setCoverage(""); setDays("45");
                setReferenceFilter("");
              }}>Effacer les filtres</button>
            )}
          </div>
          <details className="market-advanced-filters">
            <summary>Affiner la sélection</summary>
            <div className="market-filters">
              {[
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
              <div className="market-reference-picker" role="group" aria-label="Référence de comparaison">
                <span>Comparer à</span>
                <button aria-pressed={!referenceFilter} onClick={() => setReferenceFilter("")}>Toutes</button>
                <button aria-pressed={referenceFilter === "cache-paris"} onClick={() => setReferenceFilter("cache-paris")}>Caché</button>
                <button aria-pressed={referenceFilter === "maison-francois-1er"} onClick={() => setReferenceFilter("maison-francois-1er")}>François 1er</button>
              </div>
            </div>
          </details>
        </>
      )}
      {mode === "explorer" && m.status?.enabled && (
        <div className="market-live-status" aria-live="polite">
          <span className={m.busy ? "is-running" : m.status.stale ? "is-stale" : "is-ready"}>
            <i aria-hidden="true" />
            {m.busy
              ? "Analyse des sources en cours"
              : m.status.stale
                ? "Radar à actualiser"
                : "Radar à jour"}
          </span>
          <small>
            {m.busy && m.status.lastRun
              ? `${m.status.lastRun.itemsSeen} pages examinées`
              : m.status.lastRun?.finishedAt
                ? `Dernier scan · ${date(m.status.lastRun.finishedAt)}`
                : "Aucun scan enregistré"}
          </small>
        </div>
      )}
      {m.status?.enabled && mode !== "home" && (
        <details className="market-scan-details" open={m.status.lastRun?.status === "failed"}>
          <summary>
            {m.items.filter((f) => f.classification === "commercial").length}{" "}
            opportunités ·{" "}
            {m.items.filter((f) => f.classification === "cultural").length}{" "}
            signaux culturels ·{" "}
            {m.items.filter((f) => f.classification === "strategic").length}{" "}
            analyses stratégiques ·{" "}
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
      {mode === "explorer" && (
        <p className="market-positioning">
          Des lieux et des marques à votre échelle, comparés à <strong>Caché</strong> et
          <strong> Maison François 1er</strong>. Ressemblance ≠ besoin confirmé.
        </p>
      )}
      {mode === "explorer" && m.sources.length > 0 && (
        <details className="market-source-registry">
          <summary>Sources et état réel des connexions</summary>
          {(["commercial", "strategic", "cultural", "research"] as const).map(
            (purpose) => (
              <section key={purpose}>
                <h3>
                  {
                    {
                      commercial: "Détection commerciale",
                      strategic: "Intelligence stratégique / Taste",
                      cultural: "Sources culturelles et partenaires",
                      research: "Recherche manuelle",
                    }[purpose]
                  }
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
                        {s.errorCode
                          ? "Collecte en erreur"
                          : s.connected
                            ? "Collecte et extraction confirmées"
                            : s.enabled
                              ? "Collecteur préparé · extraction non confirmée"
                              : s.accessStatus === "permission_required"
                                ? "Autorisation nécessaire"
                                : s.accessStatus === "endpoint_unverified"
                                  ? "Adresse / accès non vérifié"
                                  : s.accessStatus === "access_blocked"
                                    ? "Accès bloqué"
                                    : s.accessStatus === "manual_research_only"
                                      ? "Recherche manuelle · sans collecte"
                                      : "Référence · non connectée"}
                      </strong>
                      <p>{s.accessNote}</p>
                      {s.lastIngestedAt && (
                        <p>
                          Dernière extraction persistée :{" "}
                          {date(s.lastIngestedAt)}
                        </p>
                      )}
                    </article>
                  ))}
              </section>
            ),
          )}
          <p>
            Aucune référence stratégique ne confirme automatiquement une
            préférence Taste.
          </p>
        </details>
      )}
      {mode === "explorer" && view === "Recherche manuelle" && (
        <div>
          <p>
            Recherche documentaire à ouvrir volontairement ; aucun scraping ni
            papier scientifique supposé vérifié.
          </p>
          {m.sources
            .filter((s) => s.purpose === "research")
            .map((s) => (
              <p key={s.id}>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.name} ↗
                </a>
              </p>
            ))}
        </div>
      )}
      {mode === "home" ? (
        <div className="home-market-lists">
          {homeGroups.map((group) => (
            <section
              className="home-market-group"
              key={group.title}
              aria-label={group.title}
            >
              <div className="home-market-group-heading">
                <h3>{group.title}</h3>
                <span>
                  {group.rows.length < group.total
                    ? `${group.rows.length} / ${group.total}`
                    : group.total}
                </span>
              </div>
              {group.rows.length ? (
                group.rows.map((finding) => (
                  <article className="home-market-row" key={finding.id}>
                    <button
                      type="button"
                      className="home-market-open"
                      onClick={() => void inspect(finding)}
                    >
                      <span className="home-market-kind">
                        {group.label} ·{" "}
                        {finding.lookalike?.gate === "lookalike_watchlist"
                          ? "À SURVEILLER"
                          : label(finding.reviewState).toUpperCase()}
                      </span>
                      <strong>{finding.companyName}</strong>
                      <span className="home-market-headline">
                        {finding.headline}
                      </span>
                      <small>
                        {finding.publisher} · publié le {date(finding.publishedAt)}
                      </small>
                    </button>
                    <a
                      href={finding.canonicalUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={"Source originale : " + finding.companyName}
                    >
                      ↗
                    </a>
                  </article>
                ))
              ) : (
                <p className="home-market-empty">
                  {group.title === "Radar"
                    ? "Aucune piste commerciale à examiner."
                    : "Aucune actualité qualifiée pour le moment."}
                </p>
              )}
            </section>
          ))}
          <a className="home-market-all" href="#/explorer">
            Ouvrir le Radar complet <span aria-hidden="true">↗</span>
          </a>
        </div>
      ) : (
        <div className="market-findings">
        {displayed.map((f) => (
          <article className="market-finding" key={f.id}>
            <div className="market-card-head">
              <h3>{f.companyName}</h3>
              <span className="market-card-location">{f.city || "Zone inconnue"}{f.arrondissement ? " · " + f.arrondissement : ""}</span>
            </div>
            {f.lookalike?.archetypeLabel && (
              <div className="market-lookalike">
                <strong>Proche de {f.lookalike.archetypeLabel}</strong>
                <span>
                  Similarité {f.lookalike.similarity.score === null ? "à documenter" : f.lookalike.similarity.score + "/100"}
                  {" · "}
                  Faisabilité commerciale {f.lookalike.soloOpportunity.score === null ? "à vérifier" : f.lookalike.soloOpportunity.score + "/100"}
                </span>
              </div>
            )}
            <p className="market-meta">
              {f.classification === "commercial"
                ? "OPPORTUNITÉ COMMERCIALE"
                : f.classification === "strategic"
                  ? "ANALYSE STRATÉGIQUE"
                  : f.classification === "research"
                    ? "RECHERCHE MANUELLE"
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
            <p className="market-event"><strong>Signal :</strong> {f.headline}</p>
            <p><strong>Pourquoi maintenant :</strong> {f.whyNow}</p>
            {f.classification === "commercial" && (
              <>
                <p className="market-offer">{f.lookalike?.serviceHypothesis || f.potentialNeed}</p>
                <p className="market-next">
                  <strong>À examiner :</strong> {f.nextAction}
                </p>
              </>
            )}
            {f.lookalike?.observedMatches?.length ? (
              <p className="market-meta">Ressemblance documentée : {f.lookalike.observedMatches.slice(0, 2).join(" · ")}.</p>
            ) : null}
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
      )}
      {mode === "explorer" && view === "Nouveaux clients" && !refined && !showAll && items.length > displayed.length && (
        <button className="market-show-more" type="button" onClick={() => setShowAll(true)}>
          Afficher les {items.length - displayed.length} autres opportunités chargées
        </button>
      )}
      {mode === "explorer" && m.nextCursor && (
        <button className="market-show-more" type="button" disabled={m.loadingMore} onClick={() => { setShowAll(true); void m.loadMore(); }}>
          {m.loadingMore ? "Chargement…" : "Charger la suite des résultats"}
        </button>
      )}
      {mode !== "home" && !m.loading &&
        m.status?.enabled &&
        !displayed.length &&
        view !== "Recherche manuelle" && (
          <p>
            {m.nextCursor
              ? "Aucun résultat dans cette page. Chargez la suite ou élargissez les filtres."
              : "Aucun résultat ne correspond à cette sélection. Élargissez un filtre ou effacez-les."}
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
            {selected.lookalike && (
              <section className="market-dossier-summary">
                <h3>Correspondance pour un DA indépendant</h3>
                <p><strong>Référence :</strong> {selected.lookalike.archetypeLabel || "Aucune correspondance suffisamment documentée"}</p>
                <p><strong>Statut :</strong> {({
                  reference_only: "Référence seulement — pas un prospect",
                  prospect_review: "Prospect à examiner",
                  verify: "Informations à vérifier",
                  lookalike_watchlist: "Lieu similaire à surveiller",
                  cultural: "Inspiration / signal culturel",
                  past: "Événement passé",
                } as const)[selected.lookalike.gate]}</p>
                <p><strong>Similarité :</strong> {selected.lookalike.similarity.score === null ? "Non calculable" : selected.lookalike.similarity.score + "/100"} · preuves {Math.round(selected.lookalike.similarity.coverage * 100)} %</p>
                <p><strong>Potentiel solo :</strong> {selected.lookalike.soloOpportunity.score === null ? "Non calculable" : selected.lookalike.soloOpportunity.score + "/100"} · preuves {Math.round(selected.lookalike.soloOpportunity.coverage * 100)} %</p>
                {selected.lookalike.observedMatches.map((v) => <p key={v}>• {v}</p>)}
                {selected.lookalike.differences.map((v) => <p key={v}><strong>Différence à vérifier :</strong> {v}</p>)}
                {selected.lookalike.serviceHypothesis && <p><strong>Mission proportionnée :</strong> {selected.lookalike.serviceHypothesis}</p>}
                <details><summary>Preuves manquantes</summary><ul>{selected.lookalike.missingEvidence.map((x) => <li key={x}>{x}</li>)}</ul></details>
                <p className="market-meta">Ces indices sont extraits de textes sourcés. Aucun visuel privé, budget ni contact n'a été supposé.</p>
              </section>
            )}
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
            <h3>Calendrier de l’événement</h3>
            <p>
              Début :{" "}
              {date(
                selected.ownerEventWindow?.start ||
                  selected.eventStart ||
                  selected.eventDate,
              )}{" "}
              · Fin :{" "}
              {date(
                selected.ownerEventWindow?.end || selected.eventEnd || null,
              )}
            </p>
            {selected.ownerEventWindow && (
              <p>
                Dates corrigées selon le registre fourni par le propriétaire.
              </p>
            )}
            {selected.relatedDevelopments?.map((r, i) => (
              <p key={i}>
                Développement distinct à examiner : {r.claim} Aucun besoin
                acheté confirmé.
              </p>
            ))}
            {selected.metricCautions?.map((c) => (
              <p role="note" key={c}>
                {c}
              </p>
            ))}
            <p>
              Accès à la source :{" "}
              {label(
                selected.sourceAccessStatus || "historical_source_receipt",
              )}{" "}
              · Source primaire :{" "}
              {selected.corroboratingPrimarySource ? (
                <a
                  href={selected.corroboratingPrimarySource}
                  target="_blank"
                  rel="noreferrer"
                >
                  Consulter ↗
                </a>
              ) : (
                "non corroborée"
              )}
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
            <MarketTimeline finding={selected} history={history}/>
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
            {onOpenDossier && (
              <section className="market-room-start" aria-label="Opportunity Room">
                <h3>Opportunity Room / Dossier sourcé</h3>
                <p>Créer un dossier avec un instantané daté des preuves Radar, de l'hypothèse et des inconnues. Les images et propositions créatives restent à ajouter dans WORK.</p>
                <p>{verifiedEvidence.length} preuve(s) validée(s) par le schéma · aucune prise de contact automatique.</p>
                <button type="button"
                  disabled={openingDossier||m.busy||selected.reviewState!=="saved"||!verifiedEvidence.some(e=>e.id===selected.evidenceId)}
                  onClick={()=>void (async()=>{
                    setOpeningDossier(true);setDetailError("");
                    try{await onOpenDossier(selected,verifiedEvidence);closeDetail();}
                    catch(e){setDetailError(e instanceof Error?e.message:"Dossier non confirmé. Réessayez sans créer un doublon.");}
                    finally{setOpeningDossier(false);}
                  })()}>
                  {openingDossier?"Liaison en cours…":selected.projectId?"Ouvrir le dossier associé":"Créer un dossier depuis cette opportunité"}
                </button>
              </section>
            )}
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
