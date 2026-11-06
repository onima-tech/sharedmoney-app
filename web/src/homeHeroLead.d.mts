export function homeHeroLeadParts(
  body: string,
): { before: string; after: string } | null;

export function renderSeoBodyParagraph(
  body: string,
  escapeHtml: (value: string) => string,
): string;
