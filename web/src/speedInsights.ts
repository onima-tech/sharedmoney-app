import { injectSpeedInsights } from "@vercel/speed-insights";
import { sanitizeSpeedInsightsVital } from "../../shared/webVitalsPrivacy";

/**
 * Free Vercel Speed Insights (Hobby). The project already serves
 * `/_vercel/speed-insights/script.js`; this registers the browser reporter.
 * Do not pass `route`: the script keeps the original route and only replaces
 * href with the URL returned from `beforeSend`.
 */
export function enableSpeedInsights(): void {
  if (typeof window === "undefined") return;

  injectSpeedInsights({
    beforeSend: (event) => sanitizeSpeedInsightsVital(event),
  });
}
