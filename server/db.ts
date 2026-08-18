import { and, asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { auditEvents, bankMemberships, banks, InsertUser, userProfilePreferences, userSignInActivities, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getProfilePreferences(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(userProfilePreferences).where(eq(userProfilePreferences.userId, userId)).limit(1);
  return result[0];
}

export async function saveProfilePreferences(input: {
  userId: number;
  emailDigest: boolean;
  securityAlerts: boolean;
  productUpdates: boolean;
  defaultWorkspace: "overview" | "conversations" | "analytics";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.insert(userProfilePreferences).values(input).onDuplicateKeyUpdate({
    set: {
      emailDigest: input.emailDigest,
      securityAlerts: input.securityAlerts,
      productUpdates: input.productUpdates,
      defaultWorkspace: input.defaultWorkspace,
    },
  });
}

export async function recordUserSignInActivity(input: {
  userId: number;
  signInProvider: string;
  deviceLabel: string;
  browser: string;
  operatingSystem: string;
  source: "oauth" | "managed_session";
}) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot record sign-in activity: database not available");
    return;
  }
  await db.insert(userSignInActivities).values(input);
}

export async function getUserSignInActivities(userId: number, limit = 12) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userSignInActivities).where(eq(userSignInActivities.userId, userId)).orderBy(desc(userSignInActivities.createdAt)).limit(limit);
}

export async function provisionQorebankDemoPortalUser() {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");

  const bankEnvironment = await db.select().from(banks).orderBy(asc(banks.id)).limit(1);
  if (!bankEnvironment[0]) throw new Error("No administrator-provisioned non-production bank environment is available.");

  const openId = "fincare_demo_qorebank_admin";
  await upsertUser({
    openId,
    name: "FinCare Demo Administrator",
    email: "demo-admin@fincare.example",
    loginMethod: "FinCare demo access",
    role: "admin",
  });
  const user = await getUserByOpenId(openId);
  if (!user) throw new Error("Unable to prepare the Qorebank demo session.");

  const membership = await db.select({ id: bankMemberships.id }).from(bankMemberships).where(and(eq(bankMemberships.bankId, bankEnvironment[0].id), eq(bankMemberships.userId, user.id))).limit(1);
  if (!membership[0]) {
    await db.insert(bankMemberships).values({ bankId: bankEnvironment[0].id, userId: user.id, role: "bank_admin", status: "active" });
  }
  return user;
}

export async function getActiveBankForUser(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select({
      bankId: banks.id,
      bankName: banks.name,
      bankSlug: banks.slug,
      membershipId: bankMemberships.id,
      bankRole: bankMemberships.role,
    })
    .from(bankMemberships)
    .innerJoin(banks, eq(bankMemberships.bankId, banks.id))
    .where(and(eq(bankMemberships.userId, userId), eq(bankMemberships.status, "active")))
    .limit(1);

  return result[0];
}

export async function writeBankAuditEvent(input: {
  bankId: number;
  actorUserId: number;
  action: string;
  module: string;
  resourceType: string;
  resourceId?: string;
  detail?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");

  await db.insert(auditEvents).values({
    bankId: input.bankId,
    actorUserId: input.actorUserId,
    action: input.action,
    module: input.module,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    detail: input.detail,
  });
}
