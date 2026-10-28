# A.D — MASTER BUILD DIRECTIVE
Version: 2026-10-20. Status: DESIGN / NOT DEPLOYED. This directive guides future implementation and does NOT grant authority to spend, contact, sign, buy, hire or publish.

## 0. Founding decision
Build ONE Deal-to-Ownership operating system, not disconnected mini-apps. A.D starts in Paris as a founder-led creative business; the technology finds qualified events and decision makers, learns from lawful references, prepares original art direction, compares cash/equity under grounded assumptions, drafts contracts, coordinates approved delivery, and measures real outcomes.

A.D Studio: fees and recurring fractional creative direction. A.D Technology: private operator software and later licensed product if external demand is proven. A.D Ventures: genuine contracted equity/IP/licences, separately tracked. A.D Holding is a possible future structure, not four companies to form now.
Do not label a feature as built when it is merely designed; do not count unrealised equity as revenue; do not claim a Goldman Sachs or Sequoia review.

Customer: founder-led independent hospitality/nightlife brands, expanding to fashion, beauty and lifestyle; Paris first. Existing relationships Caché, François 1er, Schiaparelli NEVER listed as cold prospects or public case studies without permission. Sales target: owner decision makers, not generic press attention.

## 1. Marketing and Webflow decision
One public entry: A.D Studio creative office for independent founders, introductory fit conversation, paid Brand Thesis from an initial proposed EUR 3,500 excl VAT. Scope, timeline and ability to deliver validated case by case. Do not offer a full free audit.
Existing /studio React/Vercel landing is in draft PR #1 (not live/merged yet). It must be reviewed, have a verified email/calendar transport, legal notices, privacy policy and a tested lead route before paid promotion.
Webflow is OPTIONAL for marketing CMS and editorial publishing; it is NOT the private application, database or orchestration runtime. A Webflow connection is not currently installed. If connected, keep CMS publication and contact submission separated from private A.D. Never build duplicate CRMs. Preserve canonical lead ID and UTM source, consent basis and server-side rate limits.

## 2. Single Deal Room and state machine
Canonical identifiers: UUID deal_id and UUID company_id, owner_id, version, source IDs, origin, relationship(existing|new), state, business model, risk flags and links to every artifact.
State machine:
CAPTURED → VERIFIED → QUALIFIED → CREATIVE_DRAFT → FINANCIAL_REVIEW → OFFER_DRAFT → LEGAL_REVIEW → READY_FOR_APPROVAL → APPROVED → WON or LOST or NO_DEAL → DELIVERY → OUTCOME.
Allow HOLD, rejected, revised and reopened states with reason; block invalid leaps. Each mutation has expected version, actor, approval scope, timestamp and immutable audit event.
Business models CASH | CASH_PLUS_EQUITY | BRAND_JV | IP_LICENCE | SOFTWARE | NO_DEAL.
Never infer or fabricate founder cash budget, capitalisation, exact legal entity, EBITDA, exit probabilities, dates, contact emails or investment rights.
A prospect is not a paying client, a signed deal is not cash received, and an agreed intention is not a shareholding.

## 3. Evidence and second brain
Five logically separated linked collections:
SOURCES immutable URLs/assets and provenance, publish/event/capture dates, rights, source freshness.
TASTE creative reference mechanisms actually read, context, accepted/rejected human judgements, human corrections; never treat likes as verified preferences or describe unseen imagery.
COMPANIES people, identity, relationships, outreach permission/opt-outs, company canonical entity.
PROJECTS & DEALS creative theses, concepts, scopes, financial models, offers, contracts, approvals, milestones, IP clauses.
OUTCOMES invoices, receipts, actual hours and costs, qualitative feedback, verified company outcomes, uncertainty and alternative explanations.
Every claim tagged OBSERVED, VERIFIED, DERIVED, HYPOTHESIS, UNKNOWN with timestamp, evidence ref and scope. Null is unknown; zero is evidence of absence and must not be guessed. Human correction > approved project decision > verifiable proof > interpretation > raw inspiration.
No conversion of private client work into training data without contractually appropriate rights. No cross-tenant access. Existing site and Vercel beta stores remain distinct until inventoried, backed up and reconciled.

