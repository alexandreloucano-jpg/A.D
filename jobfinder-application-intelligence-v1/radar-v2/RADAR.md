# Radar V2.2 | Job Finder

Priority: active. Maintainer: candidate. Last revised: 2026-11-15.

## Core professional targeting

The candidate is a Creative Director / Art Director in the sense of creative leadership, a Senior Creative Strategist, Head of Social Media and Brand Strategist. **The candidate is not a hands-on designer** and does not seek roles whose principal deliverable is drawing, UI/UX design, graphic layout, illustration, motion design, 3D, graphic-production execution or Figma interface design.

Promote: Creative Director, Art Director (leadership), Head of Creative, Creative Strategist, Brand Strategist, Head of Social, Social Media Director, Senior Social Media Strategist, Head of Content, campaign/content strategy, senior brand marketing with strong creative ownership.

Explore, never mislabel as high certainty: generic communications / content / marketing management, unspecific remote geographies, roles without a full description, positions requiring regular hands-on graphic production.

Reject: graphic designer, product designer, UX/UI, motion designer, illustrator, photographer, video editor, software/technical or sales positions, interns and junior positions, on-site positions outside France, remote restricted to US/UK/Canada.

## Pipeline and constraints

Public job listing feeds: Greenhouse Board API, Lever Postings API, Ashby Public Posting API, SmartRecruiters public company board; clearly marked cross-company job boards Arbeitnow, Remotive, Jobicy, Himalayas. All are live sources, not an invented catalog. 28 feeds configured. Failed or empty feeds are individually reported.

Classification combines title, source and geography, then scores the match. No percentage is a hiring probability or ATS score. The full job description is preserved when available. Direct application opens the verified job URL and dossier in Application Intelligence. Never invent a contact or a listing, and never silently label an unverified remote position Paris-eligible.

## Success metrics

The requested +170% is a target, **not a verified outcome**. To validate, record baseline and new counts across the same time window: (1) open, unique qualified postings; (2) verified employer-job links; (3) posts matching target role and geography; (4) median age when a publication date exists; (5) share of opportunities advancing to dossier. Only a measured lift, not number of API sources, demonstrates success.

## Integration

- Radar page: `/radar`
- Jobs API: `/api/jobs` serving jobs, counts, active source status, manually monitored specialist sources
- Dossier: `/intelligence/offer`
- CV: `/intelligence/cv`
- Contacts: `/intelligence/contacts`
- Portfolio: `/intelligence/portfolio`
- Outreach: `/intelligence/outreach`
- Source: `radar-v2/radarCore.mjs`, `radar-v2/radarSources.mjs`, and their integration tests.