import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import {
  administrationRecords,
  agentConfigs,
  auditEvents,
  bankMemberships,
  banks,
  channelDeployments,
  conversations,
  developerApiKeys,
  deploymentReleases,
  integrationConnections,
  knowledgeItems,
  users,
} from "../../drizzle/schema";
import { getActiveBankForUser, getDb, getProfilePreferences, getUserSignInActivities, saveProfilePreferences, writeBankAuditEvent } from "../db";
import { invokeLLM } from "../_core/llm";
import { storagePut } from "../storage";
import { normalizeBankSlug } from "../../shared/bankSlug";
import { protectedProcedure, router } from "../_core/trpc";
import { DEFAULT_PROFILE_PREFERENCES, getManagedDeviceDetails } from "../profileSecurity";

const bankRoleSchema = z.enum([
  "bank_owner",
  "organization_admin",
  "bank_admin",
  "ai_manager",
  "integration_manager",
  "support_manager",
  "support_agent",
  "analyst",
  "compliance_officer",
]);

async function requireBankContext(userId: number) {
  const bank = await getActiveBankForUser(userId);
  if (!bank) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No active FinCare bank environment is assigned to this user.",
    });
  }
  return bank;
}

function requireOneOfRoles(bankRole: string, roles: readonly string[]) {
  if (!roles.includes(bankRole)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Your bank role cannot perform this action." });
  }
}

const configInput = z.object({
  agentName: z.string().trim().min(2).max(120),
  welcomeMessage: z.string().trim().min(5).max(2000),
  description: z.string().trim().min(10).max(3000),
  supportedLanguages: z.string().trim().min(2).max(500),
  customerTone: z.string().trim().min(2).max(120),
});

const administrationModuleSchema = z.enum(["faq", "product", "sdk", "webhook", "environment", "api_log", "queue", "escalation", "organization", "application", "api_key", "oauth", "api_documentation", "sandbox", "ai_model", "ai_prompt", "ai_capability", "guardrail", "ai_evaluation", "ai_usage", "knowledge_base", "policy", "support_documentation", "rag_configuration", "rule", "monitoring_alert", "security_event", "secret", "access_permission", "notification", "developer_setting", "api_setting"]);
const administrationStatusSchema = z.enum(["draft", "pending", "ready", "active", "review", "disabled", "archived"]);

