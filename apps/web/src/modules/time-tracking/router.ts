import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/api/trpc";
import { guardProject, guardTask } from "@/server/api/guard";

export const timeRouter = router({
  log: protectedProcedure
    .input(z.object({
      taskId: z.string(),
      minutes: z.number().int().min(1).max(24 * 60),
      date: z.date().default(() => new Date()),
      note: z.string().max(500).optional(),
      billable: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const { task } = await guardTask(ctx, input.taskId, "time:log", "time");
      return ctx.db.timeEntry.create({
        data: { ...input, projectId: task.projectId, userId: ctx.user.id },
      });
    }),

  forTask: protectedProcedure.input(z.object({ taskId: z.string() })).query(async ({ ctx, input }) => {
    await guardTask(ctx, input.taskId, "workspace:read", "time");
    return ctx.db.timeEntry.findMany({
      where: { taskId: input.taskId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { date: "desc" },
    });
  }),

  forProject: protectedProcedure.input(z.object({ projectId: z.string() })).query(async ({ ctx, input }) => {
    await guardProject(ctx, input.projectId, "workspace:read", "time");
    return ctx.db.timeEntry.findMany({
      where: { projectId: input.projectId },
      include: { user: { select: { id: true, name: true } }, task: { select: { id: true, title: true } } },
      orderBy: { date: "desc" },
      take: 300,
    });
  }),

  // Totals: all, billable, and per person
  summary: protectedProcedure.input(z.object({ projectId: z.string() })).query(async ({ ctx, input }) => {
    await guardProject(ctx, input.projectId, "workspace:read", "time");
    const rows = await ctx.db.timeEntry.groupBy({
      by: ["userId", "billable"],
      where: { projectId: input.projectId },
      _sum: { minutes: true },
    });
    const users = await ctx.db.user.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.userId))] } },
      select: { id: true, name: true, email: true },
    });
    const nameOf = new Map(users.map((u) => [u.id, u.name ?? u.email]));
    const perUser = new Map<string, { name: string; minutes: number; billable: number }>();
    let total = 0;
    let billable = 0;
    for (const r of rows) {
      const m = r._sum.minutes ?? 0;
      total += m;
      if (r.billable) billable += m;
      const cur = perUser.get(r.userId) ?? { name: nameOf.get(r.userId) ?? "Unknown", minutes: 0, billable: 0 };
      cur.minutes += m;
      if (r.billable) cur.billable += m;
      perUser.set(r.userId, cur);
    }
    return { totalMinutes: total, billableMinutes: billable, perUser: [...perUser.values()] };
  }),

  delete: protectedProcedure.input(z.object({ entryId: z.string() })).mutation(async ({ ctx, input }) => {
    const e = await ctx.db.timeEntry.findUnique({ where: { id: input.entryId } });
    if (!e) throw new TRPCError({ code: "NOT_FOUND" });
    const { role } = await guardProject(ctx, e.projectId, "time:log", "time");
    if (e.userId !== ctx.user.id && role !== "OWNER" && role !== "ADMIN") {
      throw new TRPCError({ code: "FORBIDDEN", message: "You can only delete your own time entries" });
    }
    await ctx.db.timeEntry.delete({ where: { id: e.id } });
    return { ok: true };
  }),
});
