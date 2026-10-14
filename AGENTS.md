# A.D — Instructions durables pour Codex

## Référentiel
Lire `README_START_HERE.md` et `CODEX_MASTER_PROMPT.md`. Source de vérité des faits de reprise : `docs/VERIFIED_STATUS_2026-10-14.md`. Source de règles produit : `docs/PRODUCT_AND_ARCHITECTURE.md`. Voir `docs/AGENTS_ORIGINAL_SITES.md` pour les instructions du projet précédent. Consulter `docs/ad-design-intelligence/` selon les besoins ; ne pas charger toutes les skills et rôles en une fois.

## Principes
- Quatre destinations Accueil / Explorer / Saver / Projets ; capture transversale.
- Authentification, privilèges et intégrité des données avant design.
- Ne jamais inventer tâche, priorité, source, client, préférence, revenu, accès API ou résultat de test.
- `LATER` = suggestion à examiner ; `NOW` seulement après validation humaine ; `KILL` absent du travail actif, récupérable.
- Références Saver sourcées ; séparer faits/interprétations ; un like n'est pas une préférence confirmée.
- Grok Bot et xAI API distincts ; Grok Scout autorisé exclusivement sur 4 opérations Saver, avec audience distincte, allowlist réelle et quotas.
- L'app réelle doit être expressive, mobile-first, inspiration one-screen Dribbble *sans* devenir une landing page ; pas de scroll-story.
- Respecter la capture réellement sauvegardée et son UUID ; conserver les drafts sur échec ; aucun frontend secret.

## Techniques
- TypeScript strict, logique d'état testable séparée des composants, UI accessible, API adapters isolés, état réseau explicite et erreurs exploitables.
- Valider sur navigateur réel 390px et 1440px, avec captures inspectables ; ne pas déclarer réussite visuelle sur build.
- Ne pas écraser Sites prod ni migrer des données sans sauvegarde, inventaire et procédure de retour arrière.
- Ne pas pousser le pack entier sans revue sur GitHub public.
