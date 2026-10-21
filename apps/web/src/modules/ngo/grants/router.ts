import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/api/trpc";
import { guardWorkspace, log } from "@/server/api/guard";

const donors = router({
  list: protectedProcedure.input(z.object({ workspaceSlug: z.string() })).query(async ({ ctx, input }) => {
    const { workspace } = await guardWorkspace(ctx, input.workspaceSlug, "workspace:read", "ngo");
    return ctx.db.donor.findMany({
      where: { workspaceId: workspace.id },
      include: { _count: { select: { grants: true } } },
      orderBy: { name: "asc" },
    });
  }),

  create: protectedProcedure
    .input(z.object({
      workspaceSlug: z.string(),
      name: z.string().min(2).max(120),
      contactEmail: z.string().email().optional().or(z.literal("")),
      notes: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { workspace } = await guardWorkspace(ctx, input.workspaceSlug, "ngo:manage", "ngo");
      const { workspaceSlug: _s, contactEmail, ...rest } = input;
      const d = await ctx.db.donor.create({
        data: { ...rest, contactEmail: contactEmail || undefined, workspaceId: workspace.id },
      });
      await log(ctx, workspace.id, "donor.created", "Donor", d.id);
      return d;
    }),

  delete: protectedProcedure
    .input(z.object({ workspaceSlug: z.string(), donorId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { workspace } = await guardWorkspace(ctx, input.workspaceSlug, "ngo:manage", "ngo");
      await ctx.db.donor.deleteMany({ where: { id: input.donorId, workspaceId: workspace.id } });
      await log(ctx, workspace.id, "donor.deleted", "Donor", input.donorId);
      return { ok: true };
    }),
});

const grants = router({
  list: protectedProcedure
    .input(z.object({ workspaceSlug: z.string(), projectId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const { workspace } = await guardWorkspace(ctx, input.workspaceSlug, "workspace:read", "ngo");
      return ctx.db.grant.findMany({
        where: { workspaceId: workspace.id, ...(input.projectId ? { projectId: input.projectId } : {}) },
        include: {
          donor: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  create: protectedProcedure
    .input(z.object({
      workspaceSlug: z.string(),
      donorId: z.string(),
      projectId: z.string().nullish(),
      title: z.string().min(2).max(200),
      amount: z.number().positive(),
      currency: z.string().length(3).default("USD"),
      startDate: z.date().nullish(),
      endDate: z.date().nullish(),
      conditions: z.string().max(4000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { workspace } = await guardWorkspace(ctx, input.workspaceSlug, "ngo:manage", "ngo");
      const { workspaceSlug: _s, ...data } = input;
      // Make sure the donor and project belong to this organization
      const donor = await ctx.db.donor.findFirst({ where: { id: input.donorId, workspaceId: workspace.id } });
      if (!donor) throw new TRPCError({ code: "NOT_FOUND", message: "Donor not found" });
      if (input.projectId) {
        const project = await ctx.db.project.findFirst({
          where: { id: input.projectId, workspaceId: workspace.id, deletedAt: null },
        });
        if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      const g = await ctx.db.grant.create({ data: { ...data, workspaceId: workspace.id } });
      await log(ctx, workspace.id, "grant.created", "Grant", g.id, { amount: input.amount });
      return g;
    }),

  delete: protectedProcedure
    .input(z.object({ workspaceSlug: z.string(), grantId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { workspace } = await guardWorkspace(ctx, input.workspaceSlug, "ngo:manage", "ngo");
      await ctx.db.grant.deleteMany({ where: { id: input.grantId, workspaceId: workspace.id } });
      await log(ctx, workspace.id, "grant.deleted", "Grant", input.grantId);
      return { ok: true };
    }),
});

export const fundingRouter = router({ donors, grants });
