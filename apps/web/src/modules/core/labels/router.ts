import { z } from "zod";
import { router, protectedProcedure } from "@/server/api/trpc";
import { guardWorkspace } from "@/server/api/guard";

export const labelRouter = router({
  list: protectedProcedure.input(z.object({ workspaceSlug: z.string() })).query(async ({ ctx, input }) => {
    const { workspace } = await guardWorkspace(ctx, input.workspaceSlug, "workspace:read");
    return ctx.db.label.findMany({ where: { workspaceId: workspace.id }, orderBy: { name: "asc" } });
  }),

  create: protectedProcedure
    .input(z.object({
      workspaceSlug: z.string(),
      name: z.string().min(1).max(40),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6366f1"),
    }))
    .mutation(async ({ ctx, input }) => {
      const { workspace } = await guardWorkspace(ctx, input.workspaceSlug, "label:manage");
      return ctx.db.label.upsert({
        where: { workspaceId_name: { workspaceId: workspace.id, name: input.name } },
        update: { color: input.color },
        create: { workspaceId: workspace.id, name: input.name, color: input.color },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ workspaceSlug: z.string(), labelId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { workspace } = await guardWorkspace(ctx, input.workspaceSlug, "label:manage");
      await ctx.db.label.deleteMany({ where: { id: input.labelId, workspaceId: workspace.id } });
      return { ok: true };
    }),
});
