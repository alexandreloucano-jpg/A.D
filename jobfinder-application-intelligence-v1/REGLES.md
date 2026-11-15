# RÈGLES | Application Intelligence

1. One user-facing page per step: Offer → CV → Contacts → Portfolio → Outreach. Keep navigation sequential and mobile-first.
2. Build on the existing CV evidence rather than inventing awards, figures, managerial authority or campaign assignments. Mark uncertain scores as insufficient, not 100%.
3. Named contact and direct email need an explicit public source. An email address inferred from a corporate naming pattern is **unverified** and cannot be marked confirmed by the software.
4. Official-site research is limited to publicly accessible pages. Honor robots.txt. Do not scrape LinkedIn, credentials or nonpublic directories. Block private-network URLs and follow no external redirects.
5. Cold emails and LinkedIn messages are **drafts**, never sent automatically. Users control recipients, content and timing.
6. Respect applicable rules for professional outreach, privacy and data retention. Do not claim consent that was not given.
7. Only user-approved media appears in the public portfolio; the current media inventory is empty.
8. Preserve the private Vercel SSO on Job Finder. The curated public portfolio must contain no CV details, contact research, private notes or HR records.
9. Store drafts per offer in the user's browser. Explain that this does not sync to other devices.
10. Every substantive release updates INDEX.md and runs regression checks before altering production.

11. Une adresse détectée sur le site officiel porte le statut `published`, pas celui d’une personne identifiée, d’une boîte délivrable ou d’un recruteur confirmé. Un ancien contact automatique libellé `verified` doit être rétrogradé lors de la lecture des brouillons.
12. Les requêtes asynchrones sont rattachées à l’identifiant du dossier d’origine pour éviter de mélanger les informations de deux employeurs.