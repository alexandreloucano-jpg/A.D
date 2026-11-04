import { useState } from "react";
import type { Workspace } from "../domain";
import { evaluateLaunchPlan, exportLaunchPlan, launchPlanSchema, newLaunchPlan, type LaunchPlan } from "./launch";
import { Download, Save, ArrowUpRight } from "lucide-react";
import "./launch.css";

type Props = {
  project: Workspace["projects"][number];
  data: Workspace;
  commit: (next: Workspace, message: string) => boolean;
};
const prompts = [
  "Chiffre documenté, avec contexte et source",
  "Contraste vrai avec l'habitude du marché",
  "Objection la plus fréquente",
  "Démonstration ou preuve en direct",
  "Bénéfice mesurable pour le client",
];
function downloadPlan(plan: LaunchPlan, name: string) {
  const text = exportLaunchPlan(plan);
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "AD-Launch-" + name.replace(/[^a-z0-9-]/gi, "-").slice(0, 50) + ".md";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function LaunchPlanner({ project, data, commit }: Props) {
  const existing = data.launchPlans?.find(plan => plan.projectId === project.id);
  const [draft, setDraft] = useState<LaunchPlan>(() => existing ?? newLaunchPlan(project.id));
  const [feedback, setFeedback] = useState("");
  const gate = evaluateLaunchPlan(draft);
  const update = <K extends keyof LaunchPlan>(field: K, value: LaunchPlan[K]) => {
    setDraft(previous => ({ ...previous, [field]: value }));
    setFeedback("");
  };
  function save() {
    try {
      const next = launchPlanSchema.parse({ ...draft, updatedAt: new Date().toISOString() });
      const saved = commit({
        ...data,
        launchPlans: [...(data.launchPlans || []).filter(plan => plan.projectId !== project.id), next],
        projects: data.projects.map(p => p.id === project.id ? { ...p, updatedAt: new Date().toISOString() } : p)
      }, "Plan de lancement enregistré localement. Aucune publication.");
      if (saved) {
        setDraft(next);
        setFeedback("Enregistré sur cet appareil et inclus dans l'export de sauvegarde A.D.");
      } else setFeedback("Enregistrement non confirmé. Le brouillon reste visible.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Plan invalide. Le brouillon reste visible.");
    }
  }
  const input = (id: keyof LaunchPlan, title: string, placeholder: string, rows = 2) => (
    <label className="ad-launch-label" htmlFor={"ad-launch-" + id}>
      <span>{title}</span>
      <textarea id={"ad-launch-" + id} rows={rows} value={String(draft[id])}
        onChange={e => update(id, e.target.value as never)} placeholder={placeholder} maxLength={1500} />
    </label>
  );
  return (
    <section className="ad-launch" aria-labelledby="ad-launch-title">
      <div className="ad-launch-heading">
        <div>
          <p className="ad-launch-kicker">CREATE / DISTRIBUTION RESEARCH</p>
          <h2 id="ad-launch-title">The Launch Thesis.</h2>
          <p>Une narration, une démonstration et une distribution pertinente. D'abord la preuve. Ensuite la publication.</p>
        </div>
        <span className="ad-launch-status">{gate.readyForHumanReview ? "À relire" : "Brouillon"} · {5 - gate.missing.length}/5</span>
      </div>
      <details className="ad-launch-details">
        <summary>Préparer ce lancement <ArrowUpRight size={17} aria-hidden="true" /></summary>
        <div className="ad-launch-steps" role="group" aria-label="Gates de préparation">
          {[
            ["01", "Narrative", gate.narrative],
            ["02", "Proof", gate.proof],
            ["03", "Five hooks", gate.hooks],
            ["04", "Distribution", gate.distribution],
            ["05", "Measurement", gate.measurement],
          ].map(([index, text, checked]) => <div key={String(index)} className="ad-launch-step">
            <strong>{index}</strong><span>{text}</span><b>{checked ? "Renseigné" : "À traiter"}</b>
          </div>)}
        </div>
        <div className="ad-launch-grid">
          <fieldset>
            <legend>01. Narrative</legend>
            {input("audience", "Audience", "Qui devrait vraiment s'intéresser à ce lancement ?")}
            {input("problem", "Tension du marché", "Quelle frustration ou aspiration observable existe déjà ?")}
            {input("differentiator", "Différence prouvable", "Quel fait vrai nous distingue, même sans formulation publicitaire ?")}
          </fieldset>
          <fieldset>
            <legend>02. Demonstration</legend>
            {input("proofClaim", "Affirmation démontrable", "Quel résultat peut-on prouver sans exagération ?")}
            <label className="ad-launch-label" htmlFor="ad-launch-proofUrl">
              <span>Source ou démonstration accessible</span>
              <input id="ad-launch-proofUrl" type="url" value={draft.proofUrl}
                onChange={e => update("proofUrl", e.target.value)} placeholder="https://" />
              <small>Le lien est enregistré, pas vérifié automatiquement.</small>
            </label>
            {input("demoPlan", "Démo en conditions réelles", "Que verra une personne sceptique en moins de 30 secondes ?")}
          </fieldset>
        </div>
        <fieldset className="ad-launch-hooks">
          <legend>03. Cinq angles à comparer, pas cinq posts à publier</legend>
          <p>Une première ligne doit contenir un fait précis, un contraste réel ou un résultat documenté. Aucun score de viralité n'est simulé.</p>
          {draft.hooks.map((hook, index) => (
            <label className="ad-launch-label" key={index} htmlFor={"ad-launch-hook-" + index}>
              <span>{String(index + 1).padStart(2, "0")} · {prompts[index]}</span>
              <textarea id={"ad-launch-hook-" + index} rows={2} maxLength={280} value={hook}
                onChange={e => update("hooks", draft.hooks.map((value, i) => i === index ? e.target.value : value))}
                placeholder="Formuler une accroche fondée sur un fait vérifiable" />
            </label>
          ))}
        </fieldset>
        <div className="ad-launch-grid">
          <fieldset>
            <legend>04. Distribution</legend>
            {input("distributionContacts", "Connexions réellement pertinentes", "Contacts ou profils à considérer, et pourquoi. Aucun message envoyé automatiquement.", 4)}
          </fieldset>
          <fieldset>
            <legend>05. Outcome</legend>
            {input("successMetric", "Mesure de conversion avant lancement", "Ex. demandes qualifiées / visites de la page, pas seulement les vues.", 3)}
            {input("observedResults", "Résultats réels après lancement", "À compléter uniquement une fois les données observées.", 3)}
          </fieldset>
        </div>
        <div className="ad-launch-check">
          <p>{gate.readyForHumanReview ? "Brief complet pour relecture humaine. Les preuves, le récit et les contacts ne sont pas vérifiés automatiquement." : "À compléter : " + gate.missing.join(" · ")}</p>
          <p>Aucune publication, sollicitation, connexion X ou prédiction de portée automatique.</p>
        </div>
        <div className="ad-launch-actions">
          <button type="button" className="ad-launch-save" onClick={save}><Save size={16} aria-hidden="true" /> Enregistrer dans le projet</button>
          <button type="button" onClick={() => downloadPlan(draft, project.title)}><Download size={16} aria-hidden="true" /> Exporter le brief</button>
          <span role="status">{feedback}</span>
        </div>
      </details>
    </section>
  );
}

