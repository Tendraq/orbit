import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/api/trpc";
import { guardProject, log } from "@/server/api/guard";

const level = z.enum(["GOAL", "OUTCOME", "OUTPUT", "ACTIVITY"]);
const ORDER = ["GOAL", "OUTCOME", "OUTPUT", "ACTIVITY"] as const;

export const logframeRouter = router({
  // Flat list; the page builds the tree from parentId
  list: protectedProcedure.input(z.object({ projectId: z.string() })).query(async ({ ctx, input }) => {
    await guardProject(ctx, input.projectId, "workspace:read", "ngo");
    const items = await ctx.db.logframeItem.findMany({
      where: { projectId: input.projectId },
      include: { _count: { select: { indicators: true } } },
      orderBy: [{ code: "asc" }],
    });
    return items;
  }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      parentId: z.string().nullish(),
      level,
      code: z.string().min(1).max(20),
      statement: z.string().min(2).max(1000),
      assumptions: z.string().max(1000).optional(),
      meansOfVerification: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { workspace } = await guardProject(ctx, input.projectId, "ngo:manage", "ngo");
      if (input.parentId) {
        const parent = await ctx.db.logframeItem.findFirst({
          where: { id: input.parentId, projectId: input.projectId },
        });
        if (!parent) throw new TRPCError({ code: "BAD_REQUEST", message: "Parent not found" });
        if (ORDER.indexOf(parent.level) !== ORDER.indexOf(input.level) - 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `A ${input.level.toLowerCase()} must sit directly under a ${ORDER[ORDER.indexOf(input.level) - 1]?.toLowerCase() ?? "nothing"}`,
          });
        }
      } else if (input.level !== "GOAL") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only a goal can be at the top level" });
      }
      const item = await ctx.db.logframeItem.create({ data: input });
      await log(ctx, workspace.id, "logframe.created", "LogframeItem", item.id);
      return item;
    }),

  update: protectedProcedure
    .input(z.object({
      itemId: z.string(),
      code: z.string().min(1).max(20).optional(),
      statement: z.string().min(2).max(1000).optional(),
      assumptions: z.string().max(1000).nullish(),
      meansOfVerification: z.string().max(1000).nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.logframeItem.findUnique({ where: { id: input.itemId } });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      const { workspace } = await guardProject(ctx, item.projectId, "ngo:manage", "ngo");
      const { itemId: _id, ...data } = input;
      const updated = await ctx.db.logframeItem.update({ where: { id: item.id }, data });
      await log(ctx, workspace.id, "logframe.updated", "LogframeItem", item.id);
      return updated;
    }),

  // Deleting an item also deletes everything beneath it
  delete: protectedProcedure.input(z.object({ itemId: z.string() })).mutation(async ({ ctx, input }) => {
    const item = await ctx.db.logframeItem.findUnique({ where: { id: input.itemId } });
    if (!item) throw new TRPCError({ code: "NOT_FOUND" });
    const { workspace } = await guardProject(ctx, item.projectId, "ngo:manage", "ngo");
    await ctx.db.logframeItem.delete({ where: { id: item.id } });
    await log(ctx, workspace.id, "logframe.deleted", "LogframeItem", item.id);
    return { ok: true };
  }),
});
