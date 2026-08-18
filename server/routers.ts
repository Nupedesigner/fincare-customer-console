import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { bankPortalRouter } from "./routers/bankPortal";
import { provisionQorebankDemoPortalUser, recordUserSignInActivity } from "./db";
import { getSignInActivityDetails } from "./profileSecurity";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    startDemoSession: publicProcedure.input(z.object({ remember: z.boolean().default(true) })).mutation(async ({ ctx, input }) => {
      if (ENV.isProduction) {
        throw new Error("Non-production demo access is disabled in production. Use your Qorebank-managed production identity service.");
      }
      const user = await provisionQorebankDemoPortalUser();
      const maxAge = input.remember ? 7 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000;
      const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name ?? "FinCare Demo Administrator", expiresInMs: maxAge });
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(ctx.req), maxAge });
      await recordUserSignInActivity({
        userId: user.id,
        ...getSignInActivityDetails(ctx.req, "FinCare demo access", "managed_session"),
      });
      return { success: true } as const;
    }),
  }),
  bankPortal: bankPortalRouter,
});

export type AppRouter = typeof appRouter;
