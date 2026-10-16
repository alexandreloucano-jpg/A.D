# Saver : import X et contenu local

Implémentation dans l’extension A.D et les composants React actifs, sans remplacer l’authentification, le backend, les données Neon ou les destinations de l’application.

- Collecteur : xarchive MIT, commit épinglé dans `extensions/ad-saver/xarchive/UPSTREAM.md`. Session X utilisée uniquement dans l’extension. Les requêtes privées peuvent cesser de fonctionner après une modification de X.
- Transfert : collecteur → onglet A.D lié au nonce et à l’identifiant d’onglet → prévisualisation → validation. Aucun jeton/cookie dans le message. Lots de 2 000. L’offset ne progresse qu’après confirmation de l’ensemble du lot ; les sélections partielles conservent le brouillon et son nonce.
- Par défaut : références locales avec UUID relu, dédoublonnage par URL, liste persistante excluant ces UUID de la migration cloud automatique existante. Titres/notes humaines et groupes conservés.
- IndexedDB `ad-saver-content-v1` : textes complets fournis (jusqu’à 200 000 caractères), tags source, notes, auteur disponible, fichiers média et versions précédentes du contenu importé. Recherche locale et lecteur utilisent aussi ce texte. Aucun fichier binaire dans localStorage.
- Médias : téléchargement volontaire consécutif à l’enregistrement, via l’extension et uniquement depuis pbs.twimg.com/video.twimg.com, sans cookies, sans redirection. MIME vérifié, limite image 8 Mio / vidéo MP4 24 Mio, hash SHA-256, relecture et compteur des fichiers effectivement conservés. Les erreurs conservent les URL et permettent la reprise. Un fichier en erreur n’est jamais présenté comme archivé.
- Effacer les données du navigateur supprime les copies locales. L’export de l’espace existant ne contient pas les fichiers binaires. Aucune synchronisation média entre appareils.
- Le ZIP est une extension Chrome/Edge de développement, pas une extension iPhone ni une publication Store. Installation par l’utilisateur nécessaire dans son navigateur. Pas de dépense API officielle X.
- Aucune activation de fournisseur IA, préférence confirmée, groupe IA ou tâche NOW. Le collecteur ne prouve pas une connexion Grok et les contenus strictement locaux ne deviennent pas accessibles au MCP distant.

Validation : tests SQL et protections existants, tests du transfert sans données de session, restrictions CDN, import xarchive, tests navigateur 390/1440 avec une image PNG et un MP4 synthétiques réellement conservés/rechargés, zéro écriture cloud en mode local, recherche plein texte, lecteur et régressions des comptes connectés. Tests amont xarchive exécutés sur fixtures. Aucun import du compte X réel n’est revendiqué. Le Chromium de cet environnement ne charge pas le service worker d’extension ; les interactions Chrome réelles et la collecte X nécessitent une vérification dans un navigateur utilisateur.

## Correctif de reprise 1.1.1

La copie du contenu est réalisée par transactions de 50 références avec progression réelle et relecture. Les cartes hors écran ne déclenchent pas de lectures de fichiers. La reprise des médias publics via l’extension est indépendante de l’onglet initial ; les contrôles des contenus privés restent inchangés. Avec une ancienne extension, A.D tente une copie directe du CDN public sans cookies si CORS le permet. Le navigateur refuse les autres hôtes, redirections, types et tailles non autorisés. Le texte et les UUID sont conservés lors des échecs.

## Reprise globale des grandes bibliothèques

Les médias publics sont désormais lus directement depuis leur CDN avant tout recours à l’extension. Quatre références au maximum sont traitées en parallèle, avec erreurs isolées, vérification locale et compteur global traité/conservé/non récupéré. Au chargement de Saver, les fichiers en attente et les anciennes erreurs « capture expirée/autre onglet » sont repris automatiquement. Les fichiers déjà confirmés sont ignorés. Aucune nouvelle collecte X ni tâche IA n’est déclenchée. Les erreurs définitives restent visibles et peuvent faire l’objet d’un nouveau passage global volontaire.
