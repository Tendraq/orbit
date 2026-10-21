import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/api/trpc";
import { guardProject, log } from "@/server/api/guard";

const lessonKind = z.enum(["WENT_WELL", "TO_IMPROVE", "RECOMMENDATION"]);

const lessons = router({
  list: protectedProcedure.input(z.object({ projectId: z.string() })).query(async ({ ctx, input }) => {
    await guardProject(ctx, input.projectId, "workspace:read", "evaluation");
    return ctx.db.lesson.findMany({ where: { projectId: input.projectId }, orderBy: { createdAt: "desc" } });
  }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      kind: lessonKind,
      title: z.string().min(2).max(200),
      body: z.string().max(4000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { workspace } = await guardProject(ctx, input.projectId, "lesson:manage", "evaluation");
      const l = await ctx.db.lesson.create({ data: { ...input, createdById: ctx.user.id } });
      await log(ctx, workspace.id, "lesson.created", "Lesson", l.id);
      return l;
    }),

  delete: protectedProcedure.input(z.object({ lessonId: z.string() })).mutation(async ({ ctx, input }) => {
    const l = await ctx.db.lesson.findUnique({ where: { id: input.lessonId } });
    if (!l) throw new TRPCError({ code: "NOT_FOUND" });
    await guardProject(ctx, l.projectId, "lesson:manage", "evaluation");
    await ctx.db.lesson.delete({ where: { id: l.id } });
    return { ok: true };
  }),
});

const evaluations = router({
  list: protectedProcedure.input(z.object({ projectId: z.string() })).query(async ({ ctx, input }) => {
    await guardProject(ctx, input.projectId, "workspace:read", "evaluation");
    return ctx.db.evaluation.findMany({ where: { projectId: input.projectId }, orderBy: { date: "desc" } });
  }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      type: z.enum(["MIDTERM", "FINAL", "OTHER"]),
      title: z.string().min(2).max(200),
      summary: z.string().max(6000).optional(),
      score: z.number().min(0).max(100).nullish(),
      date: z.date().default(() => new Date()),
    }))
    .mutation(async ({ ctx, input }) => {
      const { workspace } = await guardProject(ctx, input.projectId, "lesson:manage", "evaluation");
      const e = await ctx.db.evaluation.create({ data: input });
      await log(ctx, workspace.id, "evaluation.created", "Evaluation", e.id);
      return e;
    }),

  delete: protectedProcedure.input(z.object({ evaluationId: z.string() })).mutation(async ({ ctx, input }) => {
    const e = await ctx.db.evaluation.findUnique({ where: { id: input.evaluationId } });
    if (!e) throw new TRPCError({ code: "NOT_FOUND" });
    await guardProject(ctx, e.projectId, "lesson:manage", "evaluation");
    await ctx.db.evaluation.delete({ where: { id: e.id } });
    return { ok: true };
  }),
});

export const evaluationRouter = router({ lessons, evaluations });
