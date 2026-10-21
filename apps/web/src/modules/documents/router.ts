import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/api/trpc";
import { guardProject, log } from "@/server/api/guard";

const kind = z.enum(["NOTE", "MEETING", "DECISION", "CHARTER", "OTHER"]);

export const documentRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.string(), kind: kind.optional() }))
    .query(async ({ ctx, input }) => {
      await guardProject(ctx, input.projectId, "workspace:read", "documents");
      return ctx.db.document.findMany({
        where: { projectId: input.projectId, ...(input.kind ? { kind: input.kind } : {}) },
        orderBy: { updatedAt: "desc" },
      });
    }),

  get: protectedProcedure.input(z.object({ documentId: z.string() })).query(async ({ ctx, input }) => {
    const doc = await ctx.db.document.findUnique({ where: { id: input.documentId } });
    if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
    await guardProject(ctx, doc.projectId, "workspace:read", "documents");
    return doc;
  }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      title: z.string().min(1).max(200),
      kind: kind.default("NOTE"),
      content: z.string().max(100000).default(""),
    }))
    .mutation(async ({ ctx, input }) => {
      const { workspace } = await guardProject(ctx, input.projectId, "document:manage", "documents");
      const doc = await ctx.db.document.create({ data: { ...input, createdById: ctx.user.id } });
      await log(ctx, workspace.id, "document.created", "Document", doc.id);
      return doc;
    }),

  update: protectedProcedure
    .input(z.object({
      documentId: z.string(),
      title: z.string().min(1).max(200).optional(),
      kind: kind.optional(),
      content: z.string().max(100000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.db.document.findUnique({ where: { id: input.documentId } });
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
      const { workspace } = await guardProject(ctx, doc.projectId, "document:manage", "documents");
      const { documentId: _id, ...data } = input;
      const updated = await ctx.db.document.update({ where: { id: doc.id }, data });
      await log(ctx, workspace.id, "document.updated", "Document", doc.id);
      return updated;
    }),

  delete: protectedProcedure.input(z.object({ documentId: z.string() })).mutation(async ({ ctx, input }) => {
    const doc = await ctx.db.document.findUnique({ where: { id: input.documentId } });
    if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
    const { workspace } = await guardProject(ctx, doc.projectId, "document:manage", "documents");
    await ctx.db.document.delete({ where: { id: doc.id } });
    await log(ctx, workspace.id, "document.deleted", "Document", doc.id);
    return { ok: true };
  }),
});
