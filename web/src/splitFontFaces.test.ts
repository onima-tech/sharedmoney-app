import { describe, expect, it } from "vitest";
import { criticalHomeCss, splitFontFaces, splitTopLevelRules } from "./splitFontFaces.mjs";

describe("splitFontFaces", () => {
  it("moves font faces out of the stylesheet the homepage inlines", () => {
    const css =
      '@font-face{font-family:Instrument Sans Variable;src:url(/assets/a.woff2) format("woff2");unicode-range:U+0000-00FF}.hero-lead{font-size:1.2rem}@font-face{font-family:Instrument Sans Variable;src:url(/assets/b.woff2)}';
    const split = splitFontFaces(css);
    expect(split.faces).toHaveLength(2);
    expect(split.faces[0]).toContain("/assets/a.woff2");
    expect(split.faces[1]).toContain("/assets/b.woff2");
    expect(split.rest).toBe(".hero-lead{font-size:1.2rem}");
    expect(split.rest).not.toContain("@font-face");
  });

  it("keeps media queries whole and drops font faces from the hero sheet", () => {
    const css =
      "@font-face{font-family:X;src:url(a.woff2)}.hero-lead{max-width:20.14em}@media (max-width:40rem){.container{padding-inline:1rem}.bill-split-page{padding:0}}.bill-split-card{padding:1rem}";
    expect(splitTopLevelRules(css)).toHaveLength(4);
    const critical = criticalHomeCss(css);
    expect(critical).toContain(".hero-lead{max-width:20.14em}");
    expect(critical).toContain("@media (max-width:40rem){.container{padding-inline:1rem}.bill-split-page{padding:0}}");
    expect(critical).not.toContain("@font-face");
    expect(critical).not.toContain(".bill-split-card");
  });
});
