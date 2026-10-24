# CODEX HANDOFF — A.D / Private Creative Intelligence OS
**Date de constat : 2026-10-24. Document de reprise, non rapport de livraison.**
**Source de vérité sur le code : `codex/ad-rebuild` HEAD + fichiers source + CI + état Vercel vérifiés à nouveau à chaque session.**
**État du dépôt : PUBLIC. Ce document n'expose ni secrets, ni données client, ni archives privées.**

## 0. Ordre de lecture impératif pour Codex
1. `AGENTS.md` (règles de sécurité et d'implémentation).
2. **Ce document** (intention utilisateur, état connu, conflits de branches, plan de continuation).
3. `README.md`, `package.json`, `src/domain.ts`, `src/storage.ts`, `src/App.tsx`, `server/service.ts`, `server/security.ts`.
4. `docs/RECOVERY_INVENTORY.md`, `docs/RADAR_QUALIFICATION.md`, `docs/SCOUT_LOOKALIKE_SOLO_DA_PLAYBOOK.md`, `docs/radar-user-sources-2026-10-17.json`.
5. `docs/AD_V3_DATA_FOUNDATION.md`, `docs/AD_V3_OPPORTUNITY_ROOM.md`, `docs/AD_V3_INTERACTIONS.md`, `docs/AD_CREATE_CANVAS.md`.
6. `docs/AD_V4_FIELDNOTES_VISUAL_SYSTEM.md` et les branches de refonte **en concurrence** ; les considérer comme propositions, PAS comme direction graphique choisie.

## 1. Intention produit — les décisions à ne jamais perdre
A.D (anciennement Sandro 365) est **un OS privé pour un seul photographe / directeur artistique / creative strategist indépendant basé à Paris**, avec goût centré mode, hospitality, restaurants, nightlife, maisons émergentes et univers culturels. **A.D SAVER** est sa mémoire de références, articles et inspirations. **A.D Studio** (`/studio`) est une surface de présentation commerciale distincte du workspace privé, NON une autorisation de lancer le SaaS ou la vente.

**Décision la plus récente : RESTER INTERNE.** Pas de lancement SaaS, plan d'acquisition à 1 M utilisateurs, Stripe/billing, portal client ou équipe d'agents autonomes maintenant. Critère de réussite : l'utilisateur ouvre A.D spontanément car il découvre des opportunités réelles, prend une décision et crée un livrable dans une seule continuité. Avant le marketing : documenter les résultats authentiques de l'usage interne (temps gagné, prospects qualifiés, propositions envoyées APRÈS validation, missions confirmées).

**Storyline et boucle unique :**
`SOURCE/CAPTURE → SIGNAL → EVIDENCE → QUALIFY → DECIDE → PROJECT/WORK → TASTE/SAVER → CREATE → ACTION → OUTCOME → LEARN`.
Version affichable simplifiée : **TODAY / RADAR / WORK / LIBRARY** ; anciennes routes `accueil / explorer / projets / saver` restent stables jusqu'à migration volontaire. Taste est transversal, CREATE vit dans un dossier WORK, le Radar pointe vers une Opportunity Room. L'interface est une application productive, jamais une landing page déguisée.

**Ce que l'utilisateur refuse :** dashboards IA génériques, graphiques inventés, logos fictifs, surcharge, plusieurs typographies inconsistantes, navigation confuse, cartes décoratives et promesses « AI active » sans fonction, marketing agressif, e-mails automatiques, workflow répétitif, catégorisation Saver obligatoire, agents qui inventent besoins/budgets/contacts. Travail mobile-first particulièrement iPhone, langage humain et utile. **Nouvelle instruction explicite : refaire entièrement la DIRECTION ARTISTIQUE, sans recycler la grammaire visuelle de l'existant ni des templates génériques**, tout en gardant la donnée et les fonctionnalités. Une réécriture de CSS uniquement n'est pas suffisante si hiérarchie, UX et densité restent faibles.

### Fonction qui doit devenir « indispensable »
Une entreprise détectée avec SOURCE VÉRIFIABLE → signal daté → explication du potentiel SOLO / Paris → interlocuteur et budget marqués non vérifiés si absents → décision propriétaire → dossier persistant → références Saver/Taste pertinentes → deux treatments A/B → proposition réutilisable → suivi et résultat. Un seul parcours, pas dix modules cloisonnés.

### Personalisation Radar — instruction déterminante
Radar cherche **de NOUVELLES entreprises / adresses ressemblant aux archétypes** Caché (bar-restaurant indépendant, social, éditorial) et Maison François 1er (brasserie parisienne chic), pas à travailler les relations préexistantes. Ces noms sont **seeds/lookalikes**, PAS prospects automatiques. Schiaparelli est référence esthétique, pas prospect de taille comparable. Recherche: Paris / Île-de-France d'abord, hospitality/nightlife/restaurants, mode, beauté, lieux émergents, opportunités réalisables par un professionnel solo, budget non présumé. Qualifier événement business réel, fenêtre temporelle encore pertinente, accessibilité commerciale, échelle, affinité Taste. Une news Dior n'est pas automatiquement une mission, et un pop-up terminé ne mérite pas de NOW. Lire intégralement `docs/SCOUT_LOOKALIKE_SOLO_DA_PLAYBOOK.md` (instructions détaillées, cas historiques), pas un résumé vague.

Sources exactes propriétaires enregistrées dans `docs/radar-user-sources-2026-10-17.json`: fashionprfirm.com, BoF Paris, FashionNetwork FR, Glossy luxury/EMV, Cosmetics Business/Rhode, Google Scholar/Rhode. Respecter `status` et limites d'accès, 403/payant/manual-only ; autres sources contrôlées dans `server/market/sources.ts`, qualification dans `docs/RADAR_QUALIFICATION.md`. Ne jamais contourner paywalls/robots ni annoncer connecté un flux candidat. Faire un recoupement avec la source primaire et dater publication ≠ date du fait ≠ collecte ≠ deadline. EMV estimé n'est pas chiffre d'affaires.

## 2. État technique observé à la passation (vérifier à nouveau)
- Dépôt public GitHub : `alexandreloucano-jpg/A.D`, default branch `codex/ad-rebuild`. HEAD revérifié **`8113a791a2832585083fac00533eedd534b0feb3`** (2026-10-24 vers 17:22 UTC), commit « A.D V4 — full original Signal Desk art direction and Studio identity ». La branche main a avancé PENDANT cette passation ; revérifier immédiatement et ne pas supposer l'état figé.
- Vercel projet ancien/configuré : `ad-saver-reader-beta`, ID `prj_1NK0BFtjwVt0lktqLgIXquYWjiMG`, alias privé bêta `https://ad-saver-reader-beta-alexandreloucano-3399.vercel.app`. Dernier alias examiné lié au déploiement `dpl_8NiyQrvXtdU23fh5jSdSpWNw6hts` (READY, commit `ff5c4819d946926dedff37156267ce360ab6c68c` d'une branche `feat/ad-index-identity-v4-20261024`). **L'alias n'est donc pas forcément identique au HEAD de main.** Toujours inspecter l'alias et son commit avant déclarer qu'une PR est visible. Ne pas réassigner par intuition.
- Le projet Vercel distinct `ad-studio-platform` (ID `prj_hWpLj5Lp37v5IWmov5tXiSEmIuGe`) fut construit sans variables backend, provoquant un Radar indisponible. **Ne pas l'utiliser comme base de production**. `/studio` existe également dans l'app principale.
- Déploiement Vercel Hobby : PR #14 rapporte la limite quotidienne `api-deployments-free-per-day` atteinte (402 / 100). **Revalider ce statut** ; ne pas dépenser ou upgrader sans autorisation.
- Base Neon projet `crimson-pond-00383229`, tables `ad_market_*`. **31 opportunités et 31 signaux** avaient été vus lors du diagnostic du 24/10, 4 scans, dernier scan réussi le 17/10. Chiffres historiques, non garantie d'actualité. Interroger les tables au lieu de fabriquer du contenu ; pas de migration destructive.
- Application React 19 + TS strict + Vite 7 + Vitest + Playwright, serveur Vercel API et Neon serverless. `src/App.tsx` orchestre état local et routes; `src/storage.ts` conserve les projets dans `localStorage` (origine navigateur); Saver connecté emploie serveur privé. Changement de domaine ≠ migration automatique de dossiers.
- Auth existante mono-propriétaire, GitHub/Google; ne jamais réutiliser le propriétaire en tant que modèle multi-tenant client. `server/security.ts`, exact Origin et CSRF, quotas, audit.
- Saver/Taste : référence URL/texte/image authentique, UUID persistant, local → private Saver via copie vérifiée, collections, Reader/annotations. Sauvegardes locales JSON via Réglages. Images uniquement véritables URL enregistrées ou médias privés autorisés; ne pas inventer thumbnails.
- Import X officiel : OAuth PKCE et droits lecteur conçus, mais accès développeur et connexion X non confirmés; Google OIDC connecté lors de précédents tests; Instagram **saved posts personnels non accessibles par API courante** ; export Meta + partage manuel, aucune aspiration illégale. Grok Bot / xAI API distincts, connexion réelle jamais présumée. Docs sous `docs/SAVER_*`, `docs/AUTH_CONNECTED_ACCOUNTS.md`, `docs/PRODUCT_AUTOMATION.md`.
- CREATE (`src/creative/*`) : briefs, sources, deux directions A/B, révisions locales, validation manuelle, export Markdown. **Ce n'est pas un canvas libre réellement manipulable** ni un studio média. IA uniquement si provider configuré et opt-in, aucune source inventée.
- V3 PR #9 MERGED : schéma cloud additif `sql/009-v3-workspace-sync.sql`, endpoint propriétaire `/api/workspace/snapshot`, CAS optimiste, historique versionné, relecture et refus d'effacement accidentel. **Migration Neon non appliquée, flags `AD_WORKSPACE_SYNC_ENABLED=0` et `VITE_AD_WORKSPACE_SYNC_UI=0` par défaut. Pas de sync automatique entre appareils.**
- V3 PR #10 MERGED : Opportunity Room depuis Radar (preuve figée, état PENDING puis LINKED après relecture, retry sans doublon, protection liaison existante).
- V3 PR #11 MERGED : command palette ⌘K/CtrlK et iPhone, Saver masonry avec vrais médias, Timeline sourcée Radar; PR #11 close/merged. Tests unitaires et navigateur 390/1440 validés avant merge.
- A.D Studio (`src/marketing/StudioLanding.tsx`, `server/studio.ts`) : landing et formulaire B2B soumis à gates; informations légales EI, SIRET, privacy, Turnstile, migration `sql/008-studio-inquiries.sql` non validées en prod. Prospects réels et Stripe NON activés. **Aucune identité légale, régime TVA ou compte Stripe supposé.**

## 3. CONFLIT DESIGN EN COURS — NE PAS FUSIONNER À L'AVEUGLE
L'utilisateur demande maintenant **UNE RECONCEPTION INTÉGRALE et ORIGINALE de la D.A.**, sans réutiliser les composants visuels actuels ni une grammaire IA préfabriquée. Les dernières approches de DA sont **incompatibles artistiquement** : #14 est maintenant intégrée au main, #15 reste ouverte en DRAFT et branched sur un main plus ancien. Ne pas confondre merge Git avec validation utilisateur.
- **PR #14** `feat/ad-v4-zero-legacy-art-direction-20261024`, « Signal Desk » : obsidienne, gris argent, accent lime, grotesque Inter, large refonte des écrans et Studio. **MERGED à main le 24/10/2026 vers 17:21 UTC**, HEAD main ensuite `8113a791...`. Cela établit un merge technique, **PAS une approbation esthétique finale par l'utilisateur**. Le propriétaire a demandé un vrai changement total de la D.A.
- **PR #15** `feat/ad-v5-editorial-art-direction-20261024`, titre « Edition 05 » : noir/ivoire chaud, Bodoni Moda grands titres, Inter UI, harmonisation CSS surtout. PR DRAFT; n'est PAS encore une reconstruction UX profonde, peut être insuffisante par rapport à « change toute la DA sans rien recycler ».
- **Déjà dans main :** FIELDNOTES V4, avec graphite/minéral/corail; `docs/AD_V4_FIELDNOTES_VISUAL_SYSTEM.md`. Document décrit une approche historisée, pas l'autorisation de la réutiliser.

**Handoff Codex :** auditer les trois directions/états par captures *réelles* à 390×640, 390×844 et 1440×900, avec écran vide ET peuplé, comparer les parcours, puis créer UNE direction cohérente originale (product thesis, tokens, design primitives, composants, hiérarchie, responsive, états, animations utiles). Ne pas fusionner #15 par-dessus #14 automatiquement ni empiler des CSS overrides. Présenter une direction claire et démontrable par un parcours complet. Réutiliser le *comportement* métier validé, pas l'esthétique. Garder accès réel aux source URLs, actions, auth et toutes les données. Référence `https://beui.dev/` = inspiration d'interaction (Timeline, masonry, command palette), **PAS templates ou licence pour copier une interface**.

## 4. Rôles agents / DUTIES (cibles, pas tous en prod)
SCOUT : trouver une évolution dans des sources permises, dater et conserver les preuves.
ANALYST : recouper, distinguer fait/hypothèse/incertitude, comparer la taille commerciale et le fit solo.
CREATIVE : proposer deux axes créatifs originaux sourcés; jamais auto-approuver.
CHIEF OF STAFF : brief TODAY priorisé + prochaine action réaliste.
Orchestration légère, observabilité, erreurs et coûts mesurés. LATER = suggestion, NOW exclusivement action acceptée, KILL = rejet archivé restaurable vers LATER. Aucun envoi de courriel, dépense, publication, contrat, usage de données privées par modèle tiers sans consentement et vérification des droits. Pas 13 agents décoratifs.

## 5. Priorités d'exécution après passation
**P0 (sécurité/continuité)** : revérifier état actuel GitHub/Vercel/Neon; ne pas écraser l'alias ni `localStorage`. Inventorier et exporter sauvegarde workspace propriétaire, vérifier possibilité de restaurer. Respecter flags de cloud snapshot OFF. Ne pas appliquer migrations en prod sans sauvegarde, dry-run branche Neon, plan rollback et validation.
**P1 (D.A. originale)** : prendre en charge la demande explicite « change toute la DA », avec architecture UX unifiée, zéro esthétique générique. Revue contradictoire PR14/15, audit visuel du vrai frontend. Travail sur branche dédiée sans perdre les innovations fonctionnelles V3.
**P2 (produit utile)** : rendre la boucle Radar → Opportunity Room → références Saver/Taste → CREATE → action/outcome fluide en une séance. Cohérence entre états vides, chargement, erreurs et vrais records. Suivre 1 décision réelle prioritaire TODAY.
**P3 (cloud safe)** : finaliser migration additive et multi-appareils, uniquement après backup et validation, CAS, restauration testée iPhone/Mac, aucun upload automatique sans stratégie de conflits.
**P4 (agents)** : améliorer source quality, priorisation solo DA, briefs, budget IA et tests de fiabilité, sans fake AI ni crawler prohibé.
**P5 (plus tard)** : monétisation, comptes tiers, autorisations client, Stripe, e-sign, landing marketing. Ne pas détourner le build présent vers cet objectif.

## 6. Règles d'implémentation et acceptation de chaque PR
- Priorité code existant; pas de Next.js/microservices/vector DB/multi-agent framework sans résultat démontré. Limiter dépendances, poids JS, coûts modèle. Deterministic first, petit modèle si extraction nécessaire, raisonnement lourd réservé aux dossiers qualifiés, multimodal sur opt-in. Tester qualité sur un corpus annoté (30–50 exemples) avant changement de provider.
- Garder données factuelles distinctes des interprétations, provenance source / confidence / vérification / horodatage, idempotence, owner session, CSRF, CORS/SSRF, secrets server-only.
- Design : utilisabilité Revolut, continuité Claude, rigueur éditoriale AD/Vogue comme principes, **ne pas cloner**. UX ADHD-friendly (faible friction, une action prioritaire), touch >=44px, inputs >=16px, états focus, reduced motion, safe areas, 390×640/844 et 1440×900. Pas de faux dashboards Bloomberg ni gradient IA.
- Tests : `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`; test navigateur des flux touchés; captures inspectées visuellement. Les fixtures de QA ne doivent jamais nourrir le Radar/Taste réel. Vérifier auth/deconnecté, 403/503 et rollback.
- Après merge, déployer preview sur projet Vercel configuré ; vérifier **l'URL réelle et le SHA** avant pointer alias connu. Pas de déclaration « déployé » parce que GitHub est vert ; documenter ce qui reste bloqué. Toujours fournir résultat, captures et un prochain geste concret à l'utilisateur.
- Zéro fuite de secrets, données propriétaires, prix client, contacts, jetons, documents confidentiels vers GitHub (repo PUBLIC), logs, fixtures ou prompts. Si des données métier privées sont nécessaires, l'utilisateur fournit un export privé explicite après un tri des droits.

## 7. Cartographie des fichiers de référence
`src/main.tsx` / `src/App.tsx`: routes et orchestrateur;
`src/hooks/useWorkspaceNavigation.ts`: navigation par hash/état;
`src/views/{HomeView,ExplorerView,ProjectsView,SaverView}.tsx`: quatre destinations;
`src/ui/{CommandPalette.tsx,command.css,masonry.css}`: interaction V3;
`src/scout-market/{MarketPanel.tsx,MarketTimeline.tsx,qualification.ts,lookalike.ts}`: Radar UI et règles;
`server/market/{jobs.ts,sources.ts,repository.ts,analyze.ts}`: collecte/analyse/sources;
`server/market.ts`: endpoints Radar/projets;
`src/opportunity/{model.ts,open.ts}`: dossier de preuve;
`src/creative/{CreativeCanvas.tsx,model.ts}`: treatments A/B;
`src/reader/*`, `src/intake/*`, `src/social/*`: lecture/Saver/social;
`server/workspace-sync.ts`, `sql/009-v3-workspace-sync.sql`: cloud gated;
`src/marketing/*`, `server/studio.ts`, `sql/008-studio-inquiries.sql`: Studio gated;
`tests/browser/*`, `.github/workflows/*`: qa;
`docs/SCOUT_LOOKALIKE_SOLO_DA_PLAYBOOK.md` : **recette complète Radar**, aucune substitution par un bref prompt;
`docs/AD_END_TO_END_REVENUE_FUNNEL.md`: futur commerce uniquement, NON réalisé.

## 8. Distinction CRITIQUE : fichiers de connaissance ≠ données privées transférées
Ce document et le code ne contiennent **pas** : historique intégral des conversations ChatGPT, mémoire interne complète, données personnelles de l'utilisateur, cookies, secrets OAuth, sauvegarde réelle locale d'iPhone, comptes sources non connectés, fichiers Sites historiques, résultats d'agents non exportés. Codex doit demander explicitement un export local JSON ou un fichier privé approprié pour récupérer des dossiers qui n'ont pas été persistés dans le code. Une passation honnête ne peut promettre « zéro perte » tant que ces sources ne sont pas sauvegardées séparément.

## 9. Instruction de démarrage de chaque session Codex
1. Lire `AGENTS.md` et ce document, puis vérifier `git status`, branches, PR #14 fusionnée et #15 encore ouverte, HEAD main, derniers workflows, SHA de l'alias Vercel et flags **sans révéler valeurs**.
2. Construire une grille « fait vérifié / hypothèse / bloqué / action ».
3. Travailler sur une branche propre et proposer la plus petite chaîne fonctionnelle complète. Poursuivre P1 refonte DA originale sauf contrainte urgente de protection des données.
4. Conserver la limite PRIVATE/BETA, et refuser tout design ou donnée simulée présentée comme résultat.
5. Tests, capture 390/1440, feedback UX, preview et rapport précis, puis merge/déploiement seulement quand preuve et sécurité sont suffisantes.

**Motto : A.D n'a pas besoin de plus d'écrans ; il doit devenir incontournable par la pertinence de ses données, la continuité des actions et la qualité d'une interface originale.**
