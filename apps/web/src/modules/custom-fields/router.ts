import { z } from "zod";
import { router, protectedProcedure } from "@/server/api/trpc";
import { guardWorkspace } from "@/server/api/guard";

const entityEnum = z.enum(["TASK", "PROJECT"]);
const typeEnum = z.enum(["TEXT", "NUMBER", "DATE", "SELECT"]);

export const customFieldRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceSlug: z.string(), entity: entityEnum.optional() }))
    .query(async ({ ctx, input }) => {
      const { workspace } = await guardWorkspace(ctx, input.workspaceSlug, "workspace:read");
      return ctx.db.customFieldDef.findMany({
        where: { workspaceId: workspace.id, ...(input.entity ? { entity: input.entity } : {}) },
        orderBy: { label: "asc" },
      });
    }),

  create: protectedProcedure
    .input(z.object({
      workspaceSlug: z.string(),
      entity: entityEnum,
      label: z.string().min(1).max(60),
      type: typeEnum,
      options: z.array(z.string().min(1)).default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      const { workspace } = await guardWorkspace(ctx, input.workspaceSlug, "customfield:manage");
      const key = input.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      return ctx.db.customFieldDef.upsert({
        where: { workspaceId_entity_key: { workspaceId: workspace.id, entity: input.entity, key } },
        update: { label: input.label, type: input.type, options: input.options },
        create: { workspaceId: workspace.id, entity: input.entity, key, label: input.label, type: input.type, options: input.options },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ workspaceSlug: z.string(), fieldId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { workspace } = await guardWorkspace(ctx, input.workspaceSlug, "customfield:manage");
      await ctx.db.customFieldDef.deleteMany({ where: { id: input.fieldId, workspaceId: workspace.id } });
      return { ok: true };
    }),
});
