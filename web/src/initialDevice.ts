export type LandingDevice = "ios" | "android" | "desktop";

/**
 * The hydrated homepage is rendered as desktop, which picks the same Android-primary
 * tree Lighthouse's mobile run would. iOS order is CSS (`html[data-device=ios]`),
 * so the first client render matches the document and React keeps the hero lead node.
 */
export function initialLandingDevice(input: {
  hasDocument: boolean;
  hydrateHome: boolean;
  detected: LandingDevice;
}): LandingDevice {
  if (!input.hasDocument || input.hydrateHome) return "desktop";
  return input.detected;
}
