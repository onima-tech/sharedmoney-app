import { describe, expect, it } from "vitest";
import { initialLandingDevice } from "./initialDevice";

describe("initialLandingDevice", () => {
  it("matches the server homepage on the hydrated document", () => {
    expect(
      initialLandingDevice({ hasDocument: false, hydrateHome: false, detected: "ios" }),
    ).toBe("desktop");
    expect(
      initialLandingDevice({ hasDocument: true, hydrateHome: true, detected: "android" }),
    ).toBe("desktop");
    expect(
      initialLandingDevice({ hasDocument: true, hydrateHome: true, detected: "ios" }),
    ).toBe("desktop");
  });

  it("keeps live device detection for client-rendered routes", () => {
    expect(
      initialLandingDevice({ hasDocument: true, hydrateHome: false, detected: "ios" }),
    ).toBe("ios");
  });
});
