# Première reconstruction — validation du 14 octobre 2026

## Exécuté dans la machine cloud

- `npm ci` : installation depuis lockfile.
- TypeScript strict : aucun diagnostic.
- 16 tests métier/stockage/politique : réussis (Vitest 5.0.4).
- 14 tests Chromium : réussis. Navigation/historique/focus, capture puis relecture UUID après reload, liaison projet, LATER/NOW/KILL, échec quota avec brouillon conservé, import/export avec remplacement confirmé, protection de stockage illisible, provenance Grok manuelle.
- Build Vite production réussi. JavaScript initial environ 104 ko gzip ; fonts locales, aucune dépendance à Google Fonts. Ce poids n’est pas une mesure de latence utilisateur.
- Audit npm complet après mise à jour de Vitest : 0 vulnérabilité signalée. Un audit de dépendances ne certifie pas la sécurité d’un serveur.

## Contrôles visuels réels

Captures de l’application React montée dans Chromium à 375, 390, 430, 768 et 1440px, quatre vues. Scénarios peuplés à 390/1440 par saisie via les formulaires, dans des contextes de test isolés. Ces contenus synthétiques ne sont jamais importés au runtime normal.

Absence de débordement horizontal ou vertical de page contrôlée ; contenu défilant dans les zones internes. Premier signal et lien source visibles au premier écran 390px dans le scénario contrôlé. Captures Accueil desktop/mobile, Explorer mobile, Saver mobile et Projets desktop inspectées visuellement. Les fichiers de revue sont conservés dans `/workspace/ad-review/`, hors Git ; régénération via `npm run test:e2e`.

## Limites explicites

Pas d’API serveur, identité propriétaire, base Sites, extraction web, images à uploader ou Taste connecté. Pas de mock réseau présenté comme un service réel. Les contrôles d’autorité sont locaux, modifiables par le propriétaire de son navigateur ; ils ne certifient pas une sécurité backend. Le contrôle de version de stockage détecte les écritures obsolètes ; il ne remplace pas une transaction serveur multiutilisateur.

Grok : code gateway original non récupéré, authentification distante non vérifiée, aucune connexion ni sauvegarde Grok → MCP réalisée. Les tests de politique sont une spécification locale, pas une certification du gateway Sites. L’ancien reçu MCP fourni dans le pack n’a pas été relu ici.

Sites : aucun accès aux données, changement, publication ou migration. La prochaine étape d’intégration reste l’export authentifié source/contrats et une sauvegarde privée vérifiée, suivi d’un backend propriétaire en staging.
