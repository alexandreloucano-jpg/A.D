import { expect, test } from "@playwright/test";
import { composeEmail } from "../../src/lifecycle/templates";
import type { LifecycleFacts, LifecycleEvent } from "../../src/lifecycle/model";

const event: LifecycleEvent = {
  id: "reference_saved:fixture",
  owner: "synthetic-review-only",
  type: "reference_saved",
  occurredAt: "2026-10-05T09:00:00.000Z",
  recordedAt: "2026-10-05T09:00:01.000Z",
  sourceType: "saver_reference",
  sourceId: "fixture-reference-id",
};
const facts: LifecycleFacts = {
  owner: "synthetic-review-only",
  asOf: "2026-10-31T22:59:59.000Z",
  signupAt: null,
  events: [event],
  qualifiedSignals: [],
  communication: {
    email: "review@example.test",
    emailVerified: true,
    marketingConsent: true,
    unsubscribed: false,
    bounced: false,
    complained: false,
  },
  workspaceContinuityVerified: false,
  monthEnd: true,
};
const draft = composeEmail(facts, "monthly_value", {
  link: "accueil",
  metrics: [
    {
      key: "references_saved",
      label: "Références enregistrées",
      value: 1,
      sourceEventIds: [event.id],
    },
  ],
});

for (const width of [390, 1440]) {
  test(`lifecycle email draft renders at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.setContent(draft.html);
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Votre mois en intelligence",
    );
    await expect(page.getByRole("link", { name: "Reprendre dans A.D" })).toBeVisible();
    const geometry = await page.evaluate(() => {
      const button = document.querySelector("a")!.getBoundingClientRect();
      return {
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        ctaHeight: button.height,
        ctaLeft: button.left,
        ctaRight: button.right,
      };
    });
    expect(geometry.scrollWidth).toBeLessThanOrEqual(width + 1);
    expect(geometry.ctaHeight).toBeGreaterThanOrEqual(44);
    expect(geometry.ctaLeft).toBeGreaterThanOrEqual(0);
    expect(geometry.ctaRight).toBeLessThanOrEqual(width + 1);
    await page.screenshot({ path: info.outputPath(`lifecycle-email-${width}.png`) });
  });
}
