# PROCESS — Radar V4

1. Lire INDEX.md, RADAR.md, REGLES.md, DECISIONS.md avant d'éditer.
2. Modifier le moteur de classification et la collecte dans des fichiers séparés, avec tests unitaires explicites sur les emplois designer et le ciblage géographique.
3. Exécuter `node tests.mjs`. Toute régression bloque la release.
4. Vérifier sur sources réelles : connexions, nombre brut / conservé / priorité, doublons, localisations, intitulés interdits et statut de description disponible.
5. Comparer le résultat au dernier état de référence validé. Ne pas assimiler les emplois bruts ou les sources configurées à des leads qualifiés.
6. Installer dans une copie de l'application existante pour préserver le CV Builder, les dossiers et le SSO.
7. Déployer sur Vercel Preview quand le quota l'autorise, vérifier la build et la protection, puis seulement promouvoir vers la production.
8. Mettre à jour INDEX.md, DECISIONS.md et le relevé du benchmark après tout changement.