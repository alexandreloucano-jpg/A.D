# A.D — Travailler dans Codex ET dans ChatGPT sans perdre le travail
Dernière mise en place : 24 octobre 2026. Ce document est un **protocole partagé**, pas une copie de données privées et pas la preuve d'une connexion Codex Cloud.

## Une seule source de vérité
- **Dépôt canonique :** `alexandreloucano-jpg/A.D` (GitHub).
- **Branche de référence :** `codex/ad-rebuild` (c'est la branche par défaut, même si son nom contient `codex/`; ne pas présumer `main`).
- **Instructions pérennes :** `AGENTS.md`.
- **Intention produit, architecture, historique et décisions :** `docs/CODEX_HANDOFF_MASTER_2026-10-24.md`.
- **Protocole pour les deux interfaces :** le présent fichier.
- **Sauvegarde du code avant passation :** branche `backup/ad-before-codex-dual-20261024`, épinglée au commit `4ec17f8472520b5676de5d2ab2e6d2d3e7e7fa04` ; ne pas écrire dessus.
- **État réel du produit :** lire les fichiers, PR et déploiements actuels, puis vérifier le SHA de l'alias Vercel. Aucun document daté ne remplace cette vérification.

## Ce qui est partagé ou non
| Actif | Partagé par GitHub ? | Règle |
| --- | --- | --- |
| Sources React, serveur, SQL, tests, assets autorisés, docs | Oui, après commit/push | Les deux agents repartent du HEAD et des PR |
| Branches, commits, PR, revue et CI | Oui | Conserver des PR par tâche pour éviter les conflits |
| Conversations ChatGPT / instructions orales | Non automatiquement | Extraire uniquement les décisions pérennes non sensibles dans une PR de documentation |
| Chats et environnements des tâches Codex | Non comme historique de chat GitHub | Reprendre la tâche d'origine ou committer les fichiers; une nouvelle tâche cloud a son propre espace |
| Dossiers A.D, préférences, captures, photos, exports iPhone `localStorage` | **NON** | Export JSON depuis l'application et garder une copie **privée** sur son appareil |
| Neon / Saver connecté / OAuth / Vercel | NON via les seuls commits | Contrôles séparés : sauvegarde DB, variables serveur, identités, vérification après déploiement |
| Secrets, tokens, client data, échanges privés, export de conversation | **INTERDIT dans ce repo public** | Stocker hors du dépôt; ne pas joindre aux PR/prompts publics |

## Synchronisation des deux agents (GitHub comme arbitre)
1. **Avant tout travail :** `git fetch origin`, contrôler `git status`, `origin/codex/ad-rebuild`, les PR ouvertes et les CI ; lire `AGENTS.md` et le document maître. Si un autre agent est sur les mêmes fichiers, coordonner la tâche plutôt que réécrire ses changements.
2. **Une tâche = une branche depuis le HEAD courant :** `codex/<intention>` pour Codex ou `chatgpt/<intention>` pour les interventions de ChatGPT. Ne pas committer sur la branche canonique directement. Ne pas modifier simultanément les mêmes fichiers depuis deux tâches.
3. **Faire des commits atomiques**, écrire clairement ce qui est modifié, ce qui est testé, ce qui reste bloqué; pousser la branche et créer une **pull request** vers `codex/ad-rebuild`.
4. **Point de passage de relais :** dans la description PR, résumer le besoin utilisateur, fichiers modifiés, décision de conception, tests/commandes exécutées et résultats, captures réelles, risques, données ou flags touchés, prochaine action. Le second agent reprend cette PR, **pas un état de chat présumé**.
5. **Avant merge :** comparer les PR ouvertes, vérifier que la branche est à jour, résoudre les conflits sans perdre le code tiers ; passer `npm run typecheck`, `npm test`, `npm run build` et tests Playwright des parcours touchés. Ne pas confondre CI verte et validation esthétique utilisateur.
6. **Après merge :** les deux agents récupèrent le nouveau `origin/codex/ad-rebuild`. Pour Vercel, preview d'abord, puis alias de bêta uniquement après validation du déploiement READY et de son SHA, avec point de rollback. Ne jamais modifier Neon en production ou activer Stripe/Studio intake/cloud sync par défaut.
7. **Aucune opération risquée implicite :** jamais `git push --force`, `git reset --hard` sur une branche portant un travail, `git clean` non examiné, suppression d'une PR ou de données, ou migrations destructives sans sauvegarde et autorisation explicite.
8. **Si deux branches divergent :** ne pas “copier le dossier” d'une branche à l'autre. Faire une revue des commits puis merge/rebase à partir du dépôt, résoudre les conflits avec tests, et conserver les deux PR jusqu'à confirmation.

### Transmettre une tâche Codex à ChatGPT
Donner ici **le lien GitHub de la PR ou le nom de branche**, ainsi que ce qu'il faut faire ensuite. ChatGPT peut alors lire les vrais commits, les tests et reprendre sur une branche propre. Un message “j'ai changé le design” sans PR ni commit ne transporte pas le code.

### Transmettre une tâche ChatGPT à Codex
Dans Codex, sélectionner ce dépôt et lire `AGENTS.md` / `docs/CODEX_HANDOFF_MASTER_2026-10-24.md` / ce document. Indiquer la PR créée ici s'il y en a une. Codex doit vérifier le code actuel, pas reconstruire les hypothèses à partir d'une conversation isolée.

## Sauvegardes personnelles AVANT une bascule d'appareil/domaine
1. Sur l'ancienne URL A.D **où les dossiers sont réellement visibles**, ouvrir Réglages → Sauvegarde et restauration → Exporter mes données (JSON).
2. Sauvegarder ce fichier sur un support privé (Fichiers/iCloud Drive personnel ou stockage privé approprié). Contrôler date, taille, nombre de dossiers/références et conserver la version d'origine.
3. Sur une copie de test, importer le JSON et vérifier les UUID, dossiers et références. **Ne pas remplacer l'espace actuel sans comparer ni confirmer.**
4. Sauvegarder Neon séparément et documenter la version des migrations avant toute activation de `AD_WORKSPACE_SYNC_ENABLED`. L'API V3 existe mais n'implique PAS une synchronisation multi-appareils déjà active.
5. Pour sauvegarder les discussions : ChatGPT → Paramètres → Contrôles des données → Exporter les données. Conserver l'archive dans un lieu privé ; **ne jamais publier l'export des conversations dans ce dépôt GitHub public.** Un export ne transfère pas automatiquement l'historique interactif dans Codex.

## Premier prompt de reprise dans Codex
> Ouvre le dépôt GitHub `alexandreloucano-jpg/A.D`, branche par défaut `codex/ad-rebuild`. Lis `AGENTS.md`, `docs/CODEX_HANDOFF_MASTER_2026-10-24.md` et `docs/DUAL_CHATGPT_CODEX_WORKFLOW.md`. Commence par un audit **en lecture seule** : HEAD SHA, PR ouvertes, CI, vérités du déploiement Vercel, sauvegardes/migrations et chantier D.A. en cours. Ne supprime rien. Ne suppose pas avoir accès à mes chats ni à mes dossiers locaux. Présente ce qui est vérifié, bloqué et la prochaine PR autonome. Pour coder, ouvre une nouvelle branche/PR; ne fusionne ni ne publie sans tests et validation.

## À retenir
Une migration “sans perte” exige **GitHub + contexte versionné + export privé de l'application**. Codex et ChatGPT peuvent travailler en parallèle sur des branches distinctes, mais ils ne partagent pas automatiquement les conversations, les tâches non commitées ou le `localStorage`.
