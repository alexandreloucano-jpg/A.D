# A.D — COMMERCIAL PRODUCT ARCHITECTURE / FRONTEND, BACKEND, ONBOARDING, CTA, PAYMENTS
2026-10-24 | Priority within 5,000 EUR/90 days. Status: P0 code PR in progress, later stages SPEC ONLY.

## Decisive positioning
DO NOT combine studio service cash receipts, founder's private creative operating software, and hypothetical subscription software into one untracked sales funnel. Day-one customer = paying bespoke creative-direction client. Technology stays an internal operating tool until actual third-party demand warrants external SaaS.

## Two separate surfaces
PUBLIC /studio, editorial landing: independent founder can see offers, selected legitimate case studies, select a fit conversation and submit a privacy-noticed B2B enquiry. Never make an unverified promise of availability or delivery.
PRIVATE /#/: the existing A.D workspace, owner GitHub/Google login, TODAY/Radar/Saver/Projects, Studio inbound inbox, candidate Deal Room and Creative Canvas. Current auth is single-owner only and must NOT be reused for client invitations.

## Operating funnel, stages and owner action
0 VISIT: /studio, premium proposition, clear Brand Thesis/Brand World/Creative Office offer (each with honest scope; starting fees are proposals, not quotations).
1 INQUIRY: CTA 'Parler de votre marque' → lead form (name, brand, site optional, sector, challenge, professional email) → Cloudflare Turnstile token → server validation → owner-scoped ad_studio_inquiries/NEW. With required gates unavailable, prepared mailto or copy, never claim submitted.
2 REVIEW: founder sees protected Today Studio inbox; tags REVIEWING/QUALIFIED/LOST etc. No automatic cold outreach or lead scoring of people. CRM does not collect consent for marketing: marketingOptIn default false.
3 DISCOVERY: founder proposes a real time only after checking calendar. **No auto-booking yet**. Later integrate verified booking provider/calendar with explicit approved access.
4 PROPOSAL: founder-approved scoped offer with quoted € HT/TTC per legal regime, deliverables, revision limit, usage rights, schedule, cancellation and expenses. Store immutable offer ID/version in Deal Room (not implemented in this PR).
5 CONTRACT: signed services/IP agreement via legally appropriate e-sign provider or manual signatures. Never equate clicking the CTA with consent to contract.
6 PAYMENT: a one-off deposit invoice or unique Stripe Payment Link *created for the accepted offer*; send ONLY after legal identity, accounting/VAT, accepted terms and owner approval. Stripe payment link is hosted, not a DIY card form. Never expose Stripe secret to Vite. No URL is configured/invented here. Payment links may be reusable; reference a specific invoice/payment object to match a client and prevent accidental misattribution.
7 PAYMENT CONFIRMATION: Stripe webhook with raw-body signature verification and event-id dedupe, amount/currency/client order reconciliation, asynchronous event support. DO NOT mark a deal PAID from return URL or manual click. This webhook and persistence ARE NOT YET IMPLEMENTED. Until verified, owner checks Stripe dashboard and books cash manually.
8 CLIENT ONBOARDING: after verified contract and deposit (if contract calls for it), invite named authorized client contacts to a separate role-limited portal by expiring single-use magic link; record company, permissions, privacy acceptance and MFA where warranted. In v0 use owner-administered questionnaire / secure existing file service with verified access; no guest account exists in this PR.
9 DELIVERY: intake brief + assets + brand rights, milestones, 2 CREATE directions, decision A/B, notes and approvals, QC, invoices, final assets with download expiry. High-value external client data cannot go to AI tools without contract and explicit approval.
10 LEDGER: invoice issued vs cash received vs margin and actual labour, renewal, no fake equity book value.

