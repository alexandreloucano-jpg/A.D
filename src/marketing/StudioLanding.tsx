import { useEffect, useState, type FormEvent } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Menu, X } from "lucide-react";
import "./studio.css";

type Brief = {
  name: string;
  email: string;
  brand: string;
  website: string;
  sector: string;
  challenge: string;
};

const initialBrief: Brief = {
  name: "", email: "", brand: "", website: "", sector: "", challenge: "",
};

const offers = [
  {
    number: "01",
    title: "Brand Thesis",
    kicker: "Clarifier la direction",
    text: "Un diagnostic de marque, de marché et de perception. Deux territoires créatifs et une feuille de route pour prendre une décision.",
    detail: "Mission de 10 jours ouvrés · À partir de 3 500 € HT",
  },
  {
    number: "02",
    title: "Brand World",
    kicker: "Construire le désir",
    text: "Positionnement, langage visuel, direction éditoriale, concept de campagne et supervision du lancement.",
    detail: "Mission sur mesure · Budget de production séparé",
  },
  {
    number: "03",
    title: "Creative Office",
    kicker: "Tenir le cap",
    text: "Une direction créative externalisée pour le fondateur : arbitrages, campagnes, équipes et cohérence de marque dans la durée.",
    detail: "Mandat récurrent · Périmètre et disponibilité cadrés",
  },
];

const questions = [
  {
    q: "Est-ce une agence de contenus ?",
    a: "Non. A.D intervient au niveau du positionnement et des décisions créatives. La photographie, les campagnes et les contenus peuvent faire partie de l'exécution, mais ne sont pas le produit principal.",
  },
  {
    q: "Faut-il déjà avoir une équipe marketing ?",
    a: "Non. Nous adaptons le mandat à la maturité de votre entreprise. Lorsqu'une production nécessite des spécialistes, leurs missions et coûts sont définis séparément.",
  },
  {
    q: "Le premier échange est-il un audit gratuit ?",
    a: "Non. L'échange initial sert à vérifier l'enjeu, la compatibilité et le calendrier. Le diagnostic approfondi est une mission rémunérée, avec livrables définis.",
  },
  {
    q: "Travaillez-vous uniquement avec les restaurants ?",
    a: "A.D commence à Paris avec les fondateurs de marques et d'établissements indépendants dans l'hospitality, la mode et le lifestyle. Le projet doit présenter un véritable enjeu d'identité.",
  },
];

