# Sandro Job Finder — Career Radar V4

Extension du Radar privé : plus de sources publiques de recrutement, rapprochement des villes de Paris, classification enrichie Brand / Social / Communications et interdiction des métiers de designer exécutant.

Commencer par `INDEX.md`. Sources Python/JS : `radarCore.mjs`, `radarSources.mjs`, `wttjSource.mjs`; tests `tests.mjs`.

**Attention :** les liens Welcome to the Jungle provenant de pages éditoriales publiques sont **secondaires**, restent exploratoires et n'apportent pas le descriptif intégral. Ne pas présenter ces résultats comme des offres ATS employeur confirmées.

Installer uniquement via le bootstrap SHA figé de `jobfinder-application-intelligence-v1/bootstrap.cjs` (GitHub), une fois versionné. Mise en production confirmée le 16/11/2026 sur `creative-job-finder.vercel.app/radar` (privé, Vercel Authentication). Release `df3581ad6d53e54436f794262f6280332914446f`, déploiement `dpl_8vXKRmc4LWy8YU6bAJfHHSsXBqug`. 109 tests Radar réussis et contrôles HTTP SSO des dix routes réussis. Le contrôle des interactions authentifiées reste distinct.

## Interface (Radar V4 compact)
Le tableau de bord Radar est réduit aux fonctions de décision. Aucun score marketing affiché ; l’algorithme conserve un classement interne pour ordonner la liste. Les sources sont consultables sous la liste sans encombrer l’interface.