import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/api/trpc";
import { guardProject, log } from "@/server/api/guard";
import { notify, notifyMany, approverIds } from "@/server/notify";

async function loadChange(db: Parameters<typeof guardProject>[0]["db"], id: string) {
  const change = await db.changeRequest.findUnique({ where: { id } });
  if (!change) throw new TRPCError({ code: "NOT_FOUND", message: "Change request not found" });
  return change;
}

export const changeRouter = router({
  list: protectedProcedure.input(z.object({ projectId: z.string() })).query(async ({ ctx, input }) => {
    await guardProject(ctx, input.projectId, "workspace:read", "changes");
    return ctx.db.changeRequest.findMany({
      where: { projectId: input.projectId },
      orderBy: { createdAt: "desc" },
    });
  }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      title: z.string().min(2).max(200),
      description: z.string().max(4000).optional(),
      reason: z.string().max(2000).optional(),
      costImpact: z.number().default(0),
      scheduleImpactDays: z.number().int().default(0),
      scopeImpact: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { workspace } = await guardProject(ctx, input.projectId, "change:create", "changes");
      const change = await ctx.db.changeRequest.create({ data: { ...input, requestedById: ctx.user.id } });
      await log(ctx, workspace.id, "change.created", "ChangeRequest", change.id);
      return change;
    }),

  // Only a draft can be edited
  update: protectedProcedure
    .input(z.object({
      changeId: z.string(),
      title: z.string().min(2).max(200).optional(),
      description: z.string().max(4000).nullish(),
      reason: z.string().max(2000).nullish(),
      costImpact: z.number().optional(),
      scheduleImpactDays: z.number().int().optional(),
      scopeImpact: z.string().max(2000).nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      const change = await loadChange(ctx.db, input.changeId);
      await guardProject(ctx, change.projectId, "change:create", "changes");
      if (change.status !== "DRAFT") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only drafts can be edited" });
      }
      const { changeId: _id, ...data } = input;
      return ctx.db.changeRequest.update({ where: { id: change.id }, data });
    }),

  submit: protectedProcedure.input(z.object({ changeId: z.string() })).mutation(async ({ ctx, input }) => {
    const change = await loadChange(ctx.db, input.changeId);
    const { project, workspace } = await guardProject(ctx, change.projectId, "change:create", "changes");
    if (change.status !== "DRAFT") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Already submitted" });
    }
    await ctx.db.changeRequest.update({ where: { id: change.id }, data: { status: "SUBMITTED" } });
    await log(ctx, workspace.id, "change.submitted", "ChangeRequest", change.id);
    await notifyMany(ctx.db, (await approverIds(ctx.db, workspace.id)).filter((id) => id !== ctx.user.id), {
      workspaceId: workspace.id,
      type: "change",
      title: `Change request to review: ${change.title}`,
      body: project.name,
      link: `/${workspace.slug}/projects/${project.id}/changes`,
    });
    return { ok: true };
  }),

  decide: protectedProcedure
    .input(z.object({ changeId: z.string(), approve: z.boolean(), note: z.string().max(1000).optional() }))
    .mutation(async ({ ctx, input }) => {
      const change = await loadChange(ctx.db, input.changeId);
      const { project, workspace } = await guardProject(ctx, change.projectId, "change:decide", "changes");
      if (change.status !== "SUBMITTED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only submitted requests can be decided" });
      }
      await ctx.db.changeRequest.update({
        where: { id: change.id },
        data: {
          status: input.approve ? "APPROVED" : "REJECTED",
          decidedById: ctx.user.id,
          decidedAt: new Date(),
          decisionNote: input.note,
        },
      });
      await log(ctx, workspace.id, input.approve ? "change.approved" : "change.rejected", "ChangeRequest", change.id);
      await notify(ctx.db, change.requestedById, {
        workspaceId: workspace.id,
        type: "change",
        title: `${input.approve ? "Approved" : "Rejected"}: ${change.title}`,
        body: input.note,
        link: `/${workspace.slug}/projects/${project.id}/changes`,
      });
      return { ok: true };
    }),

  markImplemented: protectedProcedure.input(z.object({ changeId: z.string() })).mutation(async ({ ctx, input }) => {
    const change = await loadChange(ctx.db, input.changeId);
    const { workspace } = await guardProject(ctx, change.projectId, "change:decide", "changes");
    if (change.status !== "APPROVED") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Only approved changes can be implemented" });
    }
    await ctx.db.changeRequest.update({ where: { id: change.id }, data: { status: "IMPLEMENTED" } });
    await log(ctx, workspace.id, "change.implemented", "ChangeRequest", change.id);
    return { ok: true };
  }),

  delete: protectedProcedure.input(z.object({ changeId: z.string() })).mutation(async ({ ctx, input }) => {
    const change = await loadChange(ctx.db, input.changeId);
    await guardProject(ctx, change.projectId, "change:create", "changes");
    if (change.status !== "DRAFT") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Only drafts can be deleted" });
    }
    await ctx.db.changeRequest.delete({ where: { id: change.id } });
    return { ok: true };
  }),
});
