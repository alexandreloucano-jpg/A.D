import type { Finding, Factor } from "./schema.js";
import { scoreFactors, weights } from "./scoring.js";
export const RADAR_VERSION = "creative-business-v3";
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const knownRelations = new Set([
  "cache",
  "francois 1er",
  "francois ier",
  "hotel francois 1er",
  "s chiaparelli",
  "schiaparelli",
]);
export function existingRelationship(name: string) {
  return knownRelations.has(
    normalize(name)
      .replace(/[^a-z0-9 ]/g, "")
      .trim(),
  );
}
const established =
  /\b(chanel|dior|lvmh|kering|louis vuitton|hermes|schiaparelli|l'oreal|sephora|audemars piguet)\b/i;
export function qualifyFinding(original: Finding, now = new Date()): Finding {
  const f = { ...original };
  if (f.ownerEventWindow) {
    f.eventStart = f.ownerEventWindow.start + "T00:00:00.000Z";
    f.eventEnd = f.ownerEventWindow.end + "T23:59:59.999Z";
    f.eventDate = f.eventStart;
  } else {
    f.eventStart = f.eventStart || f.eventDate;
    f.eventEnd = f.eventEnd || null;
  }
  const headline = normalize(f.headline),
    text = normalize(f.headline + " " + (f.analysisText || f.excerpt));
  const hospitality =
    /hotel|hospitality|restaurant|restauration|club prive|immobilier|residence|palace/.test(
      text,
    );
  const sectorFit =
    hospitality ||
    /\bmode\b|fashion|beaute|beauty|cosmet|parfum|lifestyle|consumer|aliment|nutrition|boisson|wellness|joaill|retail|boutique/.test(
      normalize(f.sector) + " " + text,
    );
  const arrondissement =
    /\b(?:7500([136789])|75016)\b/.exec(text)?.[0] ||
    /(?:paris|dans le|dans les?)\s*(1er|3e|6e|7e|8e|9e|16e)\b/.exec(
      text,
    )?.[1] ||
    null;
  const paris =
    /\bparis\b/.test(headline) ||
    !!arrondissement ||
    /(?:ouvrira|ouverture|ouvre|renovation|restaurant|hotel|boutique).{0,70}\bparis\b/.test(
      text,
    );
  let trigger: string | null = null;
  const rules: [RegExp, string][] = [
    [
      /levee? de fonds|leve [\d]|funding|serie [ab]|tour de table.{0,60}(?:financ|million|invest)/,
      "funding",
    ],
    [
      /recrut\w*.{0,65}(marketing|communication|brand|creati)|(?:marketing|communication).{0,40}recrut/,
      "marketing_hire",
    ],
    [
      /renov|rehabilit|restructur\w*.{0,40}(hotel|immeuble|residence)/,
      "hospitality_renovation",
    ],
    [
      /\b(?:ouvre|ouvrira|ouverture|inaugure|inauguration|opening)\b|s'installe|nouvelle adresse/,
      "store_opening",
    ],
    [
      /\bexpansion\b|nouveau marche|s'implante|deploiement|developpement international|\betend\b/,
      "expansion",
    ],
    [
      /reposition|nouvelle identite|rebranding|nouveau positionnement|direction (artistique|creative)/,
      "repositioning",
    ],
    [
      /(?:lance|lancement|launch).{0,70}(?:marque|concept|produit|gamme|boisson|parfum|business)|nouvelle marque|nouveau concept/,
      "brand_launch",
    ],
    [/collabor|partenariat/, "brand_collaboration"],
  ];
  for (const [re, type] of rules)
    if (
      re.test(headline) ||
      (!/defile|collection|campagne/.test(headline) &&
        re.test(text.slice(0, 1600)) &&
        (type !== "brand_collaboration" ||
          /nouvelle collaboration|annonce\w* (?:un|une) (?:partenariat|collaboration)|signe (?:un|une)/.test(
            text.slice(0, 1600),
          )))
    ) {
      trigger = type;
      break;
    }
  const past =
    /deja (publie|lance|ouvert|termine)|s'est (termine|acheve)|desormais termine|pop.?up termine|campagne (devoilee|publiee)|retour sur|a ferme ses portes/.test(
      text,
    );
  const future =
    /\b(?:ouvrira|ouvriront|prochainement|bientot|recrute|recrutement)\b|ouverture (?:prevue|a venir)|prevoy\w* (?:ouvrir|lancer)|prepare\w* (?:un|une|le|la) (?:ouverture|lancement|campagne|projet)|va ouvrir|projet (?:hotelier|immobilier|de renovation|de boutique)/.test(
      text,
    );
  const eventAge = f.eventDate
    ? (+now - Date.parse(f.eventDate)) / 86400000
    : null;
  const publicationAge = f.publishedAt
    ? (+now - Date.parse(f.publishedAt)) / 86400000
    : null;
  const datedCurrentEvent =
    eventAge !== null && eventAge >= -365 && eventAge <= 14;
  const expired =
    !datedCurrentEvent &&
    (publicationAge === null || publicationAge > 45 || publicationAge < -1);
  const timing: NonNullable<Finding["timing"]> =
    (f.eventEnd && Date.parse(f.eventEnd) < +now) ||
    past ||
    (eventAge !== null && eventAge > 14)
      ? "past"
      : future || (eventAge !== null && eventAge < 0)
        ? "upcoming"
        : (eventAge !== null && eventAge <= 14) ||
            (publicationAge !== null &&
              publicationAge <= 14 &&
              ["funding", "marketing_hire"].includes(trigger || ""))
          ? "ongoing"
          : "unknown";
  const fundingQuote =
    /(?:[^.!?]{0,70}(?:millions?|milliards?|\b[\d.,]+\s*(?:€|euros|dollars))[^.!?]{0,90})/i.exec(
      f.analysisText || f.excerpt,
    )?.[0] || null;
  const budgetKnown = !!fundingQuote && trigger === "funding";
  const reportedRole =
    /(?:direct(?:eur|rice)|responsable|chief|head of)\s+(?:du |de la |des |of )?(?:marketing|communication|brand|creation|developpement)/i.exec(
      f.analysisText || f.excerpt,
    )?.[0] || null;
  const commercial =
    sectorFit &&
    !!trigger &&
    timing !== "past" &&
    !expired &&
    f.entityType !== "market_signal" &&
    (!f.sourcePurpose || f.sourcePurpose === "commercial") &&
    (!f.selfPromotional || !!f.corroboratingPrimarySource);
  const relation =
    f.relationshipStatus === "blocked"
      ? "blocked"
      : existingRelationship(f.companyName)
        ? "existing"
        : f.relationshipStatus;
  const priority: NonNullable<Finding["targetPriority"]> =
    paris && hospitality
      ? "paris"
      : /nouveau (concept|modele)|business model|nouvelle categorie|direct.to.consumer|abonnement/.test(
            text,
          )
        ? "business_model"
        : established.test(f.companyName)
          ? "established"
          : sectorFit
            ? "emerging"
            : "outside";
  const department =
    reportedRole ||
    (hospitality
      ? "Direction marketing / communication du lieu"
      : "Direction de marque / marketing");
  const services =
    trigger === "hospitality_renovation" ||
    (hospitality && trigger === "store_opening")
      ? [
          "storytelling architectural",
          "photographie de lieu",
          "film de lancement",
          "identité visuelle",
        ]
      : trigger === "repositioning"
        ? [
            "stratégie de marque",
            "direction artistique",
            "campagne photo et vidéo",
          ]
        : [
            "direction artistique",
            "campagne de lancement",
            "photographie",
            "production vidéo",
          ];
  const reasons = {
    service_fit: sectorFit
      ? "Secteur compatible avec les prestations créatives demandées ; mandat non confirmé."
      : "Adéquation créative non établie.",
    trigger_strength: trigger
      ? `Déclencheur observable : ${trigger}.`
      : "Aucun événement commercial concret identifié.",
    time_relevance:
      timing === "upcoming"
        ? "Projet à venir rapporté ; disponibilité du mandat à vérifier."
        : timing === "past"
          ? "Événement terminé : aucune urgence commerciale déduite."
          : "La date de publication ne prouve pas le calendrier du besoin.",
    budget_evidence: budgetKnown
      ? `Capacité financière possible : « ${fundingQuote} ». Ce financement n’est pas un budget créatif.`
      : "Aucun indice financier explicite : aucun budget inventé.",
    decision_maker_access: reportedRole
      ? `Fonction citée : ${reportedRole} ; nom et accessibilité à vérifier.`
      : "Service à approcher proposé par hypothèse ; aucun contact vérifié.",
  };
  const values: Record<string, Factor["value"]> = {
    service_fit: sectorFit ? 1 : 0,
    trigger_strength: trigger ? 1 : 0,
    time_relevance:
      timing === "upcoming" || timing === "ongoing"
        ? 1
        : timing === "past"
          ? 0
          : null,
    budget_evidence: budgetKnown ? 0.5 : null,
    decision_maker_access: reportedRole ? 0.5 : null,
  };
  const factorWeights = weights;
  const factors = Object.fromEntries(
    Object.entries(factorWeights).map(([key, weight]) => [
      key,
      {
        value: values[key],
        weight,
        reason: reasons[key as keyof typeof reasons],
        evidenceIds: values[key] === null ? [] : [f.evidenceId],
        assessedAt: now.toISOString(),
      },
    ]),
  );
  const result: Finding = {
    ...f,
    relationshipStatus: relation,
    eventType: trigger || f.eventType,
    city: paris ? "Paris" : f.city === "Paris" ? null : f.city,
    classification: commercial
      ? "commercial"
      : f.sourcePurpose === "strategic"
        ? "strategic"
        : f.sourcePurpose === "research"
          ? "research"
          : "cultural",
    qualification:
      relation === "blocked"
        ? "excluded"
        : timing === "past" ||
            (!datedCurrentEvent &&
              publicationAge !== null &&
              publicationAge > 45)
          ? "past"
          : commercial && (timing === "upcoming" || timing === "ongoing")
            ? "actionable"
            : "verify",
    targetPriority: priority,
    arrondissement,
    timing,
    scoringVersion: RADAR_VERSION,
    factors,
    ...scoreFactors(factors),
    score: commercial ? scoreFactors(factors).score : null,
    services: commercial ? services : [],
    whyNow: commercial
      ? `« ${f.reportedFact} » : ${timing === "upcoming" ? "un projet à venir justifie une qualification du besoin" : "un déclencheur existe, mais son calendrier d’achat reste à confirmer"}.`
      : `${timing === "past" ? "Événement passé : pas de priorité urgente." : expired ? "Chronologie insuffisante ou source ancienne." : "Signal culturel / modèle à observer ; aucun besoin commercial suffisamment établi."}`,
    potentialNeed: commercial
      ? `Hypothèse : ${trigger === "funding" ? "accompagner le développement financé avec une plateforme de marque et des contenus de lancement" : trigger === "marketing_hire" ? "accompagner la nouvelle équipe marketing avec un dispositif de production" : hospitality ? "préparer le récit du lieu et les contenus de lancement" : "accompagner le changement annoncé par une campagne ou une direction artistique"}. Aucun achat confirmé.`
      : "Aucun besoin commercial qualifié ; conserver comme recherche, sans prospection déduite.",
    contactApproach: {
      department,
      basis: reportedRole ? "reported_role" : "role_hypothesis",
      name: null,
    },
    budgetBasis: budgetKnown
      ? reasons.budget_evidence
      : "Budget créatif inconnu ; qualifier le périmètre et les moyens avant tout chiffrage.",
    nextAction: commercial
      ? `Vérifier ${timing === "upcoming" ? "la date de lancement et " : "le calendrier, "}les prestataires déjà mandatés auprès de ${department.toLocaleLowerCase("fr")}${relation === "existing" ? " via la relation existante, sans approche à froid" : ""}.`
      : "Observer l’évolution ; rechercher un nouveau déclencheur avant toute approche.",
    knownUnknowns: [
      ...new Set([
        ...f.knownUnknowns,
        "Date exacte du fait",
        "Disponibilité du mandat créatif",
        "Budget créatif distinct du financement",
      ]),
    ],
  };
  result.assessment = {
    original_url: result.originalUrl || result.canonicalUrl,
    publisher: result.publisher,
    discovered_at: result.firstSeenAt,
    published_at: result.publishedAt,
    event_start: result.eventStart || null,
    event_end: result.eventEnd || null,
    subject_company:
      result.entityType === "market_signal" ? null : result.companyName,
    factual_trigger: result.reportedFact,
    source_access_status:
      result.sourceAccessStatus || "historical_source_receipt",
    corroborating_primary_source: result.corroboratingPrimarySource || null,
    commercial_need_hypothesis: commercial ? result.potentialNeed : null,
    decision_maker_status: reportedRole
      ? "reported_role_not_verified"
      : "unknown",
    budget_evidence: budgetKnown ? fundingQuote : null,
    source_quality: result.sourceQuality || result.sourceClass,
    urgency_reason: result.whyNow,
    confidence: result.confidence,
  };
  return result;
}
export function compareFindings(a: Finding, b: Finding) {
  const priority = (f: Finding) =>
    (f.relationshipStatus === "blocked" ? -1000 : 0) +
    (f.classification === "commercial" ? 100 : 0) +
    (f.qualification === "actionable" ? 25 : 0) +
    (f.targetPriority === "paris"
      ? f.arrondissement
        ? 20
        : 15
      : f.targetPriority === "emerging"
        ? 10
        : 0);
  return (
    priority(b) - priority(a) ||
    (b.score ?? -1) - (a.score ?? -1) ||
    b.firstSeenAt.localeCompare(a.firstSeenAt) ||
    a.id.localeCompare(b.id)
  );
}
export function homepageFinding(f: Finding) {
  return (
    f.classification === "commercial" &&
    f.qualification === "actionable" &&
    !!f.corroboratingPrimarySource &&
    !f.sourceError &&
    f.relationshipStatus !== "blocked" &&
    !["rejected", "snoozed"].includes(f.reviewState)
  );
}
