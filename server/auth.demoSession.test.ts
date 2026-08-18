import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  getActiveBankForUser: vi.fn(),
  getDb: vi.fn(),
  getProfilePreferences: vi.fn(),
  getUserSignInActivities: vi.fn(),
  provisionQorebankDemoPortalUser: vi.fn(),
  recordUserSignInActivity: vi.fn(),
  saveProfilePreferences: vi.fn(),
  writeBankAuditEvent: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({
  sdk: { createSessionToken: vi.fn() },
}));

import { provisionQorebankDemoPortalUser, recordUserSignInActivity } from "./db";
import { sdk } from "./_core/sdk";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";

function createContext() {
  const cookieCalls: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  const ctx = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
      get: (header: string) => header.toLowerCase() === "user-agent" ? "Mozilla/5.0 (X11; Linux x86_64) Chrome/139.0 Safari/537.36" : undefined,
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => cookieCalls.push({ name, value, options }),
    } as TrpcContext["res"],
  } as TrpcContext;
  return { ctx, cookieCalls };
}

describe("auth.startDemoSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a non-production FinCare session and records browser device details", async () => {
    vi.mocked(provisionQorebankDemoPortalUser).mockResolvedValue({
      id: 7,
      openId: "fincare_demo_qorebank_admin",
      name: "FinCare Demo Administrator",
      email: "demo-admin@fincare.example",
      loginMethod: "FinCare demo access",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });
    vi.mocked(sdk.createSessionToken).mockResolvedValue("demo-session-token");
    vi.mocked(recordUserSignInActivity).mockResolvedValue(undefined);
    const { ctx, cookieCalls } = createContext();

    await expect(appRouter.createCaller(ctx).auth.startDemoSession({ remember: false })).resolves.toEqual({ success: true });

    expect(sdk.createSessionToken).toHaveBeenCalledWith("fincare_demo_qorebank_admin", {
      name: "FinCare Demo Administrator",
      expiresInMs: 12 * 60 * 60 * 1000,
    });
    expect(cookieCalls[0]).toMatchObject({ name: COOKIE_NAME, value: "demo-session-token", options: { maxAge: 12 * 60 * 60 * 1000 } });
    expect(recordUserSignInActivity).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
      signInProvider: "FinCare demo access",
      deviceLabel: "Desktop device · Linux",
      browser: "Chrome",
      source: "managed_session",
    }));
  });
});