## 4. Automation operating principle
Deterministic CONTROL PLANE orchestrates small agents via bounded jobs. Agents are not free-running autonomous chatbots and may not modify authority policies. Flow:
TRIGGER → QUALIFY → LEASE + IDEMPOTENCY KEY → AGENT → SCHEMA CHECK → EVIDENCE QA → STORE DRAFT → REQUIRED APPROVAL → NEXT JOB.
Each run: job_id, deal_id, owner, agent/version/model/provider, source refs, policy scope, status, checkpoint, attempts and budgets (time/tokens/cost), error, output hash and event log.
RUN_PRIVATE: approved source ingestion, bounded owner capture, deduplication, private summarisation, QA.
DRAFT: outreach draft, creative thesis, financial analysis, offer, contract, content or recruitment brief. Drafts have NO external effects.
OWNER_APPROVAL: any outreach, external publication, financial commitment, pricing, client asset sharing, hiring, purchase, equity choice, document issuance or signature.
SPECIALIST_REVIEW: incorporation, IP assignments, equity securities, tax, legal contracts, financial services, investment structure and fund-related activity.
No secret keys in frontend; no arbitrary fetch by agents; no untrusted document instructions; allowlists, CSRF, auth, encryption, quotas and structured output. Degraded mode must show unavailable, not success.

## 5. Agent roster and exact deliverables
A01 SCOUT / FIND — authorised public-source monitoring; returns CandidateLead[] with canonical source, event date, source date and fit confidence. Excludes expired campaigns and unrelated news.
A02 VERIFY — confirms company name, identity, recent event and decision maker with primary evidence; returns VERIFIED or NEEDS_REVIEW, missing evidence.
A03 COMMERCIAL — qualifying pain, commercial timing, existing relationship, buying authority, budget evidence; drafts personalised approach but never sends it.
A04 TASTE / MEMORY — preserves reference, observed pattern, a suggested mechanism, explicit human corrections, contexts; no model-training claim.
A05 STRATEGIST — founder positioning, audience fear/status/security and narrative, strategic alternatives, competitive references, causal mechanism and falsification.
A06 CREATIVE DIRECTOR — two original high-quality creative directions, style grammar, editorial treatment, visual brief, production requirements and IP warnings.
A07 PRODUCER — staffing, timelines, dependencies, briefs, verified supplier estimates, contribution margin and release rights.
A08 FINANCE — cash/hybrid/JV/licence scenarios; fees, taxes to review, cash needs, cap table fully diluted, EV vs equity, debt, exit waterfall, preferences, probable uncertainty, NPV illustrative; INSUFFICIENT_DATA if missing.
A09 DEAL ARCHITECT — recommends owner-review route CASH, CASH_PLUS_EQUITY, BRAND_JV, IP_LICENCE, SOFTWARE or NO_DEAL with counterparty incentives and failure modes.
A10 LEGAL DRAFTER — draft proposal, services agreement, IP license, LOI, term sheet, share/pact document inventory; blocks required missing fields and needs external lawyer before legal effect.
A11 DELIVERY — for a genuinely signed mandate, drafts schedule and supplier instructions, checks QC and asks approval before any external step.
A12 CONTROLLER — validates facts, proprietary rights, provenance, data isolation, costs, contradictions and approval; can reject/hold, never self-approve.
A13 OUTCOME/MEMORY — saves observed sales, rejections, delays, delivery data and outcomes; does not attribute causality without verification.
Every agent uses typed input and output, stored version, idempotence, rights and next-action; no natural-language autonomous command execution.