## What IS coded in this PR
- Existing /studio design transplanted from separately reviewed PR #1 to an isolated integration branch.
- GET /api/studio/availability reports whether server-side operator prerequisites are configured.
- POST /api/studio/inquiries checks exact same origin, public enable flag, declared business/legal privacy URL, validated fields, Turnstile challenge verified against our hostname, Postgres global and email-hash quotas. Returns 202 after committed insert; a honeypot deliberately claims receipt but stores nothing.
- Owner-only GET/PATCH /api/studio/inquiries protected by existing owner session and CSRF on PATCH; stage compare-and-swap + audit.
- Owner-visible StudioLeadsPanel inside TODAY, alongside existing Radar, with manual refresh, stage selection and native mailto for drafting replies. No automatic email send.
- SQL 008 migration **not executed**.
- With public form disabled, existing email/copy fallback is explicitly honest about non-transmission.
- No Stripe payment link, new subscription, client account, e-signature or public launch created.

## Configuration and security release gates (NO deployment before these)
1. Verify existing trading entity and official business name, invoicing/TVA rules, contact address, refund/cancellation terms, data controller identity and CNIL-compliant privacy notice. Do not put invented identities on the site.
2. Configure AD_BUSINESS_LEGAL_NAME, AD_PRIVACY_NOTICE_URL, VITE_AD_STUDIO_CONTACT_EMAIL in Vercel with verified values. Confirm privacy URL is public/reachable and correctly describes business data use and retention.
3. Configure Cloudflare Turnstile (one site key in VITE_AD_STUDIO_TURNSTILE_SITE_KEY and server-only AD_TURNSTILE_SECRET_KEY). Match exact production host. Confirm both are present; not generic secret placeholder.
4. Apply additive SQL/008 to isolated staging DB, test owner-only read/write/cross-owner denial and fail-closed absence, then apply to production ONLY after backup and owner-approved migration.
5. AD_PUBLIC_ENQUIRIES_ENABLED=1 ONLY after above. Test real submission, DB receipt, owner view and data deletion request.
6. Verify email notifications/retrieval. Current CRM is inbox inside owner workspace; no automatic email notification. Set a manual checking routine until a transactional email provider and data-processing agreement are validated.
7. Restore Vercel Git integration (previously git_info_fail). Use preview and 390/1440 screenshot QA before production.
8. Terms, legal disclosures and WCAG/mobile accessibility reviewed. No unnecessary cookies or unapproved analytics.
9. Define data retention for unqualified enquiries, fulfillment of deletion/access requests, no unconsented outreach to marketing lists.

## CTA architecture
Primary CTA, hero: 'Parler de votre marque' → #contact.
Secondary CTA: 'Découvrir notre approche' → #approche.
Successful lead CTA: 'Demande reçue — référence' (only after HTTP 202 and stored row); qualification follow-up manually sent later.
Accepted proposal CTA (future): 'Signer la proposition' through e-signature with audited signature, not a pretend "accept" button.
Post-signature CTA (future): 'Régler l’acompte' launches approved Stripe invoice/link hosted externally.
After verified payment CTA (future): 'Accéder à votre espace projet' secure role-limited invite.
Client review CTA (future): 'Commenter cette direction' / 'Approuver A' or 'Approuver B', bound to exact artifact version.

## Payments choice: Stripe invoices first, Payment Links when standardized
- Fixed studio brief (e.g. Brand Thesis after explicit scope): service invoice with deposit and balance, or dedicated per-client Payment Link after approved accounting workflow.
- Bespoke Brand World and ongoing Creative Office: specific quotes/invoices, no generic 3500 EUR checkout button before discovery.
- Future software SaaS: subscriptions and plan/customer lifecycle in **separate Stripe product/catalog/tenant** after actual recurring demand and entitlement server hooks.
- Stripe platform account unconnected here. This PR creates NO test/live products, checkout sessions, payment links, transfers or refunds.
- Verification data model for future: offers(id,version,acceptedAt); invoices(id,offerId,currency,netTaxGross,providerInvoiceId); payments(id,providerEventId,providerPaymentId,invoiceId,currency,amount,status); client_invites(expiry,usedAt,role), all owner/tenant scoped. Idempotent event processing, no auto-fulfillment on success redirect.

