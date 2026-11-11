import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Hero } from "./components/landing/Hero";
import { homeHeroLeadParts, renderSeoBodyParagraph } from "./homeHeroLead.mjs";
import { platformDestinations } from "./landingContent";
import { pageByPath, seoPages } from "./seoPages";

const HOME_BODY =
  "Record who paid and who owes for trips, rent and dinners. No daily limits, no ads, no bank link.";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

describe("homepage hero line break", () => {
  it("keeps the approved sentence and breaks only after dinners", () => {
    const home = pageByPath.get("/");
    expect(home?.body).toBe(HOME_BODY);
    expect(home?.description).toBe(
      "Shared expense ledger for trips and roommates. Clear balances. No bank link. Settle outside the app.",
    );
    if (!home) return;

    const parts = homeHeroLeadParts(home.body);
    expect(parts).toEqual({
      before: "Record who paid and who owes for trips, rent and dinners. ",
      after: "No daily limits, no ads, no bank link.",
    });
    if (!parts) return;
    expect(`${parts.before}${parts.after}`).toBe(HOME_BODY);
  });

  it("does not break any other route body", () => {
    for (const page of seoPages) {
      if (page.path === "/") continue;
      expect(homeHeroLeadParts(page.body)).toBeNull();
      expect(renderSeoBodyParagraph(page.body, escapeHtml)).toBe(`<p>${escapeHtml(page.body)}</p>`);
    }
  });

  it("breaks the static homepage paragraph and the React hero the same way", () => {
    const home = pageByPath.get("/");
    if (!home) throw new Error("missing homepage");
    const primary = platformDestinations[0];
    if (!primary) throw new Error("missing platform destination");

    expect(renderSeoBodyParagraph(home.body, escapeHtml)).toBe(
      "<p>Record who paid and who owes for trips, rent and dinners. <br>No daily limits, no ads, no bank link.</p>",
    );

    const html = renderToStaticMarkup(
      <Hero
        page={home}
        primaryDestination={primary}
        secondaryDestinations={platformDestinations}
      />,
    );
    expect(html).toContain(
      '<p class="hero-lead" id="sm-hero-lead">Record who paid and who owes for trips, rent and dinners. <br/>No daily limits, no ads, no bank link.</p>',
    );
    expect(html).not.toContain("dinners. No daily limits");
  });
});
