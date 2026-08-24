import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

vi.mock("../db", () => ({
  getActiveBankForUser: vi.fn(),
  getDb: vi.fn(),
  writeBankAuditEvent: vi.fn(),
}));

import { getActiveBankForUser, getDb, writeBankAuditEvent } from "../db";
import { appRouter } from "../routers";

function createContext(): TrpcContext {
  return {
    user: { id: 17, openId: "console-user", name: "Console User", email: "console@example.test", loginMethod: "managed_session", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("bankPortal environment boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveBankForUser).mockResolvedValue({ bankId: 9, bankName: "Customer tenant", bankSlug: "customer-tenant", bankRole: "organization_admin" });
  });

  it("persists financial-system connections in the requested environment", async () => {
    const values = vi.fn().mockResolvedValue([{ insertId: 41 }]);
    vi.mocked(getDb).mockResolvedValue({ insert: vi.fn().mockReturnValue({ values }) } as never);

    await expect(appRouter.createCaller(createContext()).bankPortal.integrations.create({
      kind: "customer_api", environment: "production", endpointLabel: "https://api.customer.example", permissions: "Read customer balances",
    })).resolves.toMatchObject({ success: true, id: 41 });

    expect(values).toHaveBeenCalledWith(expect.objectContaining({ bankId: 9, environment: "production", kind: "customer_api" }));
    expect(writeBankAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ bankId: 9, resourceType: "integration" }));
  });

  it("persists developer-console configuration records in the requested environment", async () => {
    const values = vi.fn().mockResolvedValue([{ insertId: 88 }]);
    vi.mocked(getDb).mockResolvedValue({ insert: vi.fn().mockReturnValue({ values }) } as never);

    await expect(appRouter.createCaller(createContext()).bankPortal.administration.create({
      module: "application", environment: "sandbox", title: "Console sandbox application", detail: "Regression coverage", status: "draft",
    })).resolves.toMatchObject({ success: true, id: 88 });

    expect(values).toHaveBeenCalledWith(expect.objectContaining({ bankId: 9, environment: "sandbox", module: "application" }));
    expect(writeBankAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ bankId: 9, resourceType: "administration_record" }));
  });

  it("updates an integration only after confirming its tenant and environment ownership", async () => {
    const limit = vi.fn().mockResolvedValue([{ id: 41, environment: "production" }]);
    const whereSelect = vi.fn().mockReturnValue({ limit });
    const set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    vi.mocked(getDb).mockResolvedValue({
      select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: whereSelect }) }),
      update: vi.fn().mockReturnValue({ set }),
    } as never);

    await expect(appRouter.createCaller(createContext()).bankPortal.integrations.update({
      id: 41, environment: "production", endpointLabel: "https://api.customer.example/v2", permissions: "Read accounts and transactions",
    })).resolves.toEqual({ success: true });

    expect(whereSelect).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ endpointLabel: "https://api.customer.example/v2", permissions: "Read accounts and transactions", updatedByUserId: 17 }));
    expect(writeBankAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "Updated customer financial system connection", resourceId: "41" }));
  });

  it("issues a one-time environment-scoped API key while persisting only its hash and ending", async () => {
    const values = vi.fn().mockResolvedValue([{ insertId: 121 }]);
    vi.mocked(getDb).mockResolvedValue({ insert: vi.fn().mockReturnValue({ values }) } as never);

    const result = await appRouter.createCaller(createContext()).bankPortal.developers.createApiKey({
      environment: "sandbox", name: "Customer sandbox key", scopes: "accounts:read transactions:read",
    });

    expect(result).toMatchObject({ success: true, id: 121 });
    expect(result.secret).toMatch(/^fck_/);
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ bankId: 9, environment: "sandbox", secretHash: expect.any(String), keyLast4: result.secret.slice(-4) }));
    expect(values.mock.calls[0][0]).not.toHaveProperty("secret");
  });

  it("updates a security configuration record only within its selected environment", async () => {
    const limit = vi.fn().mockResolvedValue([{ id: 212, module: "security_event", title: "Credential rotation" }]);
    const whereSelect = vi.fn().mockReturnValue({ limit });
    const set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    vi.mocked(getDb).mockResolvedValue({
      select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: whereSelect }) }),
      update: vi.fn().mockReturnValue({ set }),
    } as never);

    await expect(appRouter.createCaller(createContext()).bankPortal.administration.update({
      id: 212, environment: "production", detail: "Rotation scheduled with security owner", status: "review",
    })).resolves.toEqual({ success: true });

    expect(set).toHaveBeenCalledWith(expect.objectContaining({ detail: "Rotation scheduled with security owner", status: "review", updatedByUserId: 17 }));
    expect(writeBankAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ module: "security_event", resourceId: "212" }));
  });

  it("creates an OAuth client with a validated redirect URI in the selected environment", async () => {
    const values = vi.fn().mockResolvedValue([{ insertId: 333 }]);
    vi.mocked(getDb).mockResolvedValue({ insert: vi.fn().mockReturnValue({ values }) } as never);

    await expect(appRouter.createCaller(createContext()).bankPortal.customerControls.createOAuthClient({
      environment: "sandbox", name: "Mobile banking client", redirectUri: "https://mobile.customer.example/callback", scopes: "accounts:read",
    })).resolves.toEqual({ success: true, id: 333 });

    expect(values).toHaveBeenCalledWith(expect.objectContaining({ bankId: 9, environment: "sandbox", module: "oauth", status: "active", title: "Mobile banking client" }));
    expect(writeBankAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "Created OAuth client", resourceType: "oauth_client" }));
  });

  it("stores security controls as review-tracked records without accepting plaintext values", async () => {
    const values = vi.fn().mockResolvedValue([{ insertId: 334 }]);
    vi.mocked(getDb).mockResolvedValue({ insert: vi.fn().mockReturnValue({ values }) } as never);

    await expect(appRouter.createCaller(createContext()).bankPortal.customerControls.saveSecurityControl({
      environment: "production", control: "secret", name: "Customer vault rotation", owner: "Security operations", reviewNote: "Review rotation evidence monthly",
    })).resolves.toEqual({ success: true, id: 334 });

    expect(values).toHaveBeenCalledWith(expect.objectContaining({ bankId: 9, environment: "production", module: "secret", status: "review" }));
    expect(values.mock.calls[0][0].detail).toContain("Sensitive values are not stored");
  });

  it("creates webhook and SDK configurations in the selected environment", async () => {
    const values = vi.fn().mockResolvedValue([{ insertId: 335 }]);
    vi.mocked(getDb).mockResolvedValue({ insert: vi.fn().mockReturnValue({ values }) } as never);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.bankPortal.customerControls.createWebhook({ environment: "sandbox", name: "Ledger events", endpoint: "https://ledger.customer.example/events", events: "account.updated" })).resolves.toEqual({ success: true, id: 335 });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ module: "webhook", environment: "sandbox", status: "active" }));

    await expect(caller.bankPortal.customerControls.createSdkConfiguration({ environment: "production", name: "Mobile SDK", language: "typescript", packageName: "@customer/fincare" })).resolves.toEqual({ success: true, id: 335 });
    expect(values).toHaveBeenLastCalledWith(expect.objectContaining({ module: "sdk", environment: "production", status: "ready" }));
  });

  it("creates notification and explicit customer setting records in their selected environment", async () => {
    const values = vi.fn().mockResolvedValue([{ insertId: 336 }]);
    vi.mocked(getDb).mockResolvedValue({ insert: vi.fn().mockReturnValue({ values }) } as never);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.bankPortal.customerControls.saveNotificationSetting({ environment: "sandbox", channel: "email", event: "integration.failure", destination: "ops@customer.example" })).resolves.toEqual({ success: true, id: 336 });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ module: "notification", environment: "sandbox", status: "active" }));

    await expect(caller.bankPortal.customerControls.saveSetting({ environment: "production", category: "api", name: "Request timeout", value: "20s", rationale: "Approved production resilience threshold" })).resolves.toEqual({ success: true, id: 336 });
    expect(values).toHaveBeenLastCalledWith(expect.objectContaining({ module: "api_setting", environment: "production", status: "active" }));
  });

  it("updates an organization member role through the same protected path used by the active console", async () => {
    vi.mocked(getActiveBankForUser).mockResolvedValue({ bankId: 9, bankName: "Customer tenant", bankSlug: "customer-tenant", bankRole: "bank_admin" });
    const limit = vi.fn().mockResolvedValue([{ id: 71, bankId: 9 }]);
    const set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    vi.mocked(getDb).mockResolvedValue({ select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit }) }) }), update: vi.fn().mockReturnValue({ set }) } as never);

    await expect(appRouter.createCaller(createContext()).bankPortal.team.changeRole({ membershipId: 71, role: "analyst" })).resolves.toEqual({ success: true });
    expect(set).toHaveBeenCalledWith({ role: "analyst" });
    expect(writeBankAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "Changed team role", resourceType: "membership", resourceId: "71" }));
  });

  it("persists dedicated General, Developer, API, and Environment settings with category-specific records", async () => {
    const values = vi.fn().mockResolvedValue([{ insertId: 337 }]);
    vi.mocked(getDb).mockResolvedValue({ insert: vi.fn().mockReturnValue({ values }) } as never);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.bankPortal.customerControls.saveGeneralSettings({ environment: "sandbox", organizationAlias: "Customer sandbox", supportEmail: "ops@customer.example" })).resolves.toEqual({ success: true, id: 337 });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ module: "organization", environment: "sandbox" }));

    await expect(caller.bankPortal.customerControls.saveDeveloperSettings({ environment: "sandbox", defaultSdk: "typescript", allowedOrigin: "https://app.customer.example" })).resolves.toEqual({ success: true, id: 337 });
    expect(values).toHaveBeenLastCalledWith(expect.objectContaining({ module: "developer_setting", environment: "sandbox" }));

    await expect(caller.bankPortal.customerControls.saveApiSettings({ environment: "production", requestTimeoutSeconds: 30, rateLimitPerMinute: 600 })).resolves.toEqual({ success: true, id: 337 });
    expect(values).toHaveBeenLastCalledWith(expect.objectContaining({ module: "api_setting", environment: "production" }));

    await expect(caller.bankPortal.customerControls.saveEnvironmentSettings({ environment: "production", releaseWindow: "Saturday 02:00 UTC", approvalRequired: true })).resolves.toEqual({ success: true, id: 337 });
    expect(values).toHaveBeenLastCalledWith(expect.objectContaining({ module: "environment", environment: "production", status: "review" }));
  });
});
