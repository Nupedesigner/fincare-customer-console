import type { Request } from "express";

export type ProfilePreferenceValues = {
  emailDigest: boolean;
  securityAlerts: boolean;
  productUpdates: boolean;
  defaultWorkspace: "overview" | "conversations" | "analytics";
};

export const DEFAULT_PROFILE_PREFERENCES: ProfilePreferenceValues = {
  emailDigest: true,
  securityAlerts: true,
  productUpdates: false,
  defaultWorkspace: "overview",
};

export function getManagedDeviceDetails(userAgent?: string) {
  const value = userAgent ?? "";
  const lower = value.toLowerCase();
  const operatingSystem = /windows nt 10/i.test(value)
    ? "Windows 10"
    : /iphone/i.test(value)
      ? "iOS"
      : /ipad/i.test(value)
        ? "iPadOS"
        : /android/i.test(value)
          ? "Android"
          : /mac os x/i.test(value)
            ? "macOS"
            : /linux/i.test(value)
              ? "Linux"
              : "Unknown platform";
  const browser = /edg\//i.test(value)
    ? "Microsoft Edge"
    : /opr\//i.test(value)
      ? "Opera"
      : /firefox\//i.test(value)
        ? "Firefox"
        : /chrome\//i.test(value) || /crios\//i.test(value)
          ? "Chrome"
          : /safari\//i.test(value)
            ? "Safari"
            : "Unknown browser";
  const deviceType = /ipad/i.test(value) ? "Tablet" : /android|iphone|ipod|mobile/i.test(lower) ? "Mobile device" : value ? "Desktop device" : "Unknown device";
  return { deviceLabel: `${deviceType} · ${operatingSystem}`, browser, operatingSystem };
}

export function getSignInActivityDetails(req: Request, signInProvider: string, source: "oauth" | "managed_session") {
  return {
    signInProvider: signInProvider.trim().slice(0, 64) || "Managed identity",
    source,
    ...getManagedDeviceDetails(req.get("user-agent") ?? undefined),
  };
}
