# Connexions Saver — mode volontaire

Cette évolution remplace le mode d’import automatique décrit dans PRODUCT_AUTOMATION.md. Aucun nouveau stockage, compte propriétaire, connecteur ni fournisseur n’est créé.

## Parcours et preuves

Google authentifie le propriétaire A.D lié à l’identité GitHub existante. L’autorisation Grok porte exclusivement sur la passerelle Saver dédiée. X et Instagram ont des consentements distincts. Une inscription MCP ou un jeton OAuth n’est pas une preuve d’échange Grok : le statut reste « échange à vérifier » jusqu’à une sauvegarde approuvée puis une relecture MCP du même UUID, avec un client lié au callback Grok exact et un accès encore valide. Le serveur relit aussi cet UUID dans la bibliothèque propriétaire avant de confirmer l’état. L’inscription publique n’octroie aucun accès. Une expiration ou une révocation coupe l’état connecté.

Les statuts distinguent non configuré, prêt, consentement requis, échange à vérifier, connecté, expiré et erreur. Les erreurs serveur exposent un identifiant de diagnostic sans jeton. Les déconnexions conservent la bibliothèque et révoquent aussi les codes/consentements MCP en cours.

## X : aucune synchronisation automatique

Le callback ne récupère que l’identité et les jetons, jamais les signets. Aucun job de maintenance, ouverture d’écran ou minuteur ne déclenche d’import. Le workflow existant devient strictement manuel. L’ancienne route d’activation automatique refuse `enabled: true`, y compris pour un ancien compte.

Chaque import propriétaire protégé par CSRF demande une seule page de cinq signets maximum. Une réponse plus grande est refusée avant écriture. Le curseur permet une reprise volontaire ; les UUID stables et la provenance sont conservés. Le texte source reste séparé des corrections, annotations et groupes humains. Une reconnexion du même compte garde la progression.

Les seuls scopes sont bookmark.read, tweet.read, users.read et offline.access (renouvellement serveur). Aucun droit d’écriture X, publication ou messagerie. Le callback est https://ad-saver-reader-beta-alexandreloucano-3399.vercel.app/api/x/callback.

Au 15 octobre 2026, la documentation X indique des crédits prépayés et une facturation à l’usage. Le tarif et l’éligibilité « Owned Reads » doivent être vérifiés dans la console de l’opérateur. Aucune dépense ni recharge n’est autorisée ici. `X_BOOKMARK_IMPORT_ALLOWED=1` est un verrou d’exploitation supplémentaire, désactivé par défaut : les identifiants OAuth seuls ne permettent pas de lancer un import facturable. Aucun paramètre technique n’est demandé à l’utilisateur final.

Documentation officielle consultée :
- https://docs.x.com/x-api/bookmarks/get-bookmarks (max_results de 1 à 100 ; page volontaire limitée ici à 5 ; post.fields)
- https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code (PKCE, scopes, callback exact)
- https://docs.x.com/x-api/getting-started/pricing (crédits et facturation à l’usage)

## Instagram : capacité réelle

Instagram Login est réservé aux comptes professionnels Business et Creator. Le scope conservé est instagram_business_basic. L’API documentée donne accès au profil et aux médias autorisés du compte ; aucune capacité documentée ne donne accès à la liste des publications enregistrées. Les favoris ne sont donc pas importés. L’ajout manuel ouvre le vrai formulaire de capture existant, sans exiger de connexion Instagram. Un lien partagé/texte reçu reste un brouillon jusqu’à sauvegarde et relecture. Aucun scraping, cookie exporté ou contournement.

Standard Access vise les comptes professionnels possédés/gérés par l’opérateur et les rôles de test. Une distribution à d’autres comptes demande Advanced Access, App Review et Business Verification. Le callback préparé est https://ad-saver-reader-beta-alexandreloucano-3399.vercel.app/api/instagram/callback. Les jetons restent chiffrés côté serveur ; les renouvellements de jetons ne constituent pas un import de médias.

Documentation officielle consultée :
- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/
- https://developers.facebook.com/documentation/instagram-platform/overview
- https://developers.facebook.com/documentation/instagram-platform/reference

## Limites de vérification

Les tests avec réponses fournisseur simulées vérifient les protections, limites, dédoublonnages, erreurs et affichages. Les vérifications HTTPS déployées vérifient la découverte OAuth/MCP, les refus sans authentification et l’isolation des routes. Aucune de ces preuves ne remplace le consentement personnel et un véritable échange depuis Grok. X/Meta restent non configurés en l’absence des accès opérateur réels. Les écritures QA restent hors de la bibliothèque créative. Aucun ancien service Sites/Sandro n’est modifié.
