# A.D Saver — import X et conservation locale

L’extension A.D intègre le collecteur xarchive (MIT). Le commit source et les adaptations figurent dans xarchive/UPSTREAM.md ; sa licence est conservée dans xarchive/LICENSE et celle de Dexie dans xarchive/vendor/DEXIE-LICENSE. Le collecteur utilise les interfaces GraphQL privées du site X, qui peuvent changer. Aucun crédit de l’API officielle X n’est utilisé.

## Installation sur ordinateur

Décompresser le ZIP, ouvrir chrome://extensions, activer le mode développeur et charger le dossier contenant manifest.json. Ouvrir X connecté à son compte puis ses signets. Dans l’extension A.D, choisir « Importer mes signets X dans Saver », lancer « Full refresh », puis « Envoyer mes signets dans Saver ». Vérifier et enregistrer le lot dans A.D. Le transfert est découpé en lots de 2 000 ; le bouton envoie le lot suivant après confirmation du précédent. L’archive complète et les collectes interrompues restent dans l’extension. Une collecte complète signifie fin de pagination reconnue, pas garantie que X a renvoyé tout l’historique.

Le ZIP est une distribution de développement, pas une publication Chrome Web Store. Cette extension ne s’installe pas sur iPhone. Aucun compte éditeur ou achat n’a été créé. Sur iPhone, le collage de liens et l’import de fichiers restent disponibles ; aucune récupération de la session X du téléphone n’est revendiquée.

## Confidentialité

Les permissions cookies, webRequest et accès aux domaines X sont nécessaires à la collecte autorisée par l’utilisateur. Les en-têtes et cookies de la session restent dans le profil local de l’extension et servent uniquement à X. Ils ne font jamais partie du transfert vers A.D. Le transfert vers l’onglet A.D créé est lié à son identifiant, à un nonce aléatoire et expire après 24 heures. Les téléchargements de médias se limitent aux domaines publics pbs.twimg.com et video.twimg.com, sans cookies ni en-têtes de session, sans redirection.

Aucune collecte programmée. Aucun ajout de tâche, achat, modification du compte X ou groupe IA automatique. Les erreurs de l’interface privée restent explicites. Il est possible de désactiver/désinstaller l’extension à tout moment ; l’accès local à X est alors interrompu. Conserver auparavant ses archives si nécessaire.

## Ce qui est conservé dans A.D

Par défaut, les nouvelles références sont enregistrées uniquement sur l’appareil. Texte, contexte cité fourni, notes, tags et URL sont conservés dans IndexedDB, avec copie locale des références existantes dans le stockage de l’application. Le choix local exclut ces nouvelles références de la migration cloud automatique. Une copie cloud est facultative et demande la session propriétaire existante. Les UUID sont relus, les liens dédoublonnés et les annotations et collections existantes préservées.

Les images et vidéos MP4 accessibles sont copiées dans IndexedDB via l’extension, puis relues. La carte affiche le nombre de fichiers effectivement conservés ; un lien disponible seul ne compte pas comme fichier conservé. Limites par transfert : image 8 Mio, vidéo 24 Mio, types JPEG/PNG/WebP/GIF/MP4. Les fichiers trop volumineux, sources indisponibles et manques d’espace affichent une erreur récupérable ; le texte et les liens restent conservés. Aucune vidéo manquante ou média déjà supprimé n’est reconstitué. Le navigateur et l’onglet doivent rester ouverts pendant les téléchargements. Un rechargement interrompt les fichiers en cours ; « Reprendre la conservation des médias » relance ceux qui ne sont pas confirmés.

Les fichiers confirmés sont lisibles depuis leur copie locale même si l’URL source cesse de fonctionner. Effacer les données du navigateur supprime ces fichiers. L’export JSON de l’espace A.D existant ne contient pas ces fichiers binaires : ne pas le considérer comme une sauvegarde complète de médias. L’archive cumulative xarchive conserve les liens, pas les fichiers. Aucune synchronisation des fichiers entre appareils n’est promise.

L’IA Saver existante n’est ni activée ni remplacée par ce collecteur. Les textes importés sont consultables et recherchables ; toute analyse exige un fournisseur IA effectivement configuré et les autorisations existantes. Les suggestions restent à valider.
