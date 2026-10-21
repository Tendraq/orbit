import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/api/trpc";
import { guardProject, log } from "@/server/api/guard";

const score = z.number().int().min(1).max(5);

export const stakeholderRouter = router({
  list: protectedProcedure.input(z.object({ projectId: z.string() })).query(async ({ ctx, input }) => {
    await guardProject(ctx, input.projectId, "workspace:read", "stakeholders");
    return ctx.db.stakeholder.findMany({ where: { projectId: input.projectId }, orderBy: { name: "asc" } });
  }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      name: z.string().min(1).max(120),
      organization: z.string().max(120).optional(),
      role: z.string().max(120).optional(),
      influence: score.default(3),
      interest: score.default(3),
      engagement: z.string().max(1000).optional(),
      notes: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { workspace } = await guardProject(ctx, input.projectId, "stakeholder:manage", "stakeholders");
      const s = await ctx.db.stakeholder.create({ data: input });
      await log(ctx, workspace.id, "stakeholder.created", "Stakeholder", s.id);
      return s;
    }),

  update: protectedProcedure
    .input(z.object({
      stakeholderId: z.string(),
      name: z.string().min(1).max(120).optional(),
      organization: z.string().max(120).nullish(),
      role: z.string().max(120).nullish(),
      influence: score.optional(),
      interest: score.optional(),
      engagement: z.string().max(1000).nullish(),
      notes: z.string().max(2000).nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      const s = await ctx.db.stakeholder.findUnique({ where: { id: input.stakeholderId } });
      if (!s) throw new TRPCError({ code: "NOT_FOUND" });
      await guardProject(ctx, s.projectId, "stakeholder:manage", "stakeholders");
      const { stakeholderId: _id, ...data } = input;
      return ctx.db.stakeholder.update({ where: { id: s.id }, data });
    }),

  delete: protectedProcedure.input(z.object({ stakeholderId: z.string() })).mutation(async ({ ctx, input }) => {
    const s = await ctx.db.stakeholder.findUnique({ where: { id: input.stakeholderId } });
    if (!s) throw new TRPCError({ code: "NOT_FOUND" });
    await guardProject(ctx, s.projectId, "stakeholder:manage", "stakeholders");
    await ctx.db.stakeholder.delete({ where: { id: s.id } });
    return { ok: true };
  }),
});
