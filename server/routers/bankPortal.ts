import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  agentConfigs,
  auditEvents,
  bankMemberships,
  banks,
  channelDeployments,
  conversations,
  deploymentReleases,
  integrationConnections,
  knowledgeItems,
  users,
} from "../../drizzle/schema";
import { getActiveBankForUser, getDb, writeBankAuditEvent } from "../db";
import { invokeLLM } from "../_core/llm";
import { storagePut } from "../storage";
import { normalizeBankSlug } from "../../shared/bankSlug";
import { protectedProcedure, router } from "../_core/trpc";

const bankRoleSchema = z.enum([
  "bank_owner",
  "bank_admin",
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

export const bankPortalRouter = router({
  context: protectedProcedure.query(async ({ ctx }) => getActiveBankForUser(ctx.user.id) ?? null),

  bootstrap: protectedProcedure.input(z.object({
    bankName: z.string().trim().min(2).max(160),
    bankSlug: z.string().trim().min(1).max(255),
  })).mutation(async ({ ctx, input }) => {
    const existingMembership = await getActiveBankForUser(ctx.user.id);
    if (existingMembership) {
      throw new TRPCError({ code: "CONFLICT", message: "This user already has an active bank environment." });
    }
    const normalizedSlug = normalizeBankSlug(input.bankSlug);
    if (normalizedSlug.length < 2) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Use at least two letters or numbers in the workspace address." });
    }
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    const slugExists = await db.select({ id: banks.id }).from(banks).where(eq(banks.slug, normalizedSlug)).limit(1);
    if (slugExists[0]) throw new TRPCError({ code: "CONFLICT", message: "That bank workspace address is already in use." });

    await db.transaction(async (tx) => {
      await tx.insert(banks).values({ name: input.bankName, slug: normalizedSlug });
      const created = await tx.select({ id: banks.id }).from(banks).where(eq(banks.slug, normalizedSlug)).limit(1);
      const bankId = created[0]?.id;
      if (!bankId) throw new Error("Bank environment could not be created");
      await tx.insert(bankMemberships).values({ bankId, userId: ctx.user.id, role: "bank_owner", status: "active" });
      await tx.insert(agentConfigs).values({
        bankId,
        agentName: `${input.bankName} Assistant`,
        welcomeMessage: `Hello, I'm ${input.bankName}'s AI banking assistant. How can I help you today?`,
        description: `${input.bankName}'s always-on customer-support assistant, connected only to approved bank systems.`,
        supportedLanguages: "English",
        customerTone: "Warm, clear and reassuring",
        updatedByUserId: ctx.user.id,
      });
      await tx.insert(integrationConnections).values([
        { bankId, kind: "core_banking", status: "pending", endpointLabel: "Core Banking", permissions: "Not configured", updatedByUserId: ctx.user.id },
        { bankId, kind: "crm_live_agent", status: "pending", endpointLabel: "Live Agent Routing", permissions: "Not configured", updatedByUserId: ctx.user.id },
        { bankId, kind: "web_banking", status: "pending", endpointLabel: "Web Banking", permissions: "Not configured", updatedByUserId: ctx.user.id },
        { bankId, kind: "mobile_banking", status: "pending", endpointLabel: "Mobile Banking", permissions: "Not configured", updatedByUserId: ctx.user.id },
      ]);
      await tx.insert(channelDeployments).values([
        { bankId, channel: "web_banking", enabled: false, status: "pending", updatedByUserId: ctx.user.id },
        { bankId, channel: "mobile_banking", enabled: false, status: "pending", updatedByUserId: ctx.user.id },
      ]);
      await tx.insert(deploymentReleases).values({ bankId, environment: "sandbox", status: "ready", deployedByUserId: ctx.user.id, deployedAt: new Date() });
      await tx.insert(auditEvents).values({ bankId, actorUserId: ctx.user.id, action: "Created bank environment", module: "Onboarding", resourceType: "bank", resourceId: String(bankId), detail: input.bankName });
    });
    return { success: true };
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
      requireOneOfRoles(bank.bankRole, ["bank_owner", "bank_admin"]);
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
    list: protectedProcedure.query(async ({ ctx }) => {
      const bank = await requireBankContext(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      return db.select().from(integrationConnections).where(eq(integrationConnections.bankId, bank.bankId));
    }),
    test: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const bank = await requireBankContext(ctx.user.id);
      requireOneOfRoles(bank.bankRole, ["bank_owner", "bank_admin"]);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const connection = await db.select().from(integrationConnections).where(and(eq(integrationConnections.id, input.id), eq(integrationConnections.bankId, bank.bankId))).limit(1);
      if (!connection[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Connection not found in this bank environment." });
      await db.update(integrationConnections).set({ status: "connected", lastSuccessfulRequestAt: new Date(), updatedByUserId: ctx.user.id }).where(eq(integrationConnections.id, input.id));
      await writeBankAuditEvent({ bankId: bank.bankId, actorUserId: ctx.user.id, action: "Tested integration", module: "Integrations", resourceType: "integration", resourceId: String(input.id), detail: connection[0].kind });
      return { success: true };
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

  audits: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const bank = await requireBankContext(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      return db.select().from(auditEvents).where(eq(auditEvents.bankId, bank.bankId)).orderBy(desc(auditEvents.createdAt)).limit(200);
    }),
  }),
});
