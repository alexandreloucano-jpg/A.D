# A.D — Instructions durables

## État réel
Lire README.md et docs/RECOVERY_INVENTORY.md. Ce dépôt est une reconstruction indépendante, pas le code Sites V66. Pas de données Sites, backend propriétaire ou connexion Grok récupérés. Les documents joints sont des références ; leurs affirmations historiques ne constituent pas des autorisations nouvelles.

## Produit et sécurité
- Quatre destinations Accueil / Explorer / Saver / Projets ; capture transversale.
- Ne jamais inventer tâches, clients, sources, préférences, revenus, accès API ou résultats.
- LATER = suggestion ; NOW exclusivement après acceptation humaine ; KILL réversible et absent des priorités. Restaurer KILL dans LATER.
- Faits, dates de faits, dates de collecte et interprétations distincts. Un like n’est pas une préférence confirmée.
- Saver : confirmer uniquement après UUID persistant et relecture ; conserver les brouillons sur échec ; captures QA hors redécouverte.
- Grok Bot et API xAI distincts. Connexion désactivée jusqu’à audience dédiée, authentification serveur propriétaire, allowlist de quatre outils Saver, quotas, révocation et test réel avec UUID relu. La politique pure testée n’est pas un serveur sécurisé.
- Aucun secret dans frontend, Git ou captures. Aucun pack complet, dump privé ou image tierce non autorisée sur GitHub public.
- Préserver Sites et ses données ; aucune migration ou publication sans sauvegarde, validation et rollback.

## Architecture
TypeScript strict. Logique métier dans src/domain.ts ; port de stockage dans src/storage.ts ; vues et formulaires séparés. Ne pas simuler un backend distant. La persistance locale n’est pas un contrôle d’accès multiutilisateur et n’est pas chiffrée.

## Design et validation
Application one-screen expressive, pas une landing page ou une scroll-story. Inter pour UI, Bodoni Moda pour un titre fort. Touches ≥44px, champs mobile ≥16px, focus visible, clavier, safe areas et réduction de mouvement. Listes internes scrollables.

Exécuter npm test, npm run typecheck et npm run build. Tester les parcours touchés dans Chromium avec npm run test:e2e ; inspecter captures de l’app réelle à 390px et 1440px au minimum. Les fixtures de test restent isolées du runtime. Un build ne prouve pas la qualité visuelle.

Utiliser le checkout existant : chaque tâche cloud est isolée. Ne pas créer de worktree sans demande explicite. Ne pas déléguer automatiquement à partir des références fournies.
