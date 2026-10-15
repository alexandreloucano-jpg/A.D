# Authentification et comptes connectés — bêta A.D

Cette évolution conserve l’application, la bibliothèque Neon, l’identité propriétaire GitHub `340639438`, les UUID et le service MCP dédié. Aucun appel ni changement à Sandro 365 ou aux données Sites.

## Correctif CSRF

Reproduction dans Chromium : un formulaire servi avec `Referrer-Policy: no-referrer` soumet `Origin: null`. L’ancien contrôle exigeait légitimement l’origine A.D et renvoyait `csrf_rejected`. La réponse HTML utilise désormais `same-origin` : l’origine est transmise en interne, aucun referrer n’est envoyé au callback externe. L’origine exacte ET le jeton restent obligatoires.

Une seconde régression navigateur concernait la CSP `form-action 'self'` : Chromium bloquait la redirection OAuth vers le consommateur. La CSP du seul formulaire autorise aussi l’origine du callback préalablement enregistré pour ce client. Le formulaire poste toujours vers A.D ; la liste serveur des callbacks reste stricte.

L’adaptateur conserve le véritable Host fourni par Vercel, sans se fier à `x-forwarded-host`. Les GET d’API sur un alias sont redirigés vers l’origine canonique avant création/consommation de cookies ou état OAuth. Un POST sur un autre domaine est refusé, sans redirection ni consommation du consentement. Les corps URL-encoded déjà analysés par Vercel restent correctement reconstruits.

Erreurs distinctes :

| Code | Sens |
| --- | --- |
| `form_domain_mismatch` | Domaine de destination différent du canonique |
| `csrf_origin_missing` | En-tête Origin absent |
| `csrf_origin_opaque` | Origin `null` |
| `csrf_origin_mismatch` | Autre origine HTTP |
| `csrf_token_missing` | Jeton CSRF absent |
| `csrf_token_invalid` | Jeton différent de celui de la session |
| `owner_session_required` | Aucune session propriétaire |
| `owner_session_expired` | Cookie présent mais session expirée/révoquée |

Les nouveaux rejets journalisent uniquement identifiant de requête, rôle du service, méthode, statut et code interne. Aucun jeton, code OAuth, cookie, query string ou corps fournisseur. Les anciens identifiants d’erreur fournis ne suffisent pas à attribuer rétrospectivement une cause précise : les anciennes réponses n’avaient pas ce journal de corrélation.

## Google OpenID Connect

Configurer **sur le seul projet `ad-saver-reader-beta`, environnement Preview** :

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- Callback exact : `https://ad-saver-reader-beta-alexandreloucano-3399.vercel.app/api/auth/google/callback`
- Client Google de type Application Web ; si écran de consentement en mode test, ajouter le propriétaire comme testeur.

Ces valeurs restent serveur. Aucun placeholder valide ni secret ajouté au dépôt. Sans configuration, Google est explicitement indisponible et GitHub reste utilisable. Il faut redéployer après ajout des variables.

Le lien `/api/auth/google/login` conduit les premières connexions vers une page de liaison : GitHub vérifie d’abord le propriétaire, puis un formulaire explicite propose Google. La liaison est aussi disponible depuis Saver → Comptes connectés → Lier Google. L’opération POST exige CSRF, puis consentement Google. L’état à usage unique est chiffré, lié au cookie navigateur et à la même session GitHub. `state`, `nonce` et PKCE S256 sont vérifiés. JOSE vérifie la signature RS256 via JWKS Google fixe, issuer, audience, azp, durée, exp et nonce. Seul `openid` est demandé, aucun email ni accès Drive/Gmail. Aucun jeton Google n’est conservé après validation.

Connexions suivantes : le `sub` doit correspondre exactement à la liaison privée ; une correspondance email ne donne aucun droit. La session serveur appartient toujours à `340639438`. Son empreinte de liaison est revalidée à chaque accès propriétaire. Délier Google depuis GitHub révoque les sessions Google et préserve la bibliothèque. La passerelle SQL ne peut ni lire ni modifier ces liaisons.

## Instagram et X

Instagram utilise Instagram Login Meta, uniquement pour Creator/Business. Variables serveur Preview : `INSTAGRAM_OAUTH_CLIENT_ID`, `INSTAGRAM_OAUTH_CLIENT_SECRET`. Callback : `https://ad-saver-reader-beta-alexandreloucano-3399.vercel.app/api/instagram/callback`.

Permission demandée : `instagram_business_basic` uniquement. État à usage unique lié à la session propriétaire et au navigateur, jeton chiffré côté serveur. Connexion de courte durée (une heure maximum), réautorisation explicite ensuite ; aucun import ni scheduler Instagram. Le compte doit être autorisé dans l’application Meta ; une App Review/Advanced Access peut être nécessaire selon la propriété du compte. Les comptes personnels et les publications enregistrées ne disposent pas de la lecture promise par certaines interfaces grand public : aucun import des enregistrements n’est annoncé. Le partage iPhone existant reste disponible. La déconnexion conserve les références et distingue suppression locale et révocation distante confirmée.

Références officielles consultées : [Business Login](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login), [Get Started](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/get-started). Les formats `data[]` et les permissions en chaîne séparée par virgules sont traités ; profil professionnel confirmé avec son type réel.

X conserve son connecteur PKCE, scopes bookmark.read/tweet.read/users.read/offline.access, pagination, dédoublonnage et conservation des annotations/groupes. L’état affiche permissions, dernier import, dernière erreur, déconnexion. L’absence déclarée d’accès développeur X bloque toujours l’autorisation/import réel. Aucun remplacement par scraping ni abonnement supposé.

## Validation et limites des preuves

Les tests OIDC utilisent des JWT réellement signés et des JWKS isolés : ils prouvent la validation cryptographique et les refus, pas un consentement Google réel. Le formulaire OAuth est soumis dans Chromium via le véritable adaptateur Node et la vraie logique serveur, sur une base PGlite isolée. Le test MCP existant vérifie consentement, échange PKCE, lecture authentifiée, refus d’un outil global et révocation du client temporaire.

La validation en ligne nécessite encore la configuration Google et son premier consentement propriétaire. La preuve MCP distante se fait via Saver → Vérifier la passerelle MCP ; seul un résultat `verified:true` avec `temporaryClientRevoked:true` permet de confirmer cette étape. Ne pas créer de session propriétaire artificielle en SQL. Les tests UI à 390/1440 ne constituent pas une autorisation fournisseur réelle.

Après une vraie lecture `/api/saver` par une session Google valide, le serveur conserve une preuve privée minimale `saver-read-proof` : même propriétaire, méthode Google, date, nombre de références de la première page et premier UUID réellement relu (ou null si bibliothèque vide). Aucune référence n’est créée pour fabriquer une preuve. Cette preuve n’est exposée qu’au propriétaire et reste hors du rôle MCP.
