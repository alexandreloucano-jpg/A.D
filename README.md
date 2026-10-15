# A.D — Atelier personnel

Application React/TypeScript existante : Accueil, Explorer, Saver et Projets. La bêta privée Vercel utilise GitHub pour l’identité propriétaire et la base Neon existante pour Saver. Les données historiques Sites restent indépendantes et intactes. Le service MCP dédié est limité à Saver par OAuth et par un rôle PostgreSQL restreint. Aucun compte Grok connecté ni signet X réel importé n’est revendiqué.

État et vérifications de l’intégration X/Scout/lecteur : [docs/SAVER_X_SCOUT_READER.md](docs/SAVER_X_SCOUT_READER.md). L’accès développeur X manque et aucun fournisseur IA n’est configuré dans la bêta ; les états indisponibles sont explicites.

## Développer

Node.js 24 (vérifié), npm 11.

```sh
npm ci --cache /tmp/ad-npm-cache
npm run dev -- --port 5173
```

```sh
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Les tests navigateur utilisent Chromium installé dans `/usr/bin/chromium` (ou `CHROMIUM_PATH`). Ils démarrent Vite, utilisent un contexte navigateur isolé et génèrent des captures dans `test-results/` ; ce dossier n’est pas committé pour protéger les données. Les fonts sont servies localement.

## Ce qui fonctionne

- Navigation avec URL/historique, capture transversale de lien ou texte, provenance manuelle Grok et validation humaine.
- Sauvegarde navigateur validée avec UUID et relecture, projets et liens associés, recherche.
- Suggestions LATER, acceptation explicite NOW, archivage KILL et restauration exclusivement LATER.
- Explorer : faits sourcés saisis par l’utilisateur, date du fait distincte de la collecte, interprétation séparée.
- Export/import de sauvegarde locale validée avec confirmation de remplacement. Aucun fixture de test dans l’application.

Le mode local reste propre au navigateur. Le mode connecté utilise le Saver privé : annotations versionnées, collections, contexte de référence Taste et extraction explicite de sources autorisées. Les jetons X sont chiffrés côté serveur. Aucun import historique ni profil de préférence confirmé n’est déduit de ces opérations. Les fonctions dépendant de X/IA restent bloquées sans configuration et consentement réels.

L’[inventaire de reprise](docs/RECOVERY_INVENTORY.md) décrit l’état historique du 14 octobre. Le service actuel implémente OAuth dédié, quotas, révocation et isolation SQL ; sa connexion à un consommateur Grok reste une vérification distincte qui exige le vrai callback et le consentement de ce consommateur.

## Voir et vérifier le frontend

`npm run preview:export` produit `artifacts/AD-preview.html` : le véritable bundle de production autonome, fonts et SVG inclus, sans données préchargées. Téléchargez ce fichier et ouvrez-le dans un navigateur de confiance ; il utilise sa propre origine de stockage. Si les fichiers HTML locaux sont interdits par votre navigateur, servez-le via HTTP local. `node scripts/verify-preview.mjs` vérifie ce même fichier via HTTP local, navigation et capture réseau coupé après chargement, puis relecture UUID après reload. Aucun service externe n’est utilisé.

Après `npm run test:e2e`, `node scripts/package-review.mjs` regroupe la prévisualisation et les captures 390/1440 dans `artifacts/review/`. Les captures peuplées proviennent exclusivement de contextes Chromium de QA isolés ; elles ne représentent pas des données Sites ni une intégration distante.

Les aperçus Saver utilisent uniquement les URL directes d’images réellement enregistrées (aucune miniature devinée ni extraction distante). Chargement différé, erreur et réessai conservent l’UUID de référence. Explorer distingue le fait rapporté non vérifié, la source, l’interprétation et une piste enregistrable manuellement dans Saver ; aucune tâche n’est créée. Le schéma de stockage reste inchangé.
