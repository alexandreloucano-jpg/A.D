# MCP Saver — compatibilité de transport

La passerelle existante conserve `/mcp`, OAuth, son audience et son rôle SQL restreint. Aucun accès X/Instagram ni outil supplémentaire n’est ajouté. Les clients, jetons et données persistantes ne sont pas remplacés.

## Versions

Les clients 2025-03-26, 2025-06-18 et 2025-11-25 continuent d’utiliser `initialize`. Le serveur accepte les métadonnées de requête dans `params._meta` sans les confondre avec les arguments métier des quatre outils. Les arguments des outils restent stricts.

La compatibilité 2026-07-28 ajoute `server/discover`, les métadonnées par requête, les en-têtes `MCP-Protocol-Version`, `Mcp-Method` et `Mcp-Name`, ainsi que `resultType: complete`. Les champs de cache requis sur la découverte et la liste sont `ttlMs: 0` et `cacheScope: private`. Aucun abonnement, session de transport, SSE historique ni callback client n’est annoncé.

Les versions non reconnues reçoivent l’erreur JSON-RPC -32022 avec les versions supportées. Les en-têtes incohérents sont refusés avec -32020 ; une méthode 2026 inconnue renvoie HTTP 404 / -32601. Ces vérifications ne remplacent jamais OAuth : l’authentification, l’audience et les quotas sont vérifiés d’abord.

La journalisation de découverte indique uniquement la méthode de découverte, les versions et le nombre d’outils. Aucun jeton, ID de client, argument ou contenu propriétaire n’y figure. Elle permet de distinguer une initialisation, une vraie liste d’outils et un refus protocolaire sans déduire le contenu d’un simple statut HTTP 200.

## Limite des preuves

Le refus 2026 et le rejet de `params._meta` étaient des lacunes concrètes de l’implémentation précédente. Leur correction ne prouve pas à elle seule qu’elles expliquaient le refus du modèle dans Grok. Une découverte simulée ou un autre client ne constitue pas un appel réel depuis Grok. Le statut connecté reste conditionné à une sauvegarde approuvée puis une relecture du même UUID avec le client Grok autorisé. Aucune écriture réelle n’est faite pour forcer cette preuve.

`get_saved_inspiration` recherche uniquement les références déjà dans Saver ; il n’importe pas les signets X. Les descriptions retournées au client le précisent explicitement. Les règles d’approbation, les exclusions de projets/QA, les annotations et les données historiques ne changent pas.

## Sources vérifiées

- https://modelcontextprotocol.io/specification/2026-07-28/basic/lifecycle
- https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http
- https://modelcontextprotocol.io/specification/2026-07-28/server/tools
- https://modelcontextprotocol.io/specification/2025-06-18/basic/transports

La spécification 2026 exige aussi des clients qu’ils interprètent l’absence de `resultType` dans une réponse d’un serveur plus ancien comme `complete`. Son absence, seule, ne prouve donc pas un bug côté serveur.
