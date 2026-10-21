import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/api/trpc";
import { guardProject, log } from "@/server/api/guard";

const riskStatus = z.enum(["OPEN", "MITIGATING", "CLOSED", "OCCURRED"]);
const issueStatus = z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]);
const severity = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
const score = z.number().int().min(1).max(5);

export const riskRouter = router({
  list: protectedProcedure.input(z.object({ projectId: z.string() })).query(async ({ ctx, input }) => {
    await guardProject(ctx, input.projectId, "workspace:read", "risks");
    const risks = await ctx.db.risk.findMany({ where: { projectId: input.projectId } });
    // Highest score (probability x impact) first
    return risks
      .map((r) => ({ ...r, score: r.probability * r.impact }))
      .sort((a, b) => b.score - a.score);
  }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      title: z.string().min(2).max(200),
      description: z.string().max(2000).optional(),
      probability: score.default(3),
      impact: score.default(3),
      response: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { workspace } = await guardProject(ctx, input.projectId, "risk:manage", "risks");
      const risk = await ctx.db.risk.create({ data: { ...input, ownerId: ctx.user.id } });
      await log(ctx, workspace.id, "risk.created", "Risk", risk.id);
      return risk;
    }),

  update: protectedProcedure
    .input(z.object({
      riskId: z.string(),
      title: z.string().min(2).max(200).optional(),
      description: z.string().max(2000).nullish(),
      probability: score.optional(),
      impact: score.optional(),
      status: riskStatus.optional(),
      response: z.string().max(2000).nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      const risk = await ctx.db.risk.findUnique({ where: { id: input.riskId } });
      if (!risk) throw new TRPCError({ code: "NOT_FOUND" });
      const { workspace } = await guardProject(ctx, risk.projectId, "risk:manage", "risks");
      const { riskId: _id, ...data } = input;
      const updated = await ctx.db.risk.update({ where: { id: risk.id }, data });
      await log(ctx, workspace.id, "risk.updated", "Risk", risk.id);
      return updated;
    }),

  delete: protectedProcedure.input(z.object({ riskId: z.string() })).mutation(async ({ ctx, input }) => {
    const risk = await ctx.db.risk.findUnique({ where: { id: input.riskId } });
    if (!risk) throw new TRPCError({ code: "NOT_FOUND" });
    await guardProject(ctx, risk.projectId, "risk:manage", "risks");
    await ctx.db.risk.delete({ where: { id: risk.id } });
    return { ok: true };
  }),
});

export const issueRouter = router({
  list: protectedProcedure.input(z.object({ projectId: z.string() })).query(async ({ ctx, input }) => {
    await guardProject(ctx, input.projectId, "workspace:read", "risks");
    return ctx.db.issue.findMany({ where: { projectId: input.projectId }, orderBy: { createdAt: "desc" } });
  }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      title: z.string().min(2).max(200),
      description: z.string().max(2000).optional(),
      severity: severity.default("MEDIUM"),
      assigneeId: z.string().nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { workspace } = await guardProject(ctx, input.projectId, "risk:manage", "risks");
      const issue = await ctx.db.issue.create({ data: input });
      await log(ctx, workspace.id, "issue.created", "Issue", issue.id);
      return issue;
    }),

  update: protectedProcedure
    .input(z.object({
      issueId: z.string(),
      title: z.string().min(2).max(200).optional(),
      description: z.string().max(2000).nullish(),
      severity: severity.optional(),
      status: issueStatus.optional(),
      assigneeId: z.string().nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      const issue = await ctx.db.issue.findUnique({ where: { id: input.issueId } });
      if (!issue) throw new TRPCError({ code: "NOT_FOUND" });
      const { workspace } = await guardProject(ctx, issue.projectId, "risk:manage", "risks");
      const { issueId: _id, status, ...rest } = input;
      const updated = await ctx.db.issue.update({
        where: { id: issue.id },
        data: {
          ...rest,
          ...(status
            ? { status, resolvedAt: status === "RESOLVED" || status === "CLOSED" ? new Date() : null }
            : {}),
        },
      });
      await log(ctx, workspace.id, "issue.updated", "Issue", issue.id);
      return updated;
    }),

  delete: protectedProcedure.input(z.object({ issueId: z.string() })).mutation(async ({ ctx, input }) => {
    const issue = await ctx.db.issue.findUnique({ where: { id: input.issueId } });
    if (!issue) throw new TRPCError({ code: "NOT_FOUND" });
    await guardProject(ctx, issue.projectId, "risk:manage", "risks");
    await ctx.db.issue.delete({ where: { id: issue.id } });
    return { ok: true };
  }),
});
