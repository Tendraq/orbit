import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/api/trpc";
import { guardProject, log } from "@/server/api/guard";

export const milestoneRouter = router({
  list: protectedProcedure.input(z.object({ projectId: z.string() })).query(async ({ ctx, input }) => {
    await guardProject(ctx, input.projectId, "workspace:read");
    return ctx.db.milestone.findMany({ where: { projectId: input.projectId }, orderBy: { dueDate: "asc" } });
  }),

  create: protectedProcedure
    .input(z.object({ projectId: z.string(), name: z.string().min(1).max(120), dueDate: z.date() }))
    .mutation(async ({ ctx, input }) => {
      const { workspace } = await guardProject(ctx, input.projectId, "project:update");
      const m = await ctx.db.milestone.create({ data: input });
      await log(ctx, workspace.id, "milestone.created", "Milestone", m.id);
      return m;
    }),

  toggleDone: protectedProcedure
    .input(z.object({ milestoneId: z.string(), done: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const m = await ctx.db.milestone.findUnique({ where: { id: input.milestoneId } });
      if (!m) throw new TRPCError({ code: "NOT_FOUND" });
      await guardProject(ctx, m.projectId, "project:update");
      return ctx.db.milestone.update({
        where: { id: m.id },
        data: { doneAt: input.done ? new Date() : null },
      });
    }),

  delete: protectedProcedure.input(z.object({ milestoneId: z.string() })).mutation(async ({ ctx, input }) => {
    const m = await ctx.db.milestone.findUnique({ where: { id: input.milestoneId } });
    if (!m) throw new TRPCError({ code: "NOT_FOUND" });
    await guardProject(ctx, m.projectId, "project:update");
    await ctx.db.milestone.delete({ where: { id: m.id } });
    return { ok: true };
  }),
});
