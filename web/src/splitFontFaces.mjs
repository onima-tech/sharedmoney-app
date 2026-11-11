/** Pull @font-face blocks out of a stylesheet so the rest can paint without a font request. */
export function splitFontFaces(css) {
  const faces = [];
  const rest = String(css).replace(/@font-face\{[^}]*\}/g, (block) => {
    faces.push(block);
    return "";
  });
  return { faces, rest };
}

/** Top-level CSS rules, keeping nested blocks (media queries) intact. */
export function splitTopLevelRules(css) {
  const rules = [];
  let start = 0;
  let depth = 0;
  const text = String(css);
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        rules.push(text.slice(start, i + 1));
        start = i + 1;
      }
    }
  }
  const tail = text.slice(start).trim();
  if (tail) rules.push(tail);
  return rules;
}

const HERO_RULE =
  /:root|\.dark\b|\.landing-page|\.container|\.site-header|\.nav-shell|\.brand|\.kicker|\.hero|\.store-badge|\.cta\b|\.icon-button|\.menu-toggle|\.section-nav|\.header-|\.skip-link|\.theme-icon|data-device|\.sm-|box-sizing|^\*|^\*,|^h1|^p[,{]|^a[,{]|^img|^svg|^button|^html|^body/;

/** Above-the-fold homepage rules. The full sheet loads on the next frame. */
export function criticalHomeCss(css) {
  const { rest } = splitFontFaces(css);
  return splitTopLevelRules(rest)
    .filter((rule) => HERO_RULE.test(rule.trim()))
    .join("");
}
