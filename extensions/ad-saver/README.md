# A.D Saver — capture volontaire dans le navigateur

Code original A.D, sans code ni asset de Gloss, Dewey ou XBookmark.

L’extension Chrome / Edge collecte seulement le texte et les images déjà rendus dans les publications X affichées. Le bouton de collecte des signets fait défiler la page ouverte, au plus 500 publications et 65 secondes. Ce n’est ni un export complet garanti, ni une synchronisation en arrière-plan. Les publications indisponibles et les vidéos non accessibles ne sont pas reconstituées.

Aucune lecture de cookies ou de jetons, aucun appel d’API X privée. Permissions : activeTab, scripting, storage. Le transfert est limité au domaine de la bêta A.D et à l’onglet créé, avec identifiant de capture aléatoire, expiration de 24 heures et confirmation après sauvegarde vérifiée. Il faut une session propriétaire A.D pour enregistrer dans Neon. Fermer l’extension ne suffit pas à confirmer une sauvegarde.

## Distribution de développement

Le ZIP disponible dans Saver n’est pas une publication Chrome Web Store. Sur ordinateur : décompresser le ZIP, ouvrir chrome://extensions, activer le mode développeur et charger le dossier décompressé. Aucun paiement ou compte de publication n’a été créé. Ne jamais saisir de cookie ou de clé API dans l’extension.

## iPhone

Cette extension Chrome ne fonctionne pas sur iPhone. Dans la bêta web : utiliser le lien partagé d’une publication, puis « Coller une publication ». Ce parcours conserve le lien et le texte réellement fourni ; il ne télécharge pas automatiquement les publications privées. Une véritable cible de partage iOS exige une application / extension native signée et distribuée via Apple ; elle n’est pas incluse dans ce ZIP.

## Fichiers et récupération

Saver accepte CSV, JSON ou signets HTML, au plus 2 000 références et 12 Mo par fichier. Prévisualisation avant enregistrement, lots de 20, UUID stable et relecture serveur. Les doublons de liens X et Instagram sont normalisés. Les titres existants, annotations, collections et tâches sont conservés. Les notes importées sont stockées séparément et consultables dans Saver et sa recherche. Le brouillon est conservé dans l’onglet pour reprendre un échec ; ne pas effacer les données du navigateur avant la fin.

Les médias distants restent des liens vers leur source et peuvent expirer. Aucune copie permanente de médias privés n’est promise. Les exports de fournisseurs tiers ne sont pas présumés compatibles : les champs reconnus sont validés, tout fichier incomplet ou invalide est refusé avant import. Les sauvegardes complètes A.D doivent utiliser la restauration existante pour préserver tous les UUID.
