import { z } from "zod";
import { router, protectedProcedure } from "@/server/api/trpc";
import { guardWorkspace, log } from "@/server/api/guard";

export const partnerRouter = router({
  list: protectedProcedure.input(z.object({ workspaceSlug: z.string() })).query(async ({ ctx, input }) => {
    const { workspace } = await guardWorkspace(ctx, input.workspaceSlug, "workspace:read", "ngo");
    return ctx.db.partner.findMany({ where: { workspaceId: workspace.id }, orderBy: { name: "asc" } });
  }),

  create: protectedProcedure
    .input(z.object({
      workspaceSlug: z.string(),
      name: z.string().min(2).max(120),
      type: z.string().max(60).optional(),
      country: z.string().max(60).optional(),
      contactEmail: z.string().email().optional().or(z.literal("")),
    }))
    .mutation(async ({ ctx, input }) => {
      const { workspace } = await guardWorkspace(ctx, input.workspaceSlug, "ngo:manage", "ngo");
      const { workspaceSlug: _s, contactEmail, ...rest } = input;
      const p = await ctx.db.partner.create({
        data: { ...rest, contactEmail: contactEmail || undefined, workspaceId: workspace.id },
      });
      await log(ctx, workspace.id, "partner.created", "Partner", p.id);
      return p;
    }),

  setStatus: protectedProcedure
    .input(z.object({ workspaceSlug: z.string(), partnerId: z.string(), status: z.enum(["ACTIVE", "INACTIVE"]) }))
    .mutation(async ({ ctx, input }) => {
      const { workspace } = await guardWorkspace(ctx, input.workspaceSlug, "ngo:manage", "ngo");
      await ctx.db.partner.updateMany({
        where: { id: input.partnerId, workspaceId: workspace.id },
        data: { status: input.status },
      });
      return { ok: true };
    }),

  delete: protectedProcedure
    .input(z.object({ workspaceSlug: z.string(), partnerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { workspace } = await guardWorkspace(ctx, input.workspaceSlug, "ngo:manage", "ngo");
      await ctx.db.partner.deleteMany({ where: { id: input.partnerId, workspaceId: workspace.id } });
      await log(ctx, workspace.id, "partner.deleted", "Partner", input.partnerId);
      return { ok: true };
    }),
});
