import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { emit } from "@/server/events";
import { router, protectedProcedure } from "@/server/api/trpc";
import { guardProject, log } from "@/server/api/guard";
import { notifyMany, approverIds } from "@/server/notify";
import { budgetSummary } from "./service";

export const budgetRouter = router({
  summary: protectedProcedure.input(z.object({ projectId: z.string() })).query(async ({ ctx, input }) => {
    const { project } = await guardProject(ctx, input.projectId, "workspace:read", "budget");
    return { currency: project.currency, ...(await budgetSummary(ctx.db, input.projectId)) };
  }),

  // ───── budget lines ─────
  createLine: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      category: z.string().min(1).max(80),
      description: z.string().max(500).optional(),
      planned: z.number().min(0),
      grantId: z.string().nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { workspace } = await guardProject(ctx, input.projectId, "budget:manage", "budget");
      const line = await ctx.db.budgetLine.create({ data: input });
      await log(ctx, workspace.id, "budget.line_created", "BudgetLine", line.id);
      return line;
    }),

  updateLine: protectedProcedure
    .input(z.object({
      lineId: z.string(),
      category: z.string().min(1).max(80).optional(),
      description: z.string().max(500).nullish(),
      planned: z.number().min(0).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const line = await ctx.db.budgetLine.findUnique({ where: { id: input.lineId } });
      if (!line) throw new TRPCError({ code: "NOT_FOUND" });
      const { workspace } = await guardProject(ctx, line.projectId, "budget:manage", "budget");
      const { lineId: _id, ...data } = input;
      const updated = await ctx.db.budgetLine.update({ where: { id: line.id }, data });
      await log(ctx, workspace.id, "budget.line_updated", "BudgetLine", line.id);
      return updated;
    }),

  deleteLine: protectedProcedure.input(z.object({ lineId: z.string() })).mutation(async ({ ctx, input }) => {
    const line = await ctx.db.budgetLine.findUnique({ where: { id: input.lineId } });
    if (!line) throw new TRPCError({ code: "NOT_FOUND" });
    const { workspace } = await guardProject(ctx, line.projectId, "budget:manage", "budget");
    await ctx.db.budgetLine.delete({ where: { id: line.id } });
    await log(ctx, workspace.id, "budget.line_deleted", "BudgetLine", line.id);
    return { ok: true };
  }),

  // ───── expenses ─────
  expenses: protectedProcedure.input(z.object({ projectId: z.string() })).query(async ({ ctx, input }) => {
    await guardProject(ctx, input.projectId, "workspace:read", "budget");
    return ctx.db.expense.findMany({
      where: { projectId: input.projectId },
      include: { budgetLine: { select: { category: true } } },
      orderBy: { date: "desc" },
      take: 300,
    });
  }),

  createExpense: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      budgetLineId: z.string().nullish(),
      amount: z.number().positive(),
      date: z.date().default(() => new Date()),
      description: z.string().min(1).max(300),
    }))
    .mutation(async ({ ctx, input }) => {
      const { project, workspace } = await guardProject(ctx, input.projectId, "expense:create", "budget");
      if (input.budgetLineId) {
        const line = await ctx.db.budgetLine.findFirst({
          where: { id: input.budgetLineId, projectId: project.id },
        });
        if (!line) throw new TRPCError({ code: "BAD_REQUEST", message: "Budget line not in this project" });
      }
      const expense = await ctx.db.expense.create({ data: { ...input, createdById: ctx.user.id } });
      await log(ctx, workspace.id, "expense.created", "Expense", expense.id, { amount: input.amount });
      await emit(ctx.db, workspace.id, "expense.created", { title: input.description, project: project.name, amount: input.amount, currency: project.currency, by: ctx.user.name ?? ctx.user.email, path: `/${workspace.slug}/projects/${project.id}/budget` });
      await notifyMany(ctx.db, (await approverIds(ctx.db, workspace.id)).filter((id) => id !== ctx.user.id), {
        workspaceId: workspace.id,
        type: "expense",
        title: `Expense to approve: ${input.description}`,
        body: `${project.name} · ${input.amount} ${project.currency}`,
        link: `/${workspace.slug}/projects/${project.id}/budget`,
      });
      return expense;
    }),

  decideExpense: protectedProcedure
    .input(z.object({ expenseId: z.string(), approve: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const exp = await ctx.db.expense.findUnique({ where: { id: input.expenseId } });
      if (!exp) throw new TRPCError({ code: "NOT_FOUND" });
      const { project, workspace } = await guardProject(ctx, exp.projectId, "expense:approve", "budget");
      const updated = await ctx.db.expense.update({
        where: { id: exp.id },
        data: { status: input.approve ? "APPROVED" : "REJECTED", decidedById: ctx.user.id },
      });
      await log(ctx, workspace.id, input.approve ? "expense.approved" : "expense.rejected", "Expense", exp.id);
      await emit(ctx.db, workspace.id, input.approve ? "expense.approved" : "expense.rejected", { title: exp.description, project: project.name, amount: exp.amount, currency: project.currency, by: ctx.user.name ?? ctx.user.email, path: `/${workspace.slug}/projects/${project.id}/budget` });
      return updated;
    }),

  deleteExpense: protectedProcedure.input(z.object({ expenseId: z.string() })).mutation(async ({ ctx, input }) => {
    const exp = await ctx.db.expense.findUnique({ where: { id: input.expenseId } });
    if (!exp) throw new TRPCError({ code: "NOT_FOUND" });
    const { role } = await guardProject(ctx, exp.projectId, "expense:create", "budget");
    const mine = exp.createdById === ctx.user.id && exp.status === "PENDING";
    if (!mine && role !== "OWNER" && role !== "ADMIN") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only your own pending expenses can be deleted" });
    }
    await ctx.db.expense.delete({ where: { id: exp.id } });
    return { ok: true };
  }),
});
