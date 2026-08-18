import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

vi.mock("../db", () => ({
  getActiveBankForUser: vi.fn(),
  getDb: vi.fn(),
  getProfilePreferences: vi.fn(),
  getUserSignInActivities: vi.fn(),
  saveProfilePreferences: vi.fn(),
  writeBankAuditEvent: vi.fn(),
}));

import { getProfilePreferences, getUserSignInActivities, saveProfilePreferences } from "../db";
import { appRouter } from "../routers";

function createContext(): TrpcContext {
  return {
    user: {
      id: 7,
      openId: "profile-user",
      name: "Profile User",
      email: "profile@example.test",
      loginMethod: "qorebank-sso",
      role: "admin",
      createdAt: new Date("2026-08-18T08:00:00.000Z"),
      updatedAt: new Date("2026-08-18T08:00:00.000Z"),
      lastSignedIn: new Date("2026-08-18T09:00:00.000Z"),
    },
    req: { get: (header: string) => header.toLowerCase() === "user-agent" ? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/139.0 Safari/537.36" : undefined } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("bankPortal.profile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns owner-scoped defaults, current device details, and only the caller's activity", async () => {
    vi.mocked(getProfilePreferences).mockResolvedValue(undefined);
    vi.mocked(getUserSignInActivities).mockResolvedValue([]);

    const result = await appRouter.createCaller(createContext()).bankPortal.profile.get();

    expect(getProfilePreferences).toHaveBeenCalledWith(7);
    expect(getUserSignInActivities).toHaveBeenCalledWith(7);
    expect(result.preferences.defaultWorkspace).toBe("overview");
    expect(result.currentSession).toMatchObject({
      signInProvider: "qorebank-sso",
      deviceLabel: "Desktop device · Windows 10",
      browser: "Chrome",
    });
  });

  it("persists preferences only against the authenticated user id", async () => {
    vi.mocked(saveProfilePreferences).mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.bankPortal.profile.updatePreferences({
      emailDigest: false,
      securityAlerts: true,
      productUpdates: true,
      defaultWorkspace: "analytics",
    })).resolves.toEqual({ success: true });

    expect(saveProfilePreferences).toHaveBeenCalledWith({
      userId: 7,
      emailDigest: false,
      securityAlerts: true,
      productUpdates: true,
      defaultWorkspace: "analytics",
    });
  });
});
