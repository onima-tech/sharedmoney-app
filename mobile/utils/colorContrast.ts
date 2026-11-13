/** WCAG 2 relative luminance and contrast for sRGB hex colors. */

export function relativeLuminance(hex: string): number {
  const [red, green, blue] = parseHex(hex);
  return 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue);
}

export function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

/** Composite a solid hex over another. Alpha is the top layer's opacity. */
export function compositeHex(top: string, alpha: number, bottom: string): string {
  const [tr, tg, tb] = parseHex(top);
  const [br, bg, bb] = parseHex(bottom);
  const channel = (fore: number, back: number) => Math.round(fore * alpha + back * (1 - alpha));
  return formatHex(channel(tr, br), channel(tg, bg), channel(tb, bb));
}

function parseHex(hex: string): [number, number, number] {
  const value = hex.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    throw new Error(`expected a 6-digit hex color, received ${hex}`);
  }
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function formatHex(red: number, green: number, blue: number): string {
  return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function linearize(channel: number): number {
  const srgb = channel / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}
