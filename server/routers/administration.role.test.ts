import type { TrpcContext } from "../_core/context";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({
  getActiveBankForUser: vi.fn(),
  getDb: vi.fn(),
  writeBankAuditEvent: vi.fn(),
}));

import { getActiveBankForUser, getDb } from "../db";
import { appRouter } from "../routers";

function createContext(): TrpcContext {
  return {
    user: {
      id: 12,
      openId: "restricted-bank-user",
      name: "Restricted Bank User",
      email: "agent@qorebank.test",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("bankPortal.administration role enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveBankForUser).mockResolvedValue({ bankId: 7, bankName: "Qorebank", bankSlug: "qorebank", bankRole: "support_agent" });
  });

  it("prevents support agents from creating administration records", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.bankPortal.administration.create({ module: "faq", title: "New FAQ", status: "draft" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(getDb).not.toHaveBeenCalled();
  });

  it("prevents support agents from updating administration records", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.bankPortal.administration.update({ id: 44, status: "active" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(getDb).not.toHaveBeenCalled();
  });
});
