import { z } from "zod";
import { createHash, randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/api/trpc";
import { guardWorkspace, log } from "@/server/api/guard";
import { assertPublicUrl } from "@/server/events/safe-url";
import { deliver, envelope } from "@/server/events";
import { WEBHOOK_EVENTS } from "@/config";

const EVENT_KEYS = WEBHOOK_EVENTS.map((e) => e.key) as string[];
const kindEnum = z.enum(["SLACK", "TEAMS", "GENERIC"]);

// ───── personal calendar feed ─────
const calendar = router({
  // The secret address of this person's feed (created the first time it is needed)
  get: protectedProcedure.query(async ({ ctx }) => {
    let token = ctx.user.calendarToken;
    if (!token) {
      token = randomBytes(24).toString("base64url");
      await ctx.db.user.update({ where: { id: ctx.user.id }, data: { calendarToken: token } });
    }
    return { token };
  }),
  // Makes the old address stop working
  regenerate: protectedProcedure.mutation(async ({ ctx }) => {
    const token = randomBytes(24).toString("base64url");
    await ctx.db.user.update({ where: { id: ctx.user.id }, data: { calendarToken: token } });
    return { token };
  }),
});

// ───── API keys ─────
const apiKeys = router({
  list: protectedProcedure.input(z.object({ workspaceSlug: z.string() })).query(async ({ ctx, input }) => {
    const { workspace } = await guardWorkspace(ctx, input.workspaceSlug, "integration:manage");
    return ctx.db.apiKey.findMany({
      where: { workspaceId: workspace.id },
      select: { id: true, name: true, prefix: true, scope: true, createdAt: true, lastUsedAt: true, revokedAt: true },
      orderBy: { createdAt: "desc" },
    });
  }),

  // The full key is returned ONCE here and can never be shown again
  create: protectedProcedure
    .input(z.object({ workspaceSlug: z.string(), name: z.string().min(2).max(60), scope: z.enum(["READ", "WRITE"]) }))
    .mutation(async ({ ctx, input }) => {
      const { workspace } = await guardWorkspace(ctx, input.workspaceSlug, "integration:manage");
      const key = `orbit_${randomBytes(24).toString("base64url")}`;
      const row = await ctx.db.apiKey.create({
        data: {
          workspaceId: workspace.id, name: input.name, scope: input.scope, createdById: ctx.user.id,
          prefix: key.slice(0, 12), keyHash: createHash("sha256").update(key).digest("hex"),
        },
        select: { id: true, name: true, prefix: true, scope: true },
      });
      await log(ctx, workspace.id, "apikey.created", "ApiKey", row.id, { scope: input.scope });
      return { ...row, key };
    }),

  revoke: protectedProcedure
    .input(z.object({ workspaceSlug: z.string(), keyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { workspace } = await guardWorkspace(ctx, input.workspaceSlug, "integration:manage");
      await ctx.db.apiKey.updateMany({ where: { id: input.keyId, workspaceId: workspace.id, revokedAt: null }, data: { revokedAt: new Date() } });
      await log(ctx, workspace.id, "apikey.revoked", "ApiKey", input.keyId);
      return { ok: true };
    }),
});

// ───── Slack, Teams and web-address alerts ─────
const maskUrl = (raw: string) => {
  try { const u = new URL(raw); return `${u.protocol}//${u.host}/…${raw.slice(-4)}`; } catch { return "…"; }
};

const webhooks = router({
  list: protectedProcedure.input(z.object({ workspaceSlug: z.string() })).query(async ({ ctx, input }) => {
    const { workspace } = await guardWorkspace(ctx, input.workspaceSlug, "integration:manage");
    const rows = await ctx.db.webhook.findMany({
      where: { workspaceId: workspace.id },
      include: { deliveries: { orderBy: { createdAt: "desc" }, take: 5 } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(({ url, secret, ...h }) => ({ ...h, url: maskUrl(url), secret: h.kind === "GENERIC" ? secret : null }));
  }),

  create: protectedProcedure
    .input(z.object({
      workspaceSlug: z.string(), name: z.string().min(2).max(60), kind: kindEnum,
      url: z.string().min(8).max(2000), events: z.array(z.string()).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const { workspace } = await guardWorkspace(ctx, input.workspaceSlug, "integration:manage");
      try { assertPublicUrl(input.url); } catch (e) {
        throw new TRPCError({ code: "BAD_REQUEST", message: e instanceof Error ? e.message : "Invalid address" });
      }
      const events = input.events.filter((e) => EVENT_KEYS.includes(e));
      if (events.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose at least one event." });
      const hook = await ctx.db.webhook.create({
        data: {
          workspaceId: workspace.id, name: input.name, kind: input.kind, url: input.url.trim(), events,
          secret: randomBytes(24).toString("hex"), createdById: ctx.user.id,
        },
        select: { id: true },
      });
      await log(ctx, workspace.id, "webhook.created", "Webhook", hook.id, { kind: input.kind });
      return hook;
    }),

  update: protectedProcedure
    .input(z.object({
      workspaceSlug: z.string(), webhookId: z.string(),
      active: z.boolean().optional(), name: z.string().min(2).max(60).optional(), events: z.array(z.string()).min(1).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { workspace } = await guardWorkspace(ctx, input.workspaceSlug, "integration:manage");
      const { workspaceSlug: _s, webhookId, events, ...rest } = input;
      await ctx.db.webhook.updateMany({
        where: { id: webhookId, workspaceId: workspace.id },
        data: { ...rest, ...(events ? { events: events.filter((e) => EVENT_KEYS.includes(e)) } : {}) },
      });
      return { ok: true };
    }),

  delete: protectedProcedure
    .input(z.object({ workspaceSlug: z.string(), webhookId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { workspace } = await guardWorkspace(ctx, input.workspaceSlug, "integration:manage");
      await ctx.db.webhook.deleteMany({ where: { id: input.webhookId, workspaceId: workspace.id } });
      await log(ctx, workspace.id, "webhook.deleted", "Webhook", input.webhookId);
      return { ok: true };
    }),

  // Sends a test message so you can see it arrive
  test: protectedProcedure
    .input(z.object({ workspaceSlug: z.string(), webhookId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { workspace } = await guardWorkspace(ctx, input.workspaceSlug, "integration:manage");
      const hook = await ctx.db.webhook.findFirst({ where: { id: input.webhookId, workspaceId: workspace.id } });
      if (!hook) throw new TRPCError({ code: "NOT_FOUND" });
      const env = await envelope(ctx.db, workspace.id, "webhook.test", { by: ctx.user.name ?? ctx.user.email });
      if (!env) throw new TRPCError({ code: "NOT_FOUND" });
      return deliver(ctx.db, hook, env);
    }),

  deliveries: protectedProcedure
    .input(z.object({ workspaceSlug: z.string(), webhookId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { workspace } = await guardWorkspace(ctx, input.workspaceSlug, "integration:manage");
      return ctx.db.webhookDelivery.findMany({
        where: { webhookId: input.webhookId, webhook: { workspaceId: workspace.id } },
        orderBy: { createdAt: "desc" }, take: 20,
      });
    }),
});

export const integrationRouter = router({ calendar, apiKeys, webhooks });