export function StudioLanding() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [brief, setBrief] = useState<Brief>(initialBrief);
  const [feedback, setFeedback] = useState("");
  const recipient = (import.meta.env.VITE_AD_STUDIO_CONTACT_EMAIL || "").trim();
  const recipientReady = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient);

  useEffect(() => {
    document.title = "A.D Studio — Direction créative pour fondateurs indépendants";
    document.querySelector('meta[name="description"]')?.setAttribute(
      "content",
      "A.D Studio, direction artistique et stratégie de marque pour fondateurs indépendants à Paris. Du positionnement au monde de marque.",
    );
  }, []);

  const update = (field: keyof Brief, value: string) => {
    setBrief((previous) => ({ ...previous, [field]: value }));
    if (feedback) setFeedback("");
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const lines = [
      "Demande de premier échange — A.D Studio",
      "",
      "Nom : " + brief.name.trim(),
      "Email : " + brief.email.trim(),
      "Marque : " + brief.brand.trim(),
      "Site : " + (brief.website.trim() || "Non renseigné"),
      "Secteur : " + brief.sector,
      "Enjeu : " + brief.challenge.trim(),
      "",
      "Échange de qualification, sans audit gratuit ni engagement.",
    ];
    const message = lines.join("\n");
    if (recipientReady) {
      window.location.href = "mailto:" + recipient +
        "?subject=" + encodeURIComponent("A.D Studio — " + brief.brand.trim()) +
        "&body=" + encodeURIComponent(message);
      setFeedback("Votre messagerie s'ouvre avec le brief. Vérifiez le contenu et envoyez le message depuis votre application.");
      return;
    }
    try {
      await navigator.clipboard.writeText(message);
      setFeedback("Brief copié. Le canal de contact A.D n'est pas encore configuré : aucun message n'a été envoyé.");
    } catch {
      setFeedback("Le canal de contact n'est pas encore configuré. Copiez vos réponses manuellement : aucune donnée n'a été envoyée.");
    }
  }

  return (
    <div className="ad-landing">
      <a className="ad-skip" href="#ad-main">Aller au contenu</a>
      <header className="ad-nav" aria-label="Navigation A.D Studio">
        <a className="ad-logotype" href="/studio" aria-label="A.D Studio, accueil">A.D<span className="ad-logo-mark">®</span></a>
        <span className="ad-nav-descriptor">THE CREATIVE OFFICE <span>— PARIS</span></span>
        <nav className={menuOpen ? "ad-links is-open" : "ad-links"} aria-label="Navigation principale">
          <a onClick={() => setMenuOpen(false)} href="#vision">Vision</a>
          <a onClick={() => setMenuOpen(false)} href="#services">Expertise</a>
          <a onClick={() => setMenuOpen(false)} href="#approche">Méthode</a>
          <a onClick={() => setMenuOpen(false)} className="ad-nav-contact" href="#contact">Parlons de votre marque <ArrowUpRight size={15}/></a>
        </nav>
        <button className="ad-menu-toggle" type="button" aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={24}/> : <Menu size={24}/>}
        </button>
      </header>

      <main id="ad-main">
        <section className="ad-hero" aria-labelledby="ad-hero-title">
          <div className="ad-hero-top">
            <span>INDEPENDENT CREATIVE DIRECTION</span><span>PARIS · WORLDWIDE</span>
          </div>
          <div className="ad-hero-core">
            <p className="ad-eyebrow">Pour les fondateurs qui voient plus loin.</p>
            <h1 id="ad-hero-title">Une marque n’a pas besoin de <em>plus de contenu.</em><br/>Elle a besoin d’une direction.</h1>
            <p className="ad-hero-description">Nous construisons des identités que l'on reconnaît, des univers auxquels on veut appartenir et une vision créative capable de tenir dans le temps.</p>
            <div className="ad-hero-actions">
              <a href="#contact" className="ad-button ad-button-light">Parler de votre marque <ArrowUpRight size={17}/></a>
              <a className="ad-text-link" href="#vision">Découvrir A.D <ArrowDown size={17}/></a>
            </div>
          </div>
          <div className="ad-hero-bottom"><span>STRATEGY / ART DIRECTION / BRAND WORLDS</span><span>SCROLL TO EXPLORE <ArrowDown size={13}/></span></div>
          <span className="ad-hero-watermark" aria-hidden="true">A.D</span>
        </section>

        <section className="ad-statement ad-section" id="vision">
          <div className="ad-section-label"><span>01 / NOTRE CONVICTION</span><span>LE PROBLÈME N'EST PAS LA VISIBILITÉ</span></div>
          <h2>On peut être partout.<br/><em>Et ne compter nulle part.</em></h2>
          <div className="ad-statement-grid">
            <p>Beaucoup de marques produisent, publient et lancent. Peu parviennent à imposer une vision immédiatement identifiable.</p>
            <p>A.D travaille à l'endroit où l'identité devient un actif : entre l'ambition d'un fondateur, la culture de son marché et la cohérence de chaque décision créative.</p>
          </div>
        </section>

        <section className="ad-frictions ad-section" aria-labelledby="ad-frictions-title">
          <div className="ad-section-label"><span>02 / LE CONSTAT</span><span>CE QUI FRAGILISE UNE MARQUE</span></div>
          <h2 id="ad-frictions-title" className="ad-small-title">Le problème n'est pas de manquer de prestataires.</h2>
          <div className="ad-friction-grid">
            <article><span>01</span><h3>Des idées sans ligne directrice.</h3><p>Les campagnes se succèdent, mais personne ne protège l'ensemble.</p></article>
            <article><span>02</span><h3>Une image sans singularité.</h3><p>Une esthétique soignée ne suffit pas à rendre une marque mémorable.</p></article>
            <article><span>03</span><h3>Une croissance sans cohérence.</h3><p>Chaque nouvelle adresse, collection ou collaboration raconte une autre histoire.</p></article>
          </div>
        </section>

        <section className="ad-services ad-section" id="services">
          <div className="ad-section-label"><span>03 / CE QUE NOUS FAISONS</span><span>ONE VISION. EVERY EXPRESSION.</span></div>
          <div className="ad-section-heading">
            <h2>La direction créative,<br/><em>au niveau du fondateur.</em></h2>
            <p>Un interlocuteur senior pour définir, construire et défendre l'identité d'une marque. Une mission cadrée, des décisions nettes, une exécution orchestrée selon le besoin.</p>
          </div>
          <div className="ad-offer-list">
            {offers.map((offer) => (
              <article className="ad-offer" key={offer.number}>
                <span className="ad-offer-number">{offer.number}</span>
                <div><p className="ad-offer-kicker">{offer.kicker}</p><h3>{offer.title}</h3></div>
                <div><p>{offer.text}</p><span className="ad-offer-detail">{offer.detail}</span></div>
                <a href="#contact" aria-label={"Parler du programme " + offer.title}><ArrowUpRight size={21}/></a>
              </article>
            ))}
          </div>
        </section>

        <section className="ad-method ad-section" id="approche">
          <div className="ad-section-label"><span>04 / NOTRE MÉTHODE</span><span>DE LA VISION À L'EXÉCUTION</span></div>
          <div className="ad-method-layout">
            <div><h2>Un cap.<br/><em>Pas dix directions.</em></h2><p>Nous commençons par comprendre le modèle, le public et l'ambition de votre entreprise. La création vient après le diagnostic, jamais à la place.</p></div>
            <ol className="ad-method-steps">
              <li><span>01</span><div><h3>Comprendre</h3><p>Un échange de qualification. Un diagnostic stratégique rémunéré si un enjeu précis est identifié.</p></div></li>
              <li><span>02</span><div><h3>Définir</h3><p>Un territoire créatif original, des priorités et les décisions qui distinguent votre marque.</p></div></li>
              <li><span>03</span><div><h3>Déployer</h3><p>Une roadmap de création, des productions cadrées et une direction qui maintient la cohérence.</p></div></li>
            </ol>
          </div>
        </section>

        <section className="ad-focus ad-section" aria-labelledby="ad-focus-title">
          <div className="ad-section-label"><span>05 / NOTRE TERRAIN</span><span>UN GOÛT PRÉCIS</span></div>
          <h2 id="ad-focus-title">Nous préférons<br/><em>être précis qu'universels.</em></h2>
          <div className="ad-focus-row"><span>HOSPITALITY & NIGHTLIFE</span><span>FASHION & OBJECTS</span><span>INDEPENDENT CULTURE</span></div>
          <p>Restaurants, lieux, hôtels, maisons de mode et marques lifestyle indépendantes. Paris d'abord, sans limite géographique pour les projets qui justifient cette ambition.</p>
        </section>

        <section className="ad-contact ad-section" id="contact">
          <div className="ad-section-label"><span>06 / ENTRER EN CONTACT</span><span>CONFIDENTIAL BRAND ENQUIRY</span></div>
          <div className="ad-contact-grid">
            <div className="ad-contact-heading">
              <h2>Parlons de ce que<br/><em>votre marque pourrait devenir.</em></h2>
              <p>Un premier échange pour comprendre votre projet, vos enjeux et vérifier si nous pouvons travailler ensemble. Pas d'audit complet gratuit, ni de présentation standard.</p>
              <span className="ad-contact-footnote"><Check size={16}/> Approche sélective et confidentielle</span>
            </div>
            <form className="ad-inquiry-form" onSubmit={submit}>
              <div className="ad-form-pair">
                <label>Votre nom<input value={brief.name} onChange={(e)=>update("name",e.target.value)} required autoComplete="name" maxLength={100} placeholder="Nom et prénom"/></label>
                <label>Email professionnel<input type="email" value={brief.email} onChange={(e)=>update("email",e.target.value)} required autoComplete="email" maxLength={180} placeholder="vous@entreprise.com"/></label>
              </div>
              <div className="ad-form-pair">
                <label>Marque / entreprise<input value={brief.brand} onChange={(e)=>update("brand",e.target.value)} required maxLength={120} placeholder="Votre maison"/></label>
                <label>Site (facultatif)<input value={brief.website} onChange={(e)=>update("website",e.target.value)} maxLength={200} placeholder="https://"/></label>
              </div>
              <label>Secteur
                <select required value={brief.sector} onChange={(e)=>update("sector",e.target.value)}>
                  <option value="">Sélectionnez un secteur</option>
                  <option>Hospitality / restauration</option><option>Hôtel / nightlife</option>
                  <option>Mode / beauté / lifestyle</option><option>Autre marque indépendante</option>
                </select>
              </label>
              <label>Votre enjeu aujourd'hui
                <textarea value={brief.challenge} required maxLength={1200} rows={4} placeholder="Ce qui doit changer, se lancer ou se développer..." onChange={(e)=>update("challenge",e.target.value)}/>
              </label>
              <button type="submit" className="ad-button ad-button-dark">
                {recipientReady ? "Préparer mon email" : "Copier mon brief"} <ArrowUpRight size={17}/>
              </button>
              <p className="ad-form-note">
                {recipientReady ? "L'envoi se fait depuis votre messagerie. Rien n'est transmis automatiquement." : "Version d'essai : le canal de contact n'est pas configuré. Votre brief est copié sur votre appareil ; aucun message n'est envoyé."}
              </p>
              {feedback && <p className="ad-form-status" role="status">{feedback}</p>}
            </form>
          </div>
        </section>

        <section className="ad-faq ad-section">
          <div className="ad-section-label"><span>07 / QUESTIONS</span><span>CE QU'IL FAUT SAVOIR</span></div>
          <div className="ad-faq-grid">
            <h2>Sans<br/><em>ambiguïté.</em></h2>
            <div>{questions.map((item) => (
              <details key={item.q}><summary>{item.q}<span aria-hidden="true">+</span></summary><p>{item.a}</p></details>
            ))}</div>
          </div>
        </section>
      </main>

      <footer className="ad-footer">
        <a className="ad-logotype" href="#ad-main">A.D<span className="ad-logo-mark">®</span></a>
        <div><span>CREATIVE INTELLIGENCE & ART DIRECTION</span><span>PARIS · 2026</span></div>
        <a href="#ad-main" className="ad-footer-top">RETOUR EN HAUT <ArrowRight size={15}/></a>
      </footer>
    </div>
  );
}