## 6. Technology choices (retain working code)
React 19, TypeScript, Vite, Zod on frontend. Existing Vercel functions, Neon Postgres, GitHub owner auth and opt-in Google sign-in as already configured, with production verification. Scope by owner_id; no privilege expansion for existing Saver gateway. Existing Market/Radar jobs and collection readers are the primary reusable foundation. Introduce a durable deal state table and audit table, scoped event queue and controlled read-only agent adapters; do not rewrite working Saver/Taste.
Source ingestion under robots and provider terms, allowlisted URLs, quotas and no arbitrary SSRF. X currently unconnected; Instagram saved-post read is unavailable through standard API. Do not create a second OAuth platform.
Use deterministic computations for finance; LLM only for narrative and interpretation, never arithmetic truth or authorisation. Start with Postgres full text, embeddings only after measuring retrieval gains; forbid unstated training of a foundation model.
Authentication for public enquiry must be distinct from private owner login, rate limited, privacy-noticed, anti-spam and securely connected to a verified inbox or CRM.
Candidate private screens: TODAY, DEALS, SAVER, PORTFOLIO, with mobile-first progressive disclosure. One primary action per screen.

## 7. Proposed APIs (NOT YET IMPLEMENTED)
POST /api/deals (authenticated owner + CSRF + idempotency).
GET /api/deals, GET /api/deals/:id, PATCH /api/deals/:id (version check).
POST /api/deals/:id/run/:agent (bounded, auditable, permissioned).
POST /api/deals/:id/approvals (owner-authenticated exact artifact/version/action).
GET /api/deals/:id/audit, POST /api/deals/:id/documents/draft.
POST /api/public/enquiries only after proper abuse and data protection systems.
No agent output may set ownerApproved = true. A missing source remains missing. Contract draft cannot become signed solely due to UI state.

## 8. Investor and M&A-style committee vetoes (SIMULATED, NOT a review by real investors)
- Market: 20 real founder-led Paris companies independently discoverable, relevant timely trigger, reachable decision maker.
- Demand: external paying clients, confirmed cash receipts and repeat orders; beautiful portfolio alone insufficient.
- Economics: gross and contribution margin AFTER delivery costs, founder hours, AI calls, marketing and overhead. Require reproducibility.
- Concentration: founder-only client relations and taste are a key-person risk; test whether repeatable work can be delegated.
- Tech: data ownership and portability, source permissions, observability, security, multi-tenant isolation before external software customers.
- Capital: VC financing for A.D Technology must not subsidise a restaurant investment vehicle; distinct books and signed arm's-length agreements.
- Equity: no verified cap table, shareholder rights, debt, liquidation preference, financing, ownership and exit -> CASH ONLY/NO_DEAL.
- Conflicts: venture ownership in customer brands and use of their privileged data need explicit conflict management.
- Truth: no Sequoia or Goldman endorsement, no 1B forecast, no fake conversion, no model preview passed off as live.

## 9. First 90 days, gated not waterfall fantasy
D0–7: choose one canonical code branch and one owner source of truth, backup, compare existing Sites and Vercel states, accept PR #1 after checks and real contact set up. Founder leads outreach manually; no paid campaigns before lead capture works.
D8–21: Deal Room persistence, versioned event logs, approval gate, negative security tests and responsive mobile UI.
D22–35: verified Scan → Lead and Taste → original brand thesis; 2 creative options reviewed by founder.
D36–49: deterministic cash/equity calculator with missing financial-data gates, pricing and counterparty memo.
D50–63: draft proposals/contract templates, required-field gate, counsel review path; start real signed mandate delivery.
D64–77: end-to-end first paying customer, measure time, invoices and margins.
D78–90: repeat independently on a second paying mandate and decide whether a technology licence has actual demand.
Commercial learning targets, NOT a forecast: 50 leads, 12 qualified founder meetings, 3 paying mandates and one vetted venture opportunity. If no payment, revise offer, not stack more tools.

