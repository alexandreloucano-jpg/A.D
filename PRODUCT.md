# A.D — Product truth

## Product in one sentence

A.D is the private operating system for an independent creative director: it turns sourced market changes and the founder’s confirmed taste into reviewed creative work and commercial decisions.

## The three objectives

1. **Help the founder do better creative direction.** Keep projects, decisions, source material, and confirmed taste in one dependable second brain. Reduce research and administration so the founder can spend time on judgment and making.
2. **Find and develop the right opportunities.** Radar discovers and verifies business signals. A.D carries a selected opportunity into a work dossier with its evidence intact. Internal AI may prepare a tailored art direction, a scoped offer, and a draft contract from verified facts, explicit unknowns, confirmed taste, and approved business terms. The founder edits and approves every outward-facing decision.
3. **Make the method available to other people.** First prove the workflow on the founder’s own work and real client delivery. Then design separate team, client, and independent-director onboarding with tenant isolation and role-based access. The current application is single-owner; it is not yet a multi-user SaaS.

## Keep three businesses distinct

- **A.D private workspace:** the founder’s research, taste, opportunities, dossiers, creative revisions, and business outcomes.
- **A.D Studio:** the public service business and its inquiry funnel at `/studio`. It is not the SaaS signup page and must not interrupt the daily creative workflow.
- **Future A.D product:** a possible subscription platform for other creative directors and clients. Do not imply signup, team access, cloud sync, payment, or contract workflow until the relevant authentication, tenancy, and backend are implemented and verified.

## The operating loop

`Library (confirmed taste and source material) → Radar (evidence-backed opportunity) → Work (dossier and creative treatment) → Value / offer / contract draft → human approval → delivery and recorded outcome → better future decisions`

`Today` is the short daily brief that points to the next useful step in that loop. It shows current creative directions beside a short Radar and news selection; the complete, filterable feed stays in Radar. It is not a second copy of the research workspace.

## Agent responsibilities

- **Scout:** collect only allowlisted, permitted sources; report source health, fetch time, and failures. It never invents an opportunity to fill the screen.
- **Analyst:** connect claims to evidence, separate event date from publication and collection dates, compare a candidate with explicit Taste references, and keep unknowns visible. A score is not a probability of winning work.
- **Creative:** use the selected dossier, approved brief, and confirmed Taste to draft distinct art directions. It does not invent source facts or approve its own output.
- **Commercial:** draft a scoped service proposal and a contract checklist/draft from owner-approved pricing, legal identity, rights, schedule, and exclusions. Missing terms remain unresolved; it does not send, sign, invoice, or promise.
- **Chief of Staff:** prepare Today from persisted facts, deadlines, and founder decisions. It may recommend; only the founder changes a priority or makes a commitment.

Every generated artifact records its source IDs, unknowns, generation time, model/version, and review state. The intended relation is `company → signal → evidence → opportunity → founder decision → work dossier → creative/offer/contract revisions → real outcome`.

## Build order

1. Make the single-owner path explicit and usable on iPhone: Library → Radar → Work, with no empty project dead end.
2. Make the Radar-to-Work record reliable and preserve provenance across every handoff; back up and validate before any data migration.
3. Add auditable AI enrichment and proposal/contract drafts, with quotas, retries, model evaluation, and explicit owner approval.
4. Prove delivery with real clients and record actual value/outcomes.
5. Only then build multi-tenant SaaS onboarding, access roles, billing, support, and data deletion.

## Information architecture

- **Aujourd’hui:** one next step, all current creative directions, a short selection of current Radar signals and news, and clear system freshness. It does not repeat the complete Radar feed. Empty state sends a new founder to Radar; it must not ask them to create an empty project first.
- **Radar:** sourced opportunities, event dates, source health, commercial relevance, fit to confirmed Taste, unknowns, and the action to examine or open in Work.
- **Travail:** dossiers and creative work first; the saved Radar pipeline and A.D Studio operations are secondary, separate disclosures. The dossier created from an opportunity keeps its evidence, creative drafts, editable offer and contract drafts, human decisions, delivery, and actual outcomes. Radar-to-Work handoff preserves opportunity identity and evidence.
- **Bibliothèque:** Saver, images and references the founder actually saved, source provenance, and explicit taste feedback. A saved or liked item is not automatically a confirmed preference.

Global capture and search can be reached from any space. The Studio inquiry inbox belongs to Studio operations and is not part of the core opportunity-to-delivery journey.

## Journeys

### Founder / current private beta

Owner authentication → lightweight workspace setup and optional Taste seeds → Aujourd’hui → Radar → inspect sources and unknowns → open a Work dossier → generate or edit creative and commercial drafts → founder review → manual external contact/signature/payment → record the real outcome.

AI output is labeled as a draft. Facts cite sources; interpretations and proposed scope are visibly separate; unknown amounts, access, dates, and terms stay unknown. No prospect is contacted and no contract is accepted automatically.

### A.D Studio service prospect

Public `/studio` → understand one clear service offer → send a privacy-noticed inquiry → human qualification → scoped proposal → contract and invoicing handled through verified processes. There is no client account in the current beta.

### Future A.D software customer

Product proposition → signup → organization/workspace setup → role-specific onboarding → connect allowed sources → seed taste → run the first sourced opportunity workflow. Build this only after real demand and after tenant-safe auth, data separation, billing, support, and deletion controls exist.

## Product truth and release boundaries

- The current app has four private-workspace areas; route names and screens must express the operating loop.
- Radar data and local project data have different persistence today. Never imply they are already a unified, multi-device source of truth.
- Automated Radar and AI capabilities are shown only when configured and verified. Otherwise state exactly what is unavailable.
- Proposal and contract generation are drafts, not legal advice, signatures, commitments, or sent messages.
- No invented clients, sources, preferences, revenue, budgets, contracts, or results.
- Preserve the human approval boundary for priority changes, prospect contact, publication, spending, contract acceptance, and payments.
