import { describe, expect, it } from "vitest";
import vercelConfig from "../../vercel.json";
import { sitemapLocsMatchingRedirects } from "./sitemapRedirects.mjs";
import { normalizeSeoPath, pageByPath, relatedPages, seoPages } from "./seoPages";

function sitemapLoc(pagePath: string) {
  return `https://sharedmoney.app${pagePath === "/" ? "" : pagePath}`;
}

describe("SEO route content", () => {
  it("has the approved eleven indexable routes", () => {
    expect(seoPages).toHaveLength(11);
    expect([...pageByPath.keys()]).toEqual([
      "/",
      "/split-bills",
      "/group-expense-tracker",
      "/trip-expense-splitter",
      "/roommate-expense-tracker",
      "/flatmate-expense-tracker",
      "/splitwise-alternative",
      "/in/splitwise-alternative",
      "/tools",
      "/tools/split-bill-calculator",
      "/tools/settle-up-calculator",
    ]);
  });

  it("adds a flatmate landing page for India and UK searches", () => {
    const page = pageByPath.get("/flatmate-expense-tracker");
    expect(page?.kind).toBe("page");
    expect(page?.heading).toBe("Flatmate costs, kept calm.");
    expect(page?.lead).toBe("No daily limits, no ads, no bank link.");
    expect(page?.description).toContain("No daily limits, no ads, no bank link.");
    expect(page?.body).toContain("India and the UK");
    expect(page?.body.toLowerCase()).toContain("upi or bank transfer");
    const text = JSON.stringify(page).toLowerCase();
    expect(text).not.toContain("splitwise");
    expect(text).not.toContain("whatsapp");
    if (!page) throw new Error("missing flatmate page");
    const pageSpecific = [
      page.body,
      ...page.sections.flatMap((section) => [section.heading, section.body, ...section.bullets]),
      ...page.faqs.flatMap((faq) => [faq.question, faq.answer]),
    ].join("\n");
    expect(pageSpecific.toLowerCase()).not.toContain("roommate");
    expect(page?.related).toEqual([
      "roommate-expense-tracker",
      "split-bills",
      "settle-up-calculator",
    ]);
  });

  it("keeps SharedMoney as the home H1 for Google OAuth brand verification", () => {
    expect(pageByPath.get("/")?.heading).toBe("SharedMoney");
  });

  it("adds the verified trust lead under roommate and Splitwise H1s", () => {
    const lead = "No daily limits on expenses, no ads, no bank link.";
    expect(pageByPath.get("/roommate-expense-tracker")?.lead).toBe(lead);
    expect(pageByPath.get("/splitwise-alternative")?.lead).toBe(lead);
    expect(pageByPath.get("/")?.lead).toBeUndefined();
  });

  it("includes no bank link in the homepage hero and meta description", () => {
    const home = pageByPath.get("/");
    expect(home?.body).toBe(
      "Record who paid and who owes for trips, rent and dinners. No daily limits, no ads, no bank link.",
    );
    expect(home?.description).toContain("No bank link");
    expect(home?.body.toLowerCase()).not.toContain("splitwise");
    expect(home?.description.toLowerCase()).not.toContain("splitwise");
  });

  it("keeps Splitwise proof cards free of bank-link duplication", () => {
    const proof = pageByPath.get("/splitwise-alternative")?.proof ?? [];
    expect(proof).toEqual([
      "Splitwise CSV import",
      "Settle with cash, UPI or bank transfer",
      "Free shared expense tracking",
    ]);
    expect(proof.some((item) => item.toLowerCase().includes("payment instruments"))).toBe(
      false,
    );
  });

  it("only resolves known paths and maintains related-page links", () => {
    const splitBills = pageByPath.get("/split-bills");

    expect(normalizeSeoPath("/tools/split-bill-calculator/")).toBe("/tools/split-bill-calculator");
    expect(normalizeSeoPath("/not-a-real-route")).toBeNull();
    expect(splitBills).toBeDefined();
    expect(relatedPages(splitBills!).map((page) => page.id)).toEqual([
      "split-bill-calculator",
      "group-expense-tracker",
      "roommate-expense-tracker",
    ]);
  });
});

describe("sitemap redirect exclusion", () => {
  it("keeps indexable routes, including the Splitwise alternatives, off redirect sources", () => {
    const locs = seoPages.map((page) => sitemapLoc(page.path));
    expect(locs).toEqual(
      expect.arrayContaining([
        "https://sharedmoney.app/splitwise-alternative",
        "https://sharedmoney.app/in/splitwise-alternative",
        "https://sharedmoney.app/flatmate-expense-tracker",
      ]),
    );
    expect(locs.some((loc) => loc.includes("/faq"))).toBe(false);
    expect(sitemapLocsMatchingRedirects(locs, vercelConfig.redirects)).toEqual([]);
  });

  it("rejects /faq because vercel.json redirects it, including the trailing-slash form", () => {
    expect(
      sitemapLocsMatchingRedirects(
        ["https://sharedmoney.app/faq", "https://sharedmoney.app/faq/"],
        vercelConfig.redirects,
      ),
    ).toEqual(["https://sharedmoney.app/faq", "https://sharedmoney.app/faq/"]);
  });

  it("ignores host-conditioned www redirects and matches other sources without a trailing slash", () => {
    const redirects = [
      {
        source: "/privacy",
        has: [{ type: "host", value: "www.sharedmoney.app" }],
        destination: "https://sharedmoney.app/privacy",
        permanent: true,
      },
      {
        source: "/help/",
        destination: "/support",
        permanent: true,
      },
    ];
    expect(
      sitemapLocsMatchingRedirects(
        ["https://sharedmoney.app/privacy", "https://sharedmoney.app/help"],
        redirects,
      ),
    ).toEqual(["https://sharedmoney.app/help"]);
  });
});
