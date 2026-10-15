# Saver — automatisation et interface utilisateur

> Mise à jour : [Connexions en mode volontaire](SAVER_CONNECTIONS_MANUAL.md) remplace les sections d’import automatique X et de déclenchement périodique ci-dessous. Aucun import social automatique n’est désormais actif.

## Parcours quotidien

L’utilisateur se connecte à Google, puis autorise les services qu’il souhaite relier dans **Mes connexions**. Il ne doit ni gérer les jetons, ni créer des clients OAuth, ni remplir des URLs techniques, ni importer du JSON pour utiliser Saver. Les réglages courants affichent le compte et une sauvegarde/restauration facultative. Les quatre modules restent actifs et les données locales sont conservées.

Les anciennes opérations de dépannage sont conservées exclusivement dans le back-office (`/#/saver?admin=1&settings=1`). Ce paramètre sélectionne l’écran, **ce n’est pas une autorisation** : toute API administrative exige toujours la session propriétaire côté serveur. La bêta reste mono-propriétaire ; cela ne constitue pas encore une gestion commerciale de comptes multiples.

Après connexion, les références locales non QA manquantes sont copiées automatiquement, avec leurs UUID, sans effacement des originaux. Les doublons ne sont pas recréés ; une sauvegarde échouée reste locale et une nouvelle actualisation permet la reprise. Les annotations et groupes existants ne sont pas remplacés. Projets/signaux restent locaux comme auparavant ; aucune migration Sites n’est tentée.

## Connexion Grok automatique

La découverte OAuth de la passerelle publie `/register` (RFC 7591), le token endpoint, les scopes et le renouvellement. Grok peut enregistrer son client côté serveur plutôt que demander un Client ID/secret à l’utilisateur. Le code public Grok indique un `registrationEndpoint` dans les métadonnées découvertes ; le support final doit être validé depuis le compte Grok réel.

L’enregistrement n’est pas un accès aux données. Il n’autorise qu’un unique callback vérifié `https://grok.com/connectors-oauth-exchange-code/`, la ressource MCP Saver dédiée et les scopes Saver. Aucun callback supposé, wildcard ou téléchargement de metadata fourni par le client. Les quotas d’enregistrement sont persistants (10/heure, 40/jour). Le consentement propriétaire et PKCE S256 restent obligatoires. Les clients publics OAuth n’ont pas de secret à copier, mais doivent prouver le vérificateur PKCE. Les clients confidentiels conservent un secret haché.

Un paramètre `resource` absent lors de l’échange ne change jamais l’audience : le code conservé côté serveur est obligatoirement lié au propriétaire, au client, au callback et à l’unique audience dédiée. Une autre audience explicite est rejetée. Les scopes restent stricts. Les refresh tokens opaques sont hachés, expirent après 30 jours, sont renouvelés à chaque utilisation et ne peuvent pas être réutilisés. La déconnexion coupe les clients et leurs accès. Aucun outil global, projet, tâche ou préférence n’est exposé.

Grok reste maître de son écran d’ajout de connecteur : A.D ne peut pas modifier le compte Grok sans son consentement. Si Grok exige encore l’URL du serveur, **Connecter Grok** prépare sa copie ; ce point d’interface tiers ne doit pas être présenté comme une connexion déjà faite. Aucun identifiant technique n’est demandé dans l’interface quotidienne A.D.

## Synchronisation et renouvellements

Une nouvelle autorisation X active l’import automatique et lance immédiatement une première synchronisation. Les comptes précédemment mis en pause ne sont pas réactivés implicitement. Les synchronisations suivantes utilisent les leases SQL, les UUID déterministes, la pagination et les quotas existants. Les erreurs conservent l’état de reprise et ne suppriment aucune référence. La pause et la déconnexion restent des choix utilisateur.

Instagram échange côté serveur le jeton initial contre un jeton longue durée et le renouvelle périodiquement (sept jours, dans les conditions Meta). Les jetons restent chiffrés ; un renouvellement en retard ne ressuscite pas un compte déconnecté. Une autorisation révoquée/expirée nécessite naturellement un nouveau consentement. **L’API Instagram ne donne pas accès aux publications enregistrées** ; aucune automatisation ne prétend le contraire. Le partage iPhone reste indépendant.

Une exécution de maintenance est déclenchée en ouverture du compte et toutes les 30 minutes lorsque l’application reste visible. Le workflow GitHub `connections.yml`, sur la branche par défaut existante, prévoit aussi une exécution toutes les 30 minutes sans navigateur ouvert. Les horaires GitHub peuvent être retardés ; ce n’est pas du temps réel garanti.

Le workflow n’a aucune clé API ni secret de dépôt. GitHub émet une identité OIDC temporaire ; le relais vérifie sa signature, issuer, audience, dépôt, branche, workflow exact, événement et identifiant d’exécution. Les PR, forks et autres workflows sont refusés. Une exécution ne peut déclencher qu’un job fixe de maintenance, jamais un appel HTTP arbitraire ni une session propriétaire.

L’application conserve son SSO Vercel. Le relais serveur possède un accès d’automatisation de projet et une clé **limitée au job** ; ces valeurs restent dans les deux services, jamais dans le frontend ni GitHub. Les API Saver exigent toujours l’authentification propriétaire et refusent cette clé de job. Les quotas et le lease distribué empêchent les chevauchements et la répétition d’un même run. `/api/admin/automation` donne au propriétaire la dernière exécution sans exposer de credentials.

## Administration et limites externes

Les applications OAuth Google/Meta/X, permissions fournisseur, budgets API et secrets relèvent de l’opérateur du service. Ils ne doivent pas être demandés aux futurs clients. Les outils de provisionnement serveur installent les secrets d’automatisation et les politiques SQL sur les deux projets existants. Aucune application supplémentaire, aucun stockage historique modifié, aucun service payant activé.

Au moment de cette évolution : Google et Neon ont déjà une preuve réelle de connexion/lecture ; l’accès développeur X manque, Meta n’est pas configuré et aucun fournisseur IA n’est activé. Ces services restent honnêtement indisponibles. Le classement manuel reste utilisable ; les suggestions IA, lorsqu’un fournisseur sera activé côté exploitation, exigeront toujours l’approbation humaine. Les tâches NOW et les préférences confirmées ne sont jamais modifiées automatiquement.

La mise en place de l’automatisation ne rend pas cette bêta commercialisable à elle seule : identité mono-propriétaire, isolation de futurs comptes, exploitation et autorisations fournisseurs doivent être traitées avant une ouverture publique multiutilisateur.
