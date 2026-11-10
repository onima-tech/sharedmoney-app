import { describe, expect, it } from "vitest";
import {
  findDestinationForPlatform,
  marketingPostHogClientOptions,
  sanitizeMarketingCapture,
} from "./analytics";

describe("SSR CTA destination resolution", () => {
  it("maps stamped SSR platforms to landing destinations", () => {
    expect(findDestinationForPlatform("android")?.platform).toBe("android");
    expect(findDestinationForPlatform("ios")?.platform).toBe("ios");
    expect(findDestinationForPlatform("web")?.platform).toBe("web");
  });

  it("captures pageviews and web vitals without session replay", () => {
    expect(marketingPostHogClientOptions.capture_pageview).toBe(true);
    expect(marketingPostHogClientOptions.capture_performance.web_vitals).toBe(true);
    expect(marketingPostHogClientOptions.autocapture).toBe(false);
    expect(marketingPostHogClientOptions.disable_session_recording).toBe(true);
  });

  it("drops marketing captures that still contain a bearer token", () => {
    const token = "b".repeat(64);
    expect(
      sanitizeMarketingCapture({
        uuid: "00000000-0000-0000-0000-000000000000",
        event: "$pageview",
        properties: { $current_url: `https://sharedmoney.app/split/${token}` },
      }),
    ).toEqual({
      uuid: "00000000-0000-0000-0000-000000000000",
      event: "$pageview",
      properties: { $current_url: "https://sharedmoney.app/split/:token" },
    });
  });

  it("rejects unknown or missing platforms", () => {
    expect(findDestinationForPlatform(undefined)).toBeNull();
    expect(findDestinationForPlatform(null)).toBeNull();
    expect(findDestinationForPlatform("desktop")).toBeNull();
    expect(findDestinationForPlatform("")).toBeNull();
  });
});
