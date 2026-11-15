# Career Radar V3 | Source de vérité

Status: active. Reviewed: 2026-11-15. Priority: P0 for all Radar changes.

## Positionnement du candidat

Target: Creative Director, directeur artistique au sens de direction de campagne et supervision (pas d'exécution graphique), Senior Creative Strategist, Brand Strategist, Head of Social Media, social/influence strategy, direction des contenus, direction de communication et marque. Adjacent roles must be clearly marked **À explorer**.

**Never** recommend jobs whose core responsibility is graphic design, layout, illustration, interface design, daily asset creation, motion design, photography execution, video editing, or Figma mockups. A managerial title alone does not make hands-on design acceptable. Exclude internships, junior roles, technical product roles and sales.

## Sources et géographie

- Direct public employer ATS: Greenhouse, Ashby, Lever, SmartRecruiters.
- Third-party public jobs APIs (labeled): Arbeitnow (pages 1-4, with attribution), Remotive, Himalayas, Jobicy.
- RoleFinder public index (Paris/France/Remote marketing pages): parse JSON-LD listings, fetch ONLY plausible job details, and extract direct employer application links. Treat as secondary, never silently upgrade to verified employer posting. Confirm geography from the job DETAIL; never infer Paris from an index page title.
- Manual watchlist: Welcome to the Jungle, APEC, FashionJobs, luxury recruiters. Never count manually monitored sites as automated postings.
- Priority geography: Paris, elsewhere France or **verified eligible** remote EU/EMEA. A foreign on-site or country-restricted remote role is rejected. A remote role with unknown eligibility is exploratory, not priority.

## Scoring is NOT ATS accuracy

The heuristic score ranks job descriptions for review. It is not a hiring chance, applicant compatibility guarantee or salary estimate. Each record has source, URL, date if published, reason, role, geographic state, and tier. When remote eligibility or role ownership is unknown, mark uncertain.

## UX and integration

- `/radar`: separate Priority / À explorer filters, search, direct employer link, dossier action.
- `/api/jobs`: live refresh, bounded fan-out, individually reported source errors, counts; `rejectionReasons` diagnoses over-filtering.
- `/intelligence/offer`: receive selected role via sessionStorage, preserve existing application dossiers and human confirmation.
- No LinkedIn scraping. No guessing contact emails. No automatic email sends.

## Measurement

Baseline from same-day live V2.2: 52 sources, 4740 raw postings, 17 retained, 1 priority. New count must be measured live on same collection day, not attributed to job quality or success alone. The requested +170% remains a goal, never a claimed achieved result without normalized comparison and inspection of role appropriateness.