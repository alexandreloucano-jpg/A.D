// Registry contains endpoints, never market findings. Robots and legal notice checked 2026-10-16.
// FHCM excluded: its terms prohibit deep links without prior written consent.
export const SOURCES = [
  {
    id: "journal-du-luxe",
    name: "Journal du Luxe",
    url: "https://www.journalduluxe.fr/",
    domain: "www.journalduluxe.fr",
    sourceClass: "trade" as const,
    policyUrl: "https://www.journalduluxe.fr/fr/mentions-legales",
    sectorTags: ["mode et luxe", "beauté", "hospitality"],
    articlePattern:
      /^\/fr\/(mode|beaute|lifestyle|business|montres-joaillerie)\/[^/]+$/,
  },
];
