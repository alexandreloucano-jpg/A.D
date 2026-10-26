import type {
  EmailDraft,
  LifecycleFacts,
  MonthlyMetric,
  QualifiedSignal,
  WorkflowId,
} from "./model.js";

type DraftInput = {
  link: "saver" | "explorer" | "projets" | "accueil";
  signals?: QualifiedSignal[];
  metrics?: MonthlyMetric[];
};

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
      character
    ]!,
  );
}

export function composeEmail(
  facts: LifecycleFacts,
  workflow: WorkflowId,
  input: DraftInput,
): EmailDraft {
  const ctaUrl = new URL("/#/" + input.link, "https://ad.example").href;
  let subject = "Votre prochain pas dans A.D";
  let preheader = "Reprenez le fil de votre travail.";
  let heading = "Un prochain pas, à partir de votre travail";
  let body = "Votre espace est prêt à reprendre là où vous l’avez laissé.";
  let cta = "Ouvrir A.D";
  if (workflow === "first_value") {
    subject = "Enregistrer une première référence";
    preheader = "Commencez par une source qui compte pour votre travail.";
    heading = "Votre mémoire créative commence par une source";
    body = "Enregistrez une référence que vous souhaitez retrouver et remettre en contexte.";
    cta = "Ouvrir la Bibliothèque";
  } else if (workflow === "saved_but_unused") {
    subject = "Relier une référence à votre travail";
    preheader = "Une étape simple à partir de ce que vous avez conservé.";
    heading = "Donnez un contexte à une référence conservée";
    body = "Choisissez une référence existante et ajoutez le contexte qui vous aidera à la retrouver.";
    cta = "Reprendre la Bibliothèque";
  } else if (workflow === "weekly_intelligence") {
    const signals = input.signals || [];
    subject = "Un signal à examiner";
    preheader = "Une évolution sourcée, à confronter à votre perspective.";
    heading = "Un signal nouveau mérite votre regard";
    body = `${signals.length} signal${signals.length === 1 ? " nouveau" : "s nouveaux"} qualifié${signals.length === 1 ? "" : "s"} est disponible dans votre Radar. Sa qualification repose sur une source vérifiable ; elle ne confirme ni mandat, ni budget, ni prise de contact.`;
    cta = "Examiner dans Radar";
  } else if (workflow === "reactivation") {
    subject = "Reprendre un dossier dans A.D";
    preheader = "Le fil de votre travail vous attend.";
    heading = "Reprenez un travail déjà engagé";
    body = "Ouvrez votre espace et choisissez la prochaine action sur un dossier existant.";
    cta = "Reprendre le travail";
  } else if (workflow === "monthly_value") {
    const metrics = input.metrics || [];
    const monthLabel = new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      month: "long",
      year: "numeric",
    }).format(new Date(facts.asOf));
    const singular: Record<MonthlyMetric["key"], string> = {
      references_saved: "référence enregistrée",
      signals_reviewed: "signal examiné",
      dossiers_linked: "dossier relié",
      decisions_confirmed: "décision confirmée",
      measurable_outcomes: "résultat commercial documenté",
    };
    const totals = metrics.map(
      (metric) =>
        `${metric.value} ${metric.value === 1 ? singular[metric.key] : metric.label.toLocaleLowerCase("fr")}`,
    );
    const hasReferences = metrics.some(
      (metric) => metric.key === "references_saved",
    );
    const interpretation = hasReferences
      ? "Votre mémoire créative s’enrichit. Reprenez une référence dans la Bibliothèque pour la remettre en contexte."
      : "Ces traces rendent visible le travail consigné dans A.D. Utilisez-les pour choisir la prochaine décision à éclairer.";
    subject = "Votre mois en intelligence";
    preheader = "Les traces vérifiées de votre travail dans A.D.";
    heading = `Votre mois en intelligence · ${monthLabel}`;
    body = `${totals.join(" · ")}\n\n${interpretation}\n\nCes compteurs décrivent les actions enregistrées dans A.D. Ils ne mesurent ni les ventes ni la valeur d’un mandat.`;
    cta = "Reprendre dans A.D";
  }
  const safeHeading = escapeHtml(heading);
  const safeBody = body
    .split("\n")
    .map((line) =>
      line ? `<p style="margin:0 0 16px">${escapeHtml(line)}</p>` : "",
    )
    .join("");
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>${escapeHtml(subject)}</title></head><body style="margin:0;background:#f2f2ef;color:#111;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f2f2ef"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff"><tr><td style="padding:28px 28px 16px;border-bottom:1px solid #d8d8d4;font-size:12px;letter-spacing:2px;font-weight:700">A.D <span style="font-weight:400;letter-spacing:1px">INTELLIGENCE</span></td></tr><tr><td style="padding:36px 28px 24px"><p style="margin:0 0 12px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#5c5c58">A.D / VOTRE ESPACE</p><h1 style="margin:0 0 20px;font:700 30px/1.15 Georgia,'Times New Roman',serif">${safeHeading}</h1><div style="font-size:16px;line-height:1.6;color:#30302d">${safeBody}</div><p style="margin:28px 0 12px"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;min-height:44px;padding:0 20px;line-height:44px;background:#111;color:#fff;text-decoration:none;font-size:14px;font-weight:700">${escapeHtml(cta)}</a></p><p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#686863">A.D vous écrit uniquement à partir d’actions et de sources vérifiées dans votre espace.</p></td></tr><tr><td style="padding:16px 28px;border-top:1px solid #d8d8d4;font-size:12px;color:#686863">A.D — Creative Intelligence</td></tr></table></td></tr></table></body></html>`;
  const text = `${subject}\n\n${heading}\n\n${body}\n\n${cta}: ${ctaUrl}\n\nA.D vous écrit uniquement à partir d’actions et de sources vérifiées dans votre espace.`;
  return {
    templateId: `ad-lifecycle-${workflow}-v1`,
    subject,
    preheader,
    text,
    html,
    ctaUrl,
  };
}

export function replaceDraftOrigin(draft: EmailDraft, appOrigin: string) {
  const origin = new URL(appOrigin);
  return {
    ...draft,
    ctaUrl: draft.ctaUrl.replace("https://ad.example", origin.origin),
    text: draft.text.replaceAll("https://ad.example", origin.origin),
    html: draft.html.replaceAll(
      "https://ad.example",
      escapeHtml(origin.origin),
    ),
  };
}
