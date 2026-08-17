import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

vi.mock("../db", () => ({
  getActiveBankForUser: vi.fn(),
  getDb: vi.fn(),
  writeBankAuditEvent: vi.fn(),
}));

import { getActiveBankForUser } from "../db";
import { appRouter } from "../routers";

function createContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "bank-user",
      name: "Bank User",
      email: "bank@example.test",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("bankPortal.context", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null for an authenticated user without a bank so the UI can show setup", async () => {
    vi.mocked(getActiveBankForUser).mockResolvedValue(null);
    const result = await appRouter.createCaller(createContext()).bankPortal.context();
    expect(result).toBeNull();
  });

  it("returns the active membership before tenant-scoped routes query their data", async () => {
    vi.mocked(getActiveBankForUser).mockResolvedValue({ bankId: 7, bankName: "Qorebank", bankSlug: "qorebank", bankRole: "bank_admin" });
    const result = await appRouter.createCaller(createContext()).bankPortal.context();
    expect(result).toMatchObject({ bankId: 7, bankSlug: "qorebank", bankRole: "bank_admin" });
  });

  it("does not allow a bank user to create an organization from the bank portal", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.bankPortal.bootstrap({ bankName: "Qorebank", bankSlug: "qorebank" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
