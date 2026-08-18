import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE_PREFERENCES, getManagedDeviceDetails } from "./profileSecurity";

describe("profile security helpers", () => {
  it("provides safe defaults for new profile preferences", () => {
    expect(DEFAULT_PROFILE_PREFERENCES).toEqual({
      emailDigest: true,
      securityAlerts: true,
      productUpdates: false,
      defaultWorkspace: "overview",
    });
  });

  it("describes a desktop managed session from its browser user agent", () => {
    expect(getManagedDeviceDetails("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/139.0 Safari/537.36")).toEqual({
      deviceLabel: "Desktop device · Windows 10",
      browser: "Chrome",
      operatingSystem: "Windows 10",
    });
  });

  it("describes a mobile managed session without deriving location data", () => {
    expect(getManagedDeviceDetails("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1")).toEqual({
      deviceLabel: "Mobile device · iOS",
      browser: "Safari",
      operatingSystem: "iOS",
    });
  });
});
