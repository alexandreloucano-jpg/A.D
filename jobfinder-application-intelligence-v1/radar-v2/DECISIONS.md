# DECISIONS — Radar V4

Statut : développement et audit le 15 novembre 2026.

1. **Décision confirmée** : l'utilisateur n'est PAS designer exécutant. La DA visée concerne une vision et la conduite de campagnes, pas des maquettes ni du dessin.
2. **Décision confirmée** : augmenter la quantité via de nouvelles sources ciblées et un rayon géographique réaliste, jamais via la suppression des exclusions designer.
3. **Source publique secondaire** : intégrer WTTJ uniquement sur ses pages éditoriales statiques /fr/pages/emploi-*, sans recherches /jobs?query=*, et marquer toutes ces offres « À explorer / à vérifier ».
4. **Preuve et priorité** : seules les annonces ATS d'employeurs peuvent être Priorité automatiquement. Une annonce secondaire n'est pas « officielle » par simple présence dans un index.
5. **Limite opérationnelle** : l'API Vercel a précédemment refusé le déploiement pour quota quotidien 402. Tant que la promotion n'est pas confirmée, les changements ne sont pas en production.
6. **Contradiction à résoudre** : plus de postes ne doit pas signifier plus de faux positifs. Mesurer nombre et pertinence sur les flux live, plus la proportion d'offres sans description confirmée.

7. Ajouter uniquement les pages publiques WTTJ qui donnent au moins un poste admissible, et rejeter les catégories 100 % techniques même si elles augmentent le nombre de pages.

## Arbitrage UX validé : supprimer le surplus
- Supprimer les grands indicateurs de sourcing en tête, notes techniques, classement numérique des offres et échelle arbitraire /100 de la surface principale.
- Conserver seulement le titre à gauche, les filtres Toutes / Priorité / À explorer, la recherche, l’entreprise, le poste, le lieu et les deux actions Voir l’annonce / Préparer le dossier.
- Garder la transparence des sources dans un volet discret accessible si besoin.
- Préserver le design noir et blanc, la typographie éditoriale, le mobile-first et la navigation par pages.
- Ne jamais modifier la qualification métier uniquement pour augmenter le volume affiché.
- Le déploiement n’est pas effectué tant que la limite API Vercel est active.