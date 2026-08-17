import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const banks = mysqlTable("banks", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const bankMemberships = mysqlTable("bank_memberships", {
  id: int("id").autoincrement().primaryKey(),
  bankId: int("bankId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["bank_owner", "organization_admin", "bank_admin", "ai_manager", "integration_manager", "support_manager", "support_agent", "analyst", "compliance_officer"]).notNull(),
  status: mysqlEnum("status", ["active", "disabled", "invited"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const agentConfigs = mysqlTable("agent_configs", {
  id: int("id").autoincrement().primaryKey(),
  bankId: int("bankId").notNull().unique(),
  agentName: varchar("agentName", { length: 120 }).notNull(),
  welcomeMessage: text("welcomeMessage").notNull(),
  description: text("description").notNull(),
  supportedLanguages: text("supportedLanguages").notNull(),
  customerTone: varchar("customerTone", { length: 120 }).notNull(),
  updatedByUserId: int("updatedByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const knowledgeItems = mysqlTable("knowledge_items", {
  id: int("id").autoincrement().primaryKey(),
  bankId: int("bankId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  category: mysqlEnum("category", ["loans", "savings", "fixed_deposits", "cards", "forex", "investments", "general_banking", "faqs"]).notNull(),
  sourceType: mysqlEnum("sourceType", ["document", "article", "url"]).notNull(),
  version: varchar("version", { length: 32 }).notNull(),
  indexingStatus: mysqlEnum("indexingStatus", ["pending", "indexing", "indexed", "failed", "archived"]).default("pending").notNull(),
  sourceUrl: varchar("sourceUrl", { length: 2048 }),
  storageKey: varchar("storageKey", { length: 512 }),
  createdByUserId: int("createdByUserId").notNull(),
  updatedByUserId: int("updatedByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const integrationConnections = mysqlTable("integration_connections", {
  id: int("id").autoincrement().primaryKey(),
  bankId: int("bankId").notNull(),
  kind: mysqlEnum("kind", ["core_banking", "crm_live_agent", "web_banking", "mobile_banking"]).notNull(),
  status: mysqlEnum("status", ["pending", "testing", "connected", "error", "disabled"]).default("pending").notNull(),
  endpointLabel: varchar("endpointLabel", { length: 255 }).notNull(),
  permissions: text("permissions").notNull(),
  lastSuccessfulRequestAt: timestamp("lastSuccessfulRequestAt"),
  updatedByUserId: int("updatedByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const channelDeployments = mysqlTable("channel_deployments", {
  id: int("id").autoincrement().primaryKey(),
  bankId: int("bankId").notNull(),
  channel: mysqlEnum("channel", ["web_banking", "mobile_banking"]).notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  status: mysqlEnum("status", ["pending", "connected", "disabled", "error"]).default("pending").notNull(),
  updatedByUserId: int("updatedByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const deploymentReleases = mysqlTable("deployment_releases", {
  id: int("id").autoincrement().primaryKey(),
  bankId: int("bankId").notNull(),
  environment: mysqlEnum("environment", ["sandbox", "testing", "production"]).notNull(),
  status: mysqlEnum("status", ["draft", "ready", "active", "superseded", "failed"]).default("draft").notNull(),
  deployedByUserId: int("deployedByUserId"),
  deployedAt: timestamp("deployedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  bankId: int("bankId").notNull(),
  externalReference: varchar("externalReference", { length: 128 }).notNull(),
  customerReference: varchar("customerReference", { length: 128 }).notNull(),
  channel: mysqlEnum("channel", ["web", "mobile", "whatsapp"]).notNull(),
  intent: varchar("intent", { length: 160 }).notNull(),
  resolutionStatus: mysqlEnum("resolutionStatus", ["active", "resolved", "escalated", "fallback", "closed"]).default("active").notNull(),
  escalated: boolean("escalated").default(false).notNull(),
  assignedUserId: int("assignedUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const auditEvents = mysqlTable("audit_events", {
  id: int("id").autoincrement().primaryKey(),
  bankId: int("bankId").notNull(),
  actorUserId: int("actorUserId").notNull(),
  action: varchar("action", { length: 180 }).notNull(),
  module: varchar("module", { length: 120 }).notNull(),
  resourceType: varchar("resourceType", { length: 120 }).notNull(),
  resourceId: varchar("resourceId", { length: 128 }),
  detail: text("detail"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
