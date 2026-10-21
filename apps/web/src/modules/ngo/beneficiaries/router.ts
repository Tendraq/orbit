import { z } from "zod";
import { router, protectedProcedure } from "@/server/api/trpc";
import { guardWorkspace, log } from "@/server/api/guard";

export const beneficiaryRouter = router({
  // Guests (donors, partners) cannot read this data
  list: protectedProcedure
    .input(z.object({ workspaceSlug: z.string(), projectId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const { workspace } = await guardWorkspace(ctx, input.workspaceSlug, "beneficiary:read", "ngo");
      return ctx.db.beneficiary.findMany({
        where: { workspaceId: workspace.id, ...(input.projectId ? { projectId: input.projectId } : {}) },
        include: { project: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 500,
      });
    }),

  // Counts only: safe numbers for reports (no individual rows)
  summary: protectedProcedure
    .input(z.object({ workspaceSlug: z.string(), projectId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const { workspace } = await guardWorkspace(ctx, input.workspaceSlug, "beneficiary:read", "ngo");
      const where = { workspaceId: workspace.id, ...(input.projectId ? { projectId: input.projectId } : {}) };
      const [total, byGender, byAge, withDisability] = await Promise.all([
        ctx.db.beneficiary.count({ where }),
        ctx.db.beneficiary.groupBy({ by: ["gender"], where, _count: { _all: true } }),
        ctx.db.beneficiary.groupBy({ by: ["ageGroup"], where, _count: { _all: true } }),
        ctx.db.beneficiary.count({ where: { ...where, disability: true } }),
      ]);
      return {
        total,
        withDisability,
        byGender: byGender.map((g) => ({ label: g.gender ?? "Not recorded", count: g._count._all })),
        byAge: byAge.map((a) => ({ label: a.ageGroup ?? "Not recorded", count: a._count._all })),
      };
    }),

  create: protectedProcedure
    .input(z.object({
      workspaceSlug: z.string(),
      projectId: z.string().nullish(),
      code: z.string().min(1).max(40), // a code, never a name
      gender: z.string().max(30).optional(),
      ageGroup: z.string().max(30).optional(),
      location: z.string().max(120).optional(),
      disability: z.boolean().default(false),
      consentGiven: z.boolean().default(false),
      notes: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { workspace } = await guardWorkspace(ctx, input.workspaceSlug, "ngo:data", "ngo");
      const { workspaceSlug: _s, ...data } = input;
      const b = await ctx.db.beneficiary.create({ data: { ...data, workspaceId: workspace.id } });
      await log(ctx, workspace.id, "beneficiary.created", "Beneficiary", b.id);
      return b;
    }),

  delete: protectedProcedure
    .input(z.object({ workspaceSlug: z.string(), beneficiaryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { workspace } = await guardWorkspace(ctx, input.workspaceSlug, "ngo:manage", "ngo");
      await ctx.db.beneficiary.deleteMany({ where: { id: input.beneficiaryId, workspaceId: workspace.id } });
      await log(ctx, workspace.id, "beneficiary.deleted", "Beneficiary", input.beneficiaryId);
      return { ok: true };
    }),
});
