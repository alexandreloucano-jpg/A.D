# A.D Studio — acquisition commerciale

## Objet
Page de direction artistique sur /studio, intégrée à React/Vite sans toucher aux routes de l'espace privé (Accueil, Saver, Explorer, Projets).

Inspiration commerciale : la méthode de conversion des équipes seniors externalisées (OMOSA), mais rédaction, identité et offre originales :
- Public : fondateurs indépendants hospitality/nightlife, mode et lifestyle à Paris ;
- Problème : production de contenus sans direction créative durable ;
- Solution : A.D Creative Office, du diagnostic rémunéré au mandat récurrent ;
- Conversion : une demande de premier échange, pas un audit complet offert ;
- Preuves : aucun logo, témoignage ou KPI non vérifié ;
- L'equity reste une discussion privée dans Deals, pas une promesse marketing.

## Parcours commercial
1. Acquisition ciblée (relations, introductions, contenus, éventuellement publicité tracée).
2. /studio : promesse, enjeu, expertise, méthode, qualification.
3. Un brief est préparé depuis le formulaire ; il est transmis seulement par le client mail si l'email professionnel est configuré.
4. Qualification, puis diagnostic payant Brand Thesis (à partir de 3 500 € HT ; dix jours ouvrés).
5. Brand World ou Creative Office, avec périmètre contractuel et budget de production séparés.
6. Les résultats réels alimentent les dossiers Deals, avec approbation humaine.

## Contact et activation
Aucun endpoint public de collecte n'est déployé par cette modification.
- Configurer VITE_AD_STUDIO_CONTACT_EMAIL dans Vercel Preview/Production avec un email de studio professionnel réellement vérifié. Variable Vite publique, jamais un secret.
- Après reconstruction, le formulaire prépare un mailto dans le client email du visiteur. Celui-ci doit envoyer le message lui-même.
- Sans email configuré, le brief est copié localement et la page dit explicitement qu'aucun message n'a été envoyé.
- Ne pas lancer de campagnes payantes sans activer et tester une prise de contact réelle.
- Un futur CRM ou outil de réservation exigera connexion réelle, mesures anti-abus, informations légales et protection des données. Pas de Calendly ou d'email inventé.
- Avant publicité publique, vérifier accès Vercel, politique de confidentialité, mentions légales et canal de contact.

## Contrôles
- npm run build
- npx playwright test tests/browser/studio-landing.spec.ts
- Vérifier 390 px et 1440 px, la navigation, les liens d'ancrage et les champs requis.
- La vue privée reste à / et ne reçoit aucune mutation.
- Aucune migration, connexion sociale ou permission n'est modifiée.

## KPI réels
Après activation du contact : visites pertinentes (avec base légale pour le tracking), demandes reçues, rendez-vous, diagnostics signés, mandats de D.A. conclus, cash encaissé, marge de contribution, coûts de livraison. Ne pas inventer de taux ou de preuve.

## Limite
Version de validation éditoriale et technique, pas une machine de prospection autonome. Pour publication commerciale complète : contact réel, conformité et éventuelles études de cas autorisées.
