import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/api/trpc";
import { guardProject, log } from "@/server/api/guard";
import { indicatorProgress } from "./service";

const frequency = z.enum(["MONTHLY", "QUARTERLY", "BIANNUAL", "ANNUAL", "ONE_OFF"]);

async function loadIndicator(db: import("@orbit/db").PrismaClient, id: string) {
  const ind = await db.indicator.findUnique({ where: { id } });
  if (!ind) throw new TRPCError({ code: "NOT_FOUND", message: "Indicator not found" });
  return ind;
}

export const indicatorRouter = router({
  // Each indicator with its latest value and progress toward target
  list: protectedProcedure.input(z.object({ projectId: z.string() })).query(async ({ ctx, input }) => {
    await guardProject(ctx, input.projectId, "workspace:read", "ngo");
    return indicatorProgress(ctx.db, input.projectId);
  }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      logframeItemId: z.string().nullish(),
      name: z.string().min(2).max(300),
      unit: z.string().min(1).max(40).default("number"),
      baseline: z.number().default(0),
      target: z.number(),
      frequency: frequency.default("QUARTERLY"),
      dataSource: z.string().max(300).optional(),
      disaggregateBy: z.array(z.string()).default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      const { workspace } = await guardProject(ctx, input.projectId, "ngo:manage", "ngo");
      if (input.logframeItemId) {
        const item = await ctx.db.logframeItem.findFirst({
          where: { id: input.logframeItemId, projectId: input.projectId },
        });
        if (!item) throw new TRPCError({ code: "BAD_REQUEST", message: "Logframe item not in this project" });
      }
      const ind = await ctx.db.indicator.create({ data: input });
      await log(ctx, workspace.id, "indicator.created", "Indicator", ind.id);
      return ind;
    }),

  update: protectedProcedure
    .input(z.object({
      indicatorId: z.string(),
      name: z.string().min(2).max(300).optional(),
      unit: z.string().min(1).max(40).optional(),
      baseline: z.number().optional(),
      target: z.number().optional(),
      frequency: frequency.optional(),
      dataSource: z.string().max(300).nullish(),
      disaggregateBy: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const ind = await loadIndicator(ctx.db, input.indicatorId);
      const { workspace } = await guardProject(ctx, ind.projectId, "ngo:manage", "ngo");
      const { indicatorId: _id, ...data } = input;
      const updated = await ctx.db.indicator.update({ where: { id: ind.id }, data });
      await log(ctx, workspace.id, "indicator.updated", "Indicator", ind.id);
      return updated;
    }),

  delete: protectedProcedure.input(z.object({ indicatorId: z.string() })).mutation(async ({ ctx, input }) => {
    const ind = await loadIndicator(ctx.db, input.indicatorId);
    const { workspace } = await guardProject(ctx, ind.projectId, "ngo:manage", "ngo");
    await ctx.db.indicator.delete({ where: { id: ind.id } });
    await log(ctx, workspace.id, "indicator.deleted", "Indicator", ind.id);
    return { ok: true };
  }),

  // ───── results data ─────
  values: protectedProcedure.input(z.object({ indicatorId: z.string() })).query(async ({ ctx, input }) => {
    const ind = await loadIndicator(ctx.db, input.indicatorId);
    await guardProject(ctx, ind.projectId, "workspace:read", "ngo");
    return ctx.db.indicatorValue.findMany({
      where: { indicatorId: ind.id },
      orderBy: { periodStart: "desc" },
    });
  }),

  addValue: protectedProcedure
    .input(z.object({
      indicatorId: z.string(),
      period: z.string().min(2).max(30), // e.g. "2026-Q1"
      periodStart: z.date(),
      value: z.number(),
      disaggregation: z.record(z.number()).optional(),
      note: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const ind = await loadIndicator(ctx.db, input.indicatorId);
      const { workspace } = await guardProject(ctx, ind.projectId, "ngo:data", "ngo");
      const v = await ctx.db.indicatorValue.create({ data: { ...input, recordedById: ctx.user.id } });
      await log(ctx, workspace.id, "indicator.value_added", "IndicatorValue", v.id, {
        indicator: ind.name,
        value: input.value,
      });
      return v;
    }),

  deleteValue: protectedProcedure.input(z.object({ valueId: z.string() })).mutation(async ({ ctx, input }) => {
    const v = await ctx.db.indicatorValue.findUnique({
      where: { id: input.valueId },
      include: { indicator: true },
    });
    if (!v) throw new TRPCError({ code: "NOT_FOUND" });
    await guardProject(ctx, v.indicator.projectId, "ngo:manage", "ngo");
    await ctx.db.indicatorValue.delete({ where: { id: v.id } });
    return { ok: true };
  }),
});
