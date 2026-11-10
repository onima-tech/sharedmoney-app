import { injectSpeedInsights } from "@vercel/speed-insights";
import { sanitizeSpeedInsightsVital } from "../../shared/webVitalsPrivacy";

/**
 * Free Vercel Speed Insights for the Expo web app at /app.
 * The script is same-origin (`/_vercel/speed-insights/script.js`), so no DSN
 * or paid Observability plan is required. Do not set `route`; the script
 * would send that raw path even after beforeSend.
 */
export function enableSpeedInsights(): void {
  if (typeof window === "undefined") return;

  injectSpeedInsights({
    beforeSend: (event) => sanitizeSpeedInsightsVital(event),
  });
}