## Client onboarding (phased)
Internal operator onboarding now: owner login, workspace/first project, Studio inbox, contextual empty states, short helper about source provenance.
External prospect onboarding now: form only, no account requirement until contract.
External paying client onboarding later: link from verified client contact; email confirmed; organization role; project NDA/brief; source ownership and usage rights; intake; deliverable checklist; tailored contract; explicit AI-sharing preference; expiry/revoke.
Do not copy owner session/GitHub login to a paying client. Separate authenticated roles and audited access required.

## Budget impact (€5,000 cap unchanged)
Already allocated to tech review and legal/accountant in bootstrap plan. Initial site+inbox can be implemented without new paid subscriptions using existing React, Vercel, Neon; Turnstile free availability subject to provider limits/terms. Payments incur Stripe per-transaction fees and possibly invoicing fees (verify actual account), not assumed 0. No Webflow paid project, no paid CRM seats, no new auth vendor until paying evidence.

## Operating milestones
M1 TECH: passing CI, no owner data loss, fallback when unconfigured, public Turnstile verified, real lead shows on Today.
M2 LEGAL/DELIVERY: operating entity & contract process, invoice workflow, verified Stripe connection, one deposit sent and accounted, no fictional conversions.
M3 CLIENT: one client onboarded through permissioned secure workflow with CREATE deliverables.
M4 REPEAT: second client served; only then explore subscriptions and automated follow-up.

## Acceptance vetoes
No unauthenticated GET of enquiries; no bots accepted without valid Turnstile; no raw IP list; no payment-status action on page redirect; no public client portal without tenancy; no customer data sent into model prompts by default; no contract or external send by autonomous agent; no production migration without backup; no invented payment URL or promise of Stripe account.


## Confirmed legal form — Entrepreneur individuel (EI), France (2026-10-24)
The operator confirmed an existing EI (entreprise individuelle). This does NOT establish a micro-entrepreneur regime or exemption from VAT. Do not register or market a fictitious SASU. A.D Studio is the commercial brand only: the invoice issuer is the verified physical-person entrepreneur, with personal name followed or preceded by "EI"/"entrepreneur individuel", SIREN/SIRET and business address per applicable obligations.

Public intake now requires AD_BUSINESS_LEGAL_FORM=EI and a 14-digit AD_BUSINESS_SIRET, plus the existing professional legal name, privacy notice and Turnstile configuration. The form stays off until real verified values are entered; the example file never contains a user's actual number. A valid format is not proof the SIRET is active: verify against INSEE/Annuaire des entreprises and the operator's official documents before publication.

Payment setup: verify legal merchant name, SIRET, commercial bank account and legal trading identity at Stripe. An accepted scoped quote and legally applicable TVA regime precede any amount/invoice/Payment Link. EI is not the same thing as micro-entreprise, nor a synonym for TVA franchise. Do not calculate an artificial 20% TVA if the status is not yet known. Never make a payment link for a generic bespoke project automatically.

Invoices must identify the supplier, customer, unique chronological number, date, services, total and applicable VAT/exemption; financial and business details required by law and commercial terms must be reviewed by the operator or accountant. As of 2026-09-01, in-scope French companies must be capable of receiving structured e-invoices; in-scope smaller enterprises generally issue from 2027-09-01. Do not imply that a hosted PDF, Stripe checkout page or PDF receipt alone meets platform-mediated e-invoicing obligations.

Official references to validate at implementation:
- EI naming and documents: https://www.entreprises.gouv.fr/files/files/Espace-entreprises/Reglementation/foire-aux-questions-statut-entrepreneur%20individuel.pdf
- EI invoice mentions: https://www.service-public.gouv.fr/entreprendre/vosdroits/F31808?profil=entrepreneur-individuel
- VAT regime and required invoice mentions: https://www.economie.gouv.fr/entreprises/gerer-son-entreprise-au-quotidien/gerer-sa-comptabilite-et-ses-demarches/mentions-obligatoires-dune-facture-tout-savoir
- E-invoicing timetable: https://www.impots.gouv.fr/professionnel/questions/partir-de-quand-suis-je-concerne-par-la-reforme-de-la-facturation
