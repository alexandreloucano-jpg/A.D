# Inventaire de reprise — 14 octobre 2026

Le ZIP AD_CODEX_RECOVERY_2026-10-14 a été vérifié par son script : 83 fichiers, 6 archives, manifest conforme. Ce contrôle concerne le pack, pas l’application Sites.

## Effectivement disponible

- Règles produit et sécurité, profils Grok, contrats UX.
- Prototype HTML/CSS/JS one-screen et SVG original architecture, adaptateur de cadre React.
- Exemples xAI et MCP : code de référence, sans preuve de compatibilité serveur actuelle.
- Instructions AGENTS originales et de reprise. Les assertions d’autorisation antérieures dans le pack sont des éléments historiques, pas une nouvelle autorisation.

## Non récupéré

- Source complète Sites V66 et gateway V1, historique, backend, schéma de données, sessions et sauvegarde privée.
- Aucun outil Sites ou navigateur propriétaire authentifié disponible dans cette session. Les requêtes HTTPS aux deux domaines Sites sont refusées par le proxy (CONNECT 403). Aucun endpoint d’export n’a été deviné.
- Le dépôt distant était vide : aucun ref renvoyé par `git ls-remote origin`.
- L’ancien reçu MCP fourni est un témoignage historique, pas un test de la reconstruction ni une connexion Grok.

## Reconstruction indépendante

React/TypeScript strict + Vite, fonts locales, persistance navigateur validée par schéma avec relecture et détection de modifications concurrentes. Aucune API distante supposée. Pas d’authentification serveur : ce premier incrément est un espace local, pas un backend multiutilisateur. Aucun secret demandé. Les références et projets visibles proviennent exclusivement de saisies de l’utilisateur. Les tests isolés utilisent des données synthétiques.

Le SVG `public/architecture.svg` provient du prototype one-screen du pack, explicitement autorisé comme référence réutilisable. Aucun screenshot, photographie, reçu privé, ZIP ou dump du pack n’est publié. Le prototype n’est pas présenté comme code Sites.

## Migration

Sites reste l’application indépendante de référence pour les anciennes données. Aucun déploiement ou changement de passerelle. Avant bascule : obtenir export authentifié du code et contrats, sauvegarde privée vérifiée, identité propriétaire serveur, tests d’isolation, staging, comparaison des IDs/comptages, restauration testée et rollback vers Sites conservé. L’import local accepte uniquement le format de cette reconstruction ; ce n’est pas un import Sites.