## 10. Staffing and company formation
Founder: taste, senior sales, IP/equity final decision, approvals. Fractional senior full-stack engineer 8–12 weeks (state/control plane/API, QA, deployment). Freelance creative producer per signed mandate. Corporate/IP lawyer and accountant for formation and transaction. Growth contractor only after founder closes initial sales. Contract all IP assignments, confidentiality and access scopes. Do not staff a full agency before booked revenue.
First entity decision with counsel: SASU when founder is alone; SAS with genuine additional founders; continue existing legal status if more appropriate. Check existing tax and legal registration first. Avoid forming 4 entities without assets, financing or compliance need. French corporate counsel to write tailored statutes, president authority, share transfer, IP and service scope, and regulated activity exclusions. Run name clearance on INPI; review copyright assignments, VAT, insurance, B2B prospecting compliance and accounting.
Official sources: https://entreprendre.service-public.gouv.fr/vosdroits/F37366 ; https://www.inpi.fr/ressources/propriete-intellectuelle/rechercher-une-marque-base-marques ; https://www.cnil.fr/fr/la-prospection-commerciale-par-courrier-electronique ; https://www.amf-france.org/fr/espace-professionnels/autres-profils/conseillers-en-investissements-financiers-cif

## 11. Definition of done
P0 code: typecheck, unit+browser tests and deployment preview, rollback, no data loss or security regression.
P1 lead: primary sourced, owner corroboration, public/permissioned contact, dedupe, unknown explicit.
P2 creative: two usable original directions, founder approval, scoped budget and source rights.
P3 value: robust scenario numeric tests including dilution, liquidation/illiquidity warnings, no fabricated numbers; route CASH/NO_DEAL when insufficient data.
P4 document: editable legal draft, no issue/send/signature without human+specialist review.
P5 delivery: tracking real cost, signed vs invoiced vs cash received, actual duration, customer decision.
P6 repeatability: completed across two real customers; verified measures and error log.
ZERO unapproved external sends, payments, signatures, hiring commitments or equity commitments.

## 12. Immediate priorities
1. Review existing public A.D Studio landing PR #1; activate a real verified contact route, comply with privacy before publication.
2. Commit core TypeScript deal/approval/scenario contracts, SQL additive migration (NOT applied) and negative tests on separate draft PR.
3. Build owner-only persistent Deal Room using existing backend security and existing Radar inputs.
4. Run first client through a manually supervised flow BEFORE increasing agent autonomy.

## 13. Bootstrap constraint: EUR 5,000 for the first 90 days (21 Oct 2026 to 19 Jan 2027)

This cash limit excludes founder compensation. It is a planning maximum, not permission to spend. Proposed allocation: EUR 1,800 scoped senior engineering review and integration; EUR 850 legal/IP advice; EUR 450 accounting and potential registration formalities; EUR 300 hosting/AI tools; EUR 200 qualified customer acquisition; EUR 200 original creative demo; EUR 1,200 protected reserve. Initial spending capacity is EUR 3,800 and each commitment requires owner approval and a verified quote. All amounts represent cash ceilings including nonrecoverable taxes.

Reject full-time staffing, a 12-week external engineer contract, paid Webflow, mass-paid advertising, multiple legal entities, multi-tenant SaaS and autonomous equity transactions in this bootstrap stage. Use the existing React/Vercel/Neon/Saver/Taste/Radar; treat 13 agents as a modular future capability roster, initially bundling FIND, CREATE, EVALUATE and CONTRACT/LEARN into supervised, bounded internal drafts.

In the first two weeks, validate the existing public /studio pull request with a verified contact channel and required legal notices; test market demand while auditing existing data before any SQL migration. Then deliver an owner-only persistent Deal Room with versioned audit and approvals, source-grounded creative proposals, a deterministic cash/equity model and legally reviewed contract drafts. Aim for one paid Brand Thesis first, a second independently qualified sales cycle by day 90, and measured delivery cost. Prospecting, pricing, signatures and investments retain explicit owner approval.

Validate the existing business registration before incurring SASU expenses. Formation and trademark fees are conditional and may exceed the tentative accounting/formalities envelope when combined with professional advice. Do not spend the EUR 1,200 reserve without owner authorisation. If no paid demand by day 45, revisit offer and target rather than increasing engineering scope. Record monthly actual spending, cash receipts and contribution margins without mixing signed fees and cash or unrealised holdings.
