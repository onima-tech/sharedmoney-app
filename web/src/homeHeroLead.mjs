const BREAK_AFTER = "dinners. ";
const CODA = "No daily limits, no ads, no bank link.";

// Render-only break. The approved sentence stays one string; `text-wrap: balance`
// on `.hero-lead` would otherwise leave "No" hanging at the end of line 2.
export function homeHeroLeadParts(body) {
  const at = String(body).indexOf(BREAK_AFTER);
  if (at === -1) return null;
  const before = body.slice(0, at + BREAK_AFTER.length);
  const after = body.slice(at + BREAK_AFTER.length);
  if (after !== CODA) return null;
  return { before, after };
}

export function renderSeoBodyParagraph(body, escapeHtml) {
  const parts = homeHeroLeadParts(body);
  if (!parts) return `<p>${escapeHtml(body)}</p>`;
  return `<p>${escapeHtml(parts.before)}<br>${escapeHtml(parts.after)}</p>`;
}
