# INDEX — Job Finder / Career Radar V4

Statut : candidat à la publication, **pas encore déployé**. Dernière mise à jour : 2026-11-15.

| Source | Priorité | Statut | Quand la consulter |
| --- | --- | --- | --- |
| `RADAR.md` | P0 | Courant | Périmètre métier, typologie de leads, sources, risques et mesures de qualité |
| `REGLES.md` | P0 | Courant | Exclusions designer, règles d'accès aux sources, confidentialité, données RH |
| `DECISIONS.md` | P0 | Courant | Arbitrages approuvés et décisions techniques |
| `PROCESS.md` | P1 | Courant | Tests, validation live, déploiement et rollback |
| `radarCore.mjs` | P0 | Code actif | Classification du poste et éligibilité géographique |
| `radarSources.mjs` | P0 | Code actif | Sources ATS, agrégateurs autorisés, WTTJ et RoleFinder |
| `wttjSource.mjs` | P0 | Code actif | Parsing des pages éditoriales publiques WTTJ sans recherche privée |
| `tests.mjs` | P1 | Tests actifs | Tests métier et source ; vérifier le total à chaque livraison |
| `page.jsx` et `radar.css` | P2 | UI active | Affichage Priority / À explorer, source et lien au dossier |
| `install.cjs` | P1 | Installation | Copie source vers la plateforme privée, exigence de SHA figée |

En cas de contradiction, privilégier les règles P0 et le comportement testé du code ; signaler les divergences et adapter les documents. Chaque ajout, retrait ou modification de fichier doit se répercuter dans cet INDEX. Les listes historiques V2 et V3 ne sont pas la source de vérité de cette livraison.