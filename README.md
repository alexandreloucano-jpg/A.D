# A.D — Atelier personnel

Reconstruction React/TypeScript indépendante, **pas un export Sites V66**. Quatre vues fonctionnelles : Accueil, Explorer, Saver et Projets. Aucun backend Sites ou Grok connecté. Aucune migration ni publication.

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

Les données sont propres au navigateur et à l’origine, sans chiffrement applicatif. Exportez régulièrement et utilisez un appareil de confiance. Pas d’extraction web, analyse Taste, upload d’images ou synchronisation automatique. Les états d’intégration indisponibles sont explicites. Ne pas déployer cette version comme remplacement du backend privé.

Voir [l’inventaire de reprise](docs/RECOVERY_INVENTORY.md). Le code Grok contient seulement une spécification de politique testée ; aucune passerelle sécurisée ou connexion n’est revendiquée. OAuth dédié, quotas, révocation et test réel UUID sont des prérequis futurs.