export const bankPortalRouter = router({
  context: protectedProcedure.query(async ({ ctx }) => getActiveBankForUser(ctx.user.id) ?? null),

  profile: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const [preferences, activities] = await Promise.all([
        getProfilePreferences(ctx.user.id),
        getUserSignInActivities(ctx.user.id),
      ]);
      return {
        preferences: preferences ? {
          emailDigest: preferences.emailDigest,
          securityAlerts: preferences.securityAlerts,
          productUpdates: preferences.productUpdates,
          defaultWorkspace: preferences.defaultWorkspace,
        } : DEFAULT_PROFILE_PREFERENCES,
        activities,
        currentSession: {
          signInProvider: ctx.user.loginMethod ?? "Managed identity",
          source: "managed_session" as const,
          ...getManagedDeviceDetails(ctx.req.get("user-agent") ?? undefined),
          createdAt: ctx.user.lastSignedIn,
        },
      };
    }),
    updatePreferences: protectedProcedure.input(z.object({
      emailDigest: z.boolean(),
      securityAlerts: z.boolean(),
      productUpdates: z.boolean(),
      defaultWorkspace: z.enum(["overview", "conversations", "analytics"]),
    })).mutation(async ({ ctx, input }) => {
      await saveProfilePreferences({ userId: ctx.user.id, ...input });
      return { success: true };
    }),
  }),

  bootstrap: protectedProcedure.input(z.object({
    bankName: z.string().trim().min(2).max(160),
    bankSlug: z.string().trim().min(1).max(255),
  })).mutation(async () => {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Bank environments are created by Qorebox/FinCare administrators. Ask your organization administrator to assign your portal access.",
    });
  }),

  agent: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const bank = await requireBankContext(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const result = await db.select().from(agentConfigs).where(eq(agentConfigs.bankId, bank.bankId)).limit(1);
      return result[0] ?? null;
    }),
    save: protectedProcedure.input(configInput).mutation(async ({ ctx, input }) => {
      const bank = await requireBankContext(ctx.user.id);
      requireOneOfRoles(bank.bankRole, ["bank_owner", "organization_admin", "bank_admin", "ai_manager"]);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const existing = await db.select({ id: agentConfigs.id }).from(agentConfigs).where(eq(agentConfigs.bankId, bank.bankId)).limit(1);
      if (existing[0]) {
        await db.update(agentConfigs).set({ ...input, updatedByUserId: ctx.user.id }).where(eq(agentConfigs.id, existing[0].id));
      } else {
        await db.insert(agentConfigs).values({ bankId: bank.bankId, updatedByUserId: ctx.user.id, ...input });
      }
      await writeBankAuditEvent({ bankId: bank.bankId, actorUserId: ctx.user.id, action: "Saved agent configuration", module: "My AI Agent", resourceType: "agent_config", detail: "Updated bank-controlled customer-facing agent settings." });
      return { success: true };
    }),
  }),

  knowledge: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const bank = await requireBankContext(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      return db.select().from(knowledgeItems).where(eq(knowledgeItems.bankId, bank.bankId)).orderBy(desc(knowledgeItems.updatedAt));
    }),
    create: protectedProcedure.input(z.object({
      title: z.string().trim().min(2).max(255),
      category: z.enum(["loans", "savings", "fixed_deposits", "cards", "forex", "investments", "general_banking", "faqs"]),
      sourceType: z.enum(["article", "url"]),
      sourceUrl: z.string().url().max(2048).optional(),
    })).mutation(async ({ ctx, input }) => {
      const bank = await requireBankContext(ctx.user.id);
      requireOneOfRoles(bank.bankRole, ["bank_owner", "bank_admin", "support_manager"]);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.insert(knowledgeItems).values({
        bankId: bank.bankId,
        title: input.title,
        category: input.category,
        sourceType: input.sourceType,
        sourceUrl: input.sourceUrl,
        version: "v1.0",
        indexingStatus: "pending",
        createdByUserId: ctx.user.id,
        updatedByUserId: ctx.user.id,
      });
      await writeBankAuditEvent({ bankId: bank.bankId, actorUserId: ctx.user.id, action: "Created knowledge item", module: "Knowledge Base", resourceType: "knowledge_item", detail: input.title });
      return { success: true };
    }),
    upload: protectedProcedure.input(z.object({
      filename: z.string().trim().min(1).max(255),
      mimeType: z.string().trim().min(3).max(160),
      category: z.enum(["loans", "savings", "fixed_deposits", "cards", "forex", "investments", "general_banking", "faqs"]),
      base64: z.string().min(1).max(10_500_000),
    })).mutation(async ({ ctx, input }) => {
      const bank = await requireBankContext(ctx.user.id);
      requireOneOfRoles(bank.bankRole, ["bank_owner", "bank_admin", "support_manager"]);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const safeFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileBuffer = Buffer.from(input.base64.replace(/^data:[^;]+;base64,/, ""), "base64");
      const stored = await storagePut(`banks/${bank.bankId}/knowledge/${safeFilename}`, fileBuffer, input.mimeType);
      await db.insert(knowledgeItems).values({ bankId: bank.bankId, title: input.filename.replace(/\.[^.]+$/, ""), category: input.category, sourceType: "document", version: "v1.0", indexingStatus: "pending", storageKey: stored.key, createdByUserId: ctx.user.id, updatedByUserId: ctx.user.id });
      await writeBankAuditEvent({ bankId: bank.bankId, actorUserId: ctx.user.id, action: "Uploaded knowledge document", module: "Knowledge Base", resourceType: "knowledge_item", detail: input.filename });
      return { success: true, url: stored.url };
    }),
  }),

  integrations: router({
    list: protectedProcedure.input(z.object({ environment: z.enum(["sandbox", "production"]) }).optional()).query(async ({ ctx, input }) => {
      const bank = await requireBankContext(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      return db.select().from(integrationConnections).where(and(eq(integrationConnections.bankId, bank.bankId), eq(integrationConnections.environment, input?.environment ?? "sandbox")));
    }),
    test: protectedProcedure.input(z.object({ id: z.number().int().positive(), environment: z.enum(["sandbox", "production"]).optional() })).mutation(async ({ ctx, input }) => {
      const bank = await requireBankContext(ctx.user.id);
      requireOneOfRoles(bank.bankRole, ["bank_owner", "bank_admin"]);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const connection = await db.select().from(integrationConnections).where(and(eq(integrationConnections.id, input.id), eq(integrationConnections.bankId, bank.bankId), eq(integrationConnections.environment, input.environment ?? "sandbox"))).limit(1);
      if (!connection[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Connection not found in this bank environment." });
      await db.update(integrationConnections).set({ status: "connected", lastSuccessfulRequestAt: new Date(), updatedByUserId: ctx.user.id }).where(eq(integrationConnections.id, input.id));
      await writeBankAuditEvent({ bankId: bank.bankId, actorUserId: ctx.user.id, action: "Tested integration", module: "Integrations", resourceType: "integration", resourceId: String(input.id), detail: connection[0].kind });
      return { success: true };
    }),
    create: protectedProcedure.input(z.object({
      kind: z.enum(["core_banking", "customer_api", "account_api", "transaction_api", "loan_api", "card_api", "payment_api", "custom_financial_api", "crm_live_agent", "web_banking", "mobile_banking"]),
      environment: z.enum(["sandbox", "production"]).default("sandbox"),
      endpointLabel: z.string().trim().min(3).max(255),
      permissions: z.string().trim().min(3).max(2000),
    })).mutation(async ({ ctx, input }) => {
      const bank = await requireBankContext(ctx.user.id);
      requireOneOfRoles(bank.bankRole, ["bank_owner", "organization_admin", "bank_admin", "integration_manager"]);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const result = await db.insert(integrationConnections).values({ bankId: bank.bankId, environment: input.environment, kind: input.kind, status: "pending", endpointLabel: input.endpointLabel, permissions: input.permissions, updatedByUserId: ctx.user.id });
      const id = Number(result[0].insertId);
      await writeBankAuditEvent({ bankId: bank.bankId, actorUserId: ctx.user.id, action: "Created customer financial system connection", module: "Integrations", resourceType: "integration", resourceId: String(id), detail: input.endpointLabel });
      return { success: true, id };
    }),
    update: protectedProcedure.input(z.object({
      id: z.number().int().positive(),
      environment: z.enum(["sandbox", "production"]),
      endpointLabel: z.string().trim().min(3).max(255),
      permissions: z.string().trim().min(3).max(2000),
    })).mutation(async ({ ctx, input }) => {
      const bank = await requireBankContext(ctx.user.id);
      requireOneOfRoles(bank.bankRole, ["bank_owner", "organization_admin", "bank_admin", "integration_manager"]);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const existing = await db.select().from(integrationConnections).where(and(eq(integrationConnections.id, input.id), eq(integrationConnections.bankId, bank.bankId), eq(integrationConnections.environment, input.environment))).limit(1);
      if (!existing[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Connection not found in this customer environment." });
      await db.update(integrationConnections).set({ endpointLabel: input.endpointLabel, permissions: input.permissions, updatedByUserId: ctx.user.id }).where(eq(integrationConnections.id, input.id));
      await writeBankAuditEvent({ bankId: bank.bankId, actorUserId: ctx.user.id, action: "Updated customer financial system connection", module: "Integrations", resourceType: "integration", resourceId: String(input.id), detail: input.endpointLabel });
      return { success: true };
    }),
  }),

  developers: router({
    listApiKeys: protectedProcedure.input(z.object({ environment: z.enum(["sandbox", "production"]) })).query(async ({ ctx, input }) => {
      const bank = await requireBankContext(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      return db.select({ id: developerApiKeys.id, name: developerApiKeys.name, scopes: developerApiKeys.scopes, keyLast4: developerApiKeys.keyLast4, status: developerApiKeys.status, createdAt: developerApiKeys.createdAt, revokedAt: developerApiKeys.revokedAt }).from(developerApiKeys).where(and(eq(developerApiKeys.bankId, bank.bankId), eq(developerApiKeys.environment, input.environment))).orderBy(desc(developerApiKeys.createdAt));
    }),
    createApiKey: protectedProcedure.input(z.object({ environment: z.enum(["sandbox", "production"]), name: z.string().trim().min(2).max(160), scopes: z.string().trim().min(2).max(1000) })).mutation(async ({ ctx, input }) => {
      const bank = await requireBankContext(ctx.user.id);
      requireOneOfRoles(bank.bankRole, ["bank_owner", "organization_admin", "bank_admin", "integration_manager"]);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const secret = `fck_${randomBytes(24).toString("base64url")}`;
      const secretHash = createHash("sha256").update(secret).digest("hex");
      const result = await db.insert(developerApiKeys).values({ bankId: bank.bankId, environment: input.environment, name: input.name, scopes: input.scopes, keyLast4: secret.slice(-4), secretHash, createdByUserId: ctx.user.id });
      const id = Number(result[0].insertId);
      await writeBankAuditEvent({ bankId: bank.bankId, actorUserId: ctx.user.id, action: "Created developer API key", module: "Developers", resourceType: "developer_api_key", resourceId: String(id), detail: `${input.name} (${input.environment})` });
      return { success: true, id, secret, keyLast4: secret.slice(-4) };
    }),
    revokeApiKey: protectedProcedure.input(z.object({ id: z.number().int().positive(), environment: z.enum(["sandbox", "production"]) })).mutation(async ({ ctx, input }) => {
      const bank = await requireBankContext(ctx.user.id);
      requireOneOfRoles(bank.bankRole, ["bank_owner", "organization_admin", "bank_admin", "integration_manager"]);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const key = await db.select({ id: developerApiKeys.id, name: developerApiKeys.name }).from(developerApiKeys).where(and(eq(developerApiKeys.id, input.id), eq(developerApiKeys.bankId, bank.bankId), eq(developerApiKeys.environment, input.environment))).limit(1);
      if (!key[0]) throw new TRPCError({ code: "NOT_FOUND", message: "API key not found in this customer environment." });
      await db.update(developerApiKeys).set({ status: "revoked", revokedAt: new Date() }).where(eq(developerApiKeys.id, input.id));
      await writeBankAuditEvent({ bankId: bank.bankId, actorUserId: ctx.user.id, action: "Revoked developer API key", module: "Developers", resourceType: "developer_api_key", resourceId: String(input.id), detail: key[0].name });
      return { success: true };
    }),
  }),

  customerControls: router({
    createOAuthClient: protectedProcedure.input(z.object({ environment: z.enum(["sandbox", "production"]), name: z.string().trim().min(2).max(160), redirectUri: z.string().url().max(1000), scopes: z.string().trim().min(2).max(1000) })).mutation(async ({ ctx, input }) => {
      const bank = await requireBankContext(ctx.user.id); requireOneOfRoles(bank.bankRole, ["bank_owner", "organization_admin", "bank_admin", "integration_manager"]);
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const result = await db.insert(administrationRecords).values({ bankId: bank.bankId, environment: input.environment, module: "oauth", title: input.name, detail: `Redirect URI: ${input.redirectUri}\nScopes: ${input.scopes}`, status: "active", createdByUserId: ctx.user.id, updatedByUserId: ctx.user.id }); const id = Number(result[0].insertId);
      await writeBankAuditEvent({ bankId: bank.bankId, actorUserId: ctx.user.id, action: "Created OAuth client", module: "Developers", resourceType: "oauth_client", resourceId: String(id), detail: input.name }); return { success: true, id };
    }),
    createWebhook: protectedProcedure.input(z.object({ environment: z.enum(["sandbox", "production"]), name: z.string().trim().min(2).max(160), endpoint: z.string().url().max(1000), events: z.string().trim().min(2).max(1000) })).mutation(async ({ ctx, input }) => {
      const bank = await requireBankContext(ctx.user.id); requireOneOfRoles(bank.bankRole, ["bank_owner", "organization_admin", "bank_admin", "integration_manager"]);
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const result = await db.insert(administrationRecords).values({ bankId: bank.bankId, environment: input.environment, module: "webhook", title: input.name, detail: `Endpoint: ${input.endpoint}\nEvents: ${input.events}\nSigning secret: managed externally`, status: "active", createdByUserId: ctx.user.id, updatedByUserId: ctx.user.id }); const id = Number(result[0].insertId);
      await writeBankAuditEvent({ bankId: bank.bankId, actorUserId: ctx.user.id, action: "Created webhook subscription", module: "Developers", resourceType: "webhook", resourceId: String(id), detail: input.name }); return { success: true, id };
    }),
    createSdkConfiguration: protectedProcedure.input(z.object({ environment: z.enum(["sandbox", "production"]), name: z.string().trim().min(2).max(160), language: z.enum(["javascript", "typescript", "python", "java"]), packageName: z.string().trim().min(2).max(300) })).mutation(async ({ ctx, input }) => {
      const bank = await requireBankContext(ctx.user.id); requireOneOfRoles(bank.bankRole, ["bank_owner", "organization_admin", "bank_admin", "integration_manager"]);
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const result = await db.insert(administrationRecords).values({ bankId: bank.bankId, environment: input.environment, module: "sdk", title: input.name, detail: `Language: ${input.language}\nPackage: ${input.packageName}`, status: "ready", createdByUserId: ctx.user.id, updatedByUserId: ctx.user.id }); const id = Number(result[0].insertId);
      await writeBankAuditEvent({ bankId: bank.bankId, actorUserId: ctx.user.id, action: "Saved SDK configuration", module: "Developers", resourceType: "sdk", resourceId: String(id), detail: input.name }); return { success: true, id };
    }),
    saveSecurityControl: protectedProcedure.input(z.object({ environment: z.enum(["sandbox", "production"]), control: z.enum(["access_permission", "secret", "security_event"]), name: z.string().trim().min(2).max(160), owner: z.string().trim().min(2).max(160), reviewNote: z.string().trim().min(2).max(1000) })).mutation(async ({ ctx, input }) => {
      const bank = await requireBankContext(ctx.user.id); requireOneOfRoles(bank.bankRole, ["bank_owner", "organization_admin", "bank_admin", "compliance_officer"]);
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const result = await db.insert(administrationRecords).values({ bankId: bank.bankId, environment: input.environment, module: input.control, title: input.name, detail: `Owner: ${input.owner}\nReview note: ${input.reviewNote}\nSensitive values are not stored or displayed here.`, status: "review", createdByUserId: ctx.user.id, updatedByUserId: ctx.user.id }); const id = Number(result[0].insertId);
      await writeBankAuditEvent({ bankId: bank.bankId, actorUserId: ctx.user.id, action: "Saved security control", module: "Security", resourceType: input.control, resourceId: String(id), detail: input.name }); return { success: true, id };
    }),
    saveNotificationSetting: protectedProcedure.input(z.object({ environment: z.enum(["sandbox", "production"]), channel: z.enum(["email", "webhook", "in_app"]), event: z.string().trim().min(2).max(200), destination: z.string().trim().min(2).max(500) })).mutation(async ({ ctx, input }) => {
      const bank = await requireBankContext(ctx.user.id); requireOneOfRoles(bank.bankRole, ["bank_owner", "organization_admin", "bank_admin"]);
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const result = await db.insert(administrationRecords).values({ bankId: bank.bankId, environment: input.environment, module: "notification", title: `${input.channel} · ${input.event}`, detail: `Destination: ${input.destination}`, status: "active", createdByUserId: ctx.user.id, updatedByUserId: ctx.user.id }); const id = Number(result[0].insertId);
      await writeBankAuditEvent({ bankId: bank.bankId, actorUserId: ctx.user.id, action: "Saved notification setting", module: "Settings", resourceType: "notification", resourceId: String(id), detail: input.event }); return { success: true, id };
    }),
    saveSetting: protectedProcedure.input(z.object({ environment: z.enum(["sandbox", "production"]), category: z.enum(["general", "developer", "api", "environment"]), name: z.string().trim().min(2).max(160), value: z.string().trim().min(1).max(1000), rationale: z.string().trim().min(2).max(1000) })).mutation(async ({ ctx, input }) => {
      const bank = await requireBankContext(ctx.user.id); requireOneOfRoles(bank.bankRole, ["bank_owner", "organization_admin", "bank_admin", "integration_manager"]);
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const module = input.category === "general" ? "organization" : input.category === "developer" ? "developer_setting" : input.category === "api" ? "api_setting" : "environment";
      const result = await db.insert(administrationRecords).values({ bankId: bank.bankId, environment: input.environment, module, title: input.name, detail: `Value: ${input.value}\nRationale: ${input.rationale}`, status: "active", createdByUserId: ctx.user.id, updatedByUserId: ctx.user.id }); const id = Number(result[0].insertId);
      await writeBankAuditEvent({ bankId: bank.bankId, actorUserId: ctx.user.id, action: `Saved ${input.category} setting`, module: "Settings", resourceType: module, resourceId: String(id), detail: input.name }); return { success: true, id };
    }),
    saveGeneralSettings: protectedProcedure.input(z.object({ environment: z.enum(["sandbox", "production"]), organizationAlias: z.string().trim().min(2).max(160), supportEmail: z.string().email().max(320) })).mutation(async ({ ctx, input }) => {
      const bank = await requireBankContext(ctx.user.id); requireOneOfRoles(bank.bankRole, ["bank_owner", "organization_admin", "bank_admin"]); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const result = await db.insert(administrationRecords).values({ bankId: bank.bankId, environment: input.environment, module: "organization", title: `General profile · ${input.organizationAlias}`, detail: `Support contact: ${input.supportEmail}`, status: "active", createdByUserId: ctx.user.id, updatedByUserId: ctx.user.id }); const id = Number(result[0].insertId); await writeBankAuditEvent({ bankId: bank.bankId, actorUserId: ctx.user.id, action: "Saved general organization settings", module: "Settings", resourceType: "organization", resourceId: String(id), detail: input.organizationAlias }); return { success: true, id };
    }),
    saveDeveloperSettings: protectedProcedure.input(z.object({ environment: z.enum(["sandbox", "production"]), defaultSdk: z.enum(["typescript", "javascript", "python", "java"]), allowedOrigin: z.string().url().max(1000) })).mutation(async ({ ctx, input }) => {
      const bank = await requireBankContext(ctx.user.id); requireOneOfRoles(bank.bankRole, ["bank_owner", "organization_admin", "bank_admin", "integration_manager"]); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const result = await db.insert(administrationRecords).values({ bankId: bank.bankId, environment: input.environment, module: "developer_setting", title: `Developer defaults · ${input.defaultSdk}`, detail: `Allowed origin: ${input.allowedOrigin}`, status: "active", createdByUserId: ctx.user.id, updatedByUserId: ctx.user.id }); const id = Number(result[0].insertId); await writeBankAuditEvent({ bankId: bank.bankId, actorUserId: ctx.user.id, action: "Saved developer settings", module: "Settings", resourceType: "developer_setting", resourceId: String(id), detail: input.defaultSdk }); return { success: true, id };
    }),
    saveApiSettings: protectedProcedure.input(z.object({ environment: z.enum(["sandbox", "production"]), requestTimeoutSeconds: z.number().int().min(1).max(120), rateLimitPerMinute: z.number().int().min(1).max(100000) })).mutation(async ({ ctx, input }) => {
      const bank = await requireBankContext(ctx.user.id); requireOneOfRoles(bank.bankRole, ["bank_owner", "organization_admin", "bank_admin", "integration_manager"]); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const result = await db.insert(administrationRecords).values({ bankId: bank.bankId, environment: input.environment, module: "api_setting", title: "API operational limits", detail: `Request timeout: ${input.requestTimeoutSeconds}s\nRate limit: ${input.rateLimitPerMinute} requests/minute`, status: "active", createdByUserId: ctx.user.id, updatedByUserId: ctx.user.id }); const id = Number(result[0].insertId); await writeBankAuditEvent({ bankId: bank.bankId, actorUserId: ctx.user.id, action: "Saved API settings", module: "Settings", resourceType: "api_setting", resourceId: String(id), detail: `${input.requestTimeoutSeconds}s / ${input.rateLimitPerMinute} rpm` }); return { success: true, id };
    }),
    saveEnvironmentSettings: protectedProcedure.input(z.object({ environment: z.enum(["sandbox", "production"]), releaseWindow: z.string().trim().min(2).max(160), approvalRequired: z.boolean() })).mutation(async ({ ctx, input }) => {
      const bank = await requireBankContext(ctx.user.id); requireOneOfRoles(bank.bankRole, ["bank_owner", "organization_admin", "bank_admin"]); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const result = await db.insert(administrationRecords).values({ bankId: bank.bankId, environment: input.environment, module: "environment", title: `Environment release window · ${input.releaseWindow}`, detail: `Change approval required: ${input.approvalRequired ? "Yes" : "No"}`, status: "review", createdByUserId: ctx.user.id, updatedByUserId: ctx.user.id }); const id = Number(result[0].insertId); await writeBankAuditEvent({ bankId: bank.bankId, actorUserId: ctx.user.id, action: "Saved environment settings", module: "Settings", resourceType: "environment", resourceId: String(id), detail: input.releaseWindow }); return { success: true, id };
    }),
  }),

  channels: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const bank = await requireBankContext(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      return db.select().from(channelDeployments).where(eq(channelDeployments.bankId, bank.bankId));
    }),
    setEnabled: protectedProcedure.input(z.object({ id: z.number().int().positive(), enabled: z.boolean() })).mutation(async ({ ctx, input }) => {
      const bank = await requireBankContext(ctx.user.id);
      requireOneOfRoles(bank.bankRole, ["bank_owner", "bank_admin"]);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const channel = await db.select().from(channelDeployments).where(and(eq(channelDeployments.id, input.id), eq(channelDeployments.bankId, bank.bankId))).limit(1);
      if (!channel[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Channel not found in this bank environment." });
      await db.update(channelDeployments).set({ enabled: input.enabled, status: input.enabled ? "connected" : "disabled", updatedByUserId: ctx.user.id }).where(eq(channelDeployments.id, input.id));
      await writeBankAuditEvent({ bankId: bank.bankId, actorUserId: ctx.user.id, action: input.enabled ? "Enabled channel" : "Disabled channel", module: "Channels", resourceType: "channel", resourceId: String(input.id), detail: channel[0].channel });
      return { success: true };
    }),
  }),

  deployments: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const bank = await requireBankContext(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      return db.select().from(deploymentReleases).where(eq(deploymentReleases.bankId, bank.bankId)).orderBy(desc(deploymentReleases.createdAt));
    }),
    activateProduction: protectedProcedure.mutation(async ({ ctx }) => {
      const bank = await requireBankContext(ctx.user.id);
      requireOneOfRoles(bank.bankRole, ["bank_owner", "bank_admin"]);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.insert(deploymentReleases).values({ bankId: bank.bankId, environment: "production", status: "active", deployedByUserId: ctx.user.id, deployedAt: new Date() });
      await writeBankAuditEvent({ bankId: bank.bankId, actorUserId: ctx.user.id, action: "Activated production deployment", module: "Deploy FinCare", resourceType: "deployment_release", detail: "Production activation recorded." });
      return { success: true };
    }),
  }),

  testConsole: router({
    send: protectedProcedure.input(z.object({ prompt: z.string().trim().min(2).max(2000) })).mutation(async ({ ctx, input }) => {
      const bank = await requireBankContext(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const config = await db.select().from(agentConfigs).where(eq(agentConfigs.bankId, bank.bankId)).limit(1);
      const agent = config[0];
      if (!agent) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Create the bank agent configuration before testing." });
      const startedAt = Date.now();
      const response = await invokeLLM({
        model: "gpt-5-mini",
        maxTokens: 420,
        messages: [
          {
            role: "system",
            content: `You are ${agent.agentName}, the sandbox version of ${bank.bankName}'s FinCare customer-support assistant. Customer-facing tone: ${agent.customerTone}. Follow these non-negotiable policies: never request or accept a PIN, password, OTP, CVV, full card number, or security-answer; do not provide personalised investment advice; do not make unsupported product claims; do not claim a live account, balance, transaction, or account action was completed because this sandbox has no connected banking API. If a customer asks for account-specific information, explain that an approved authenticated lookup would be needed. If a customer asks for a human, explain the live-agent hand-off in one concise sentence. Give clear, short banking-support guidance only.`,
          },
          { role: "user", content: input.prompt },
        ],
      });
      const lower = input.prompt.toLowerCase();
      const intent = lower.includes("human") || lower.includes("agent") ? "Escalation Request" : lower.includes("balance") ? "Balance Inquiry" : lower.includes("loan") ? "Loan Information" : lower.includes("dispute") || lower.includes("removed") ? "Dispute Initiation" : "General FAQ";
      const source = lower.includes("loan") ? "Personal Loan Eligibility" : lower.includes("dispute") ? "Card Dispute Policy" : lower.includes("balance") ? "Approved account lookup required" : "Qorebank Knowledge Base";
      const generatedContent = response.choices[0]?.message?.content;
      const answer = typeof generatedContent === "string" && generatedContent.trim()
        ? generatedContent.trim()
        : "The sandbox response could not be generated. Please try again.";
      await writeBankAuditEvent({ bankId: bank.bankId, actorUserId: ctx.user.id, action: "Ran sandbox conversation test", module: "Test Console", resourceType: "sandbox_test", detail: intent });
      return {
        answer,
        diagnostics: {
          intent,
          confidence: "Sandbox estimate",
          knowledgeSource: source,
          apiCall: lower.includes("balance") ? "Not invoked — sandbox" : "Not required",
          responseTime: `${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
          safetyCheck: "Passed",
        },
      };
    }),
  }),

  conversations: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const bank = await requireBankContext(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      return db.select().from(conversations).where(eq(conversations.bankId, bank.bankId)).orderBy(desc(conversations.updatedAt));
    }),
  }),

  team: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const bank = await requireBankContext(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      return db.select({ id: bankMemberships.id, name: users.name, email: users.email, role: bankMemberships.role, status: bankMemberships.status, lastSignedIn: users.lastSignedIn }).from(bankMemberships).innerJoin(users, eq(bankMemberships.userId, users.id)).where(eq(bankMemberships.bankId, bank.bankId));
    }),
    changeRole: protectedProcedure.input(z.object({ membershipId: z.number().int().positive(), role: bankRoleSchema })).mutation(async ({ ctx, input }) => {
      const bank = await requireBankContext(ctx.user.id);
      requireOneOfRoles(bank.bankRole, ["bank_owner", "bank_admin"]);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const membership = await db.select().from(bankMemberships).where(and(eq(bankMemberships.id, input.membershipId), eq(bankMemberships.bankId, bank.bankId))).limit(1);
      if (!membership[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Membership not found in this bank environment." });
      await db.update(bankMemberships).set({ role: input.role }).where(eq(bankMemberships.id, input.membershipId));
      await writeBankAuditEvent({ bankId: bank.bankId, actorUserId: ctx.user.id, action: "Changed team role", module: "Team", resourceType: "membership", resourceId: String(input.membershipId), detail: input.role });
      return { success: true };
    }),
  }),

  administration: router({
    list: protectedProcedure.input(z.object({ module: administrationModuleSchema, environment: z.enum(["sandbox", "production"]).optional() })).query(async ({ ctx, input }) => {
      const bank = await requireBankContext(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      return db.select().from(administrationRecords).where(and(eq(administrationRecords.bankId, bank.bankId), eq(administrationRecords.module, input.module), eq(administrationRecords.environment, input.environment ?? "sandbox"))).orderBy(desc(administrationRecords.updatedAt));
    }),
    create: protectedProcedure.input(z.object({ module: administrationModuleSchema, environment: z.enum(["sandbox", "production"]).default("sandbox"), title: z.string().trim().min(2).max(255), detail: z.string().trim().max(5000).optional(), status: administrationStatusSchema.default("draft") })).mutation(async ({ ctx, input }) => {
      const bank = await requireBankContext(ctx.user.id);
      requireOneOfRoles(bank.bankRole, ["bank_owner", "organization_admin", "bank_admin", "ai_manager", "integration_manager", "support_manager"]);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const result = await db.insert(administrationRecords).values({ bankId: bank.bankId, environment: input.environment, module: input.module, title: input.title, detail: input.detail, status: input.status, createdByUserId: ctx.user.id, updatedByUserId: ctx.user.id });
      const recordId = Number(result[0].insertId);
      await writeBankAuditEvent({ bankId: bank.bankId, actorUserId: ctx.user.id, action: "Created administration record", module: input.module, resourceType: "administration_record", resourceId: String(recordId), detail: input.title });
      return { success: true, id: recordId };
    }),
    update: protectedProcedure.input(z.object({ id: z.number().int().positive(), environment: z.enum(["sandbox", "production"]).optional(), title: z.string().trim().min(2).max(255).optional(), detail: z.string().trim().max(5000).optional(), status: administrationStatusSchema.optional() })).mutation(async ({ ctx, input }) => {
      const bank = await requireBankContext(ctx.user.id);
      requireOneOfRoles(bank.bankRole, ["bank_owner", "organization_admin", "bank_admin", "ai_manager", "integration_manager", "support_manager"]);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const record = await db.select().from(administrationRecords).where(and(eq(administrationRecords.id, input.id), eq(administrationRecords.bankId, bank.bankId), eq(administrationRecords.environment, input.environment ?? "sandbox"))).limit(1);
      if (!record[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Administration record not found in this Qorebank environment." });
      const { id, environment, ...changes } = input;
      await db.update(administrationRecords).set({ ...changes, updatedByUserId: ctx.user.id }).where(eq(administrationRecords.id, id));
      await writeBankAuditEvent({ bankId: bank.bankId, actorUserId: ctx.user.id, action: "Updated administration record", module: record[0].module, resourceType: "administration_record", resourceId: String(id), detail: record[0].title });
      return { success: true };
    }),
  }),

  audits: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const bank = await requireBankContext(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      return db.select().from(auditEvents).where(eq(auditEvents.bankId, bank.bankId)).orderBy(desc(auditEvents.createdAt)).limit(200);
    }),
  }),
});
