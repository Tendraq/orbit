import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/api/trpc";
import { guardProject, log } from "@/server/api/guard";
import { notifyMany, approverIds } from "@/server/notify";
import { buildReportData, draftNarrative } from "./service";

const status = z.enum(["DRAFT", "SUBMITTED", "ACCEPTED"]);

export const donorReportRouter = router({
  list: protectedProcedure.input(z.object({ projectId: z.string() })).query(async ({ ctx, input }) => {
    await guardProject(ctx, input.projectId, "workspace:read", "ngo");
    return ctx.db.donorReport.findMany({ where: { projectId: input.projectId }, orderBy: { createdAt: "desc" } });
  }),

  get: protectedProcedure.input(z.object({ reportId: z.string() })).query(async ({ ctx, input }) => {
    const r = await ctx.db.donorReport.findUnique({ where: { id: input.reportId } });
    if (!r) throw new TRPCError({ code: "NOT_FOUND" });
    await guardProject(ctx, r.projectId, "workspace:read", "ngo");
    return r;
  }),

  // Builds a first draft from the project's real data
  generate: protectedProcedure
    .input(z.object({ projectId: z.string(), periodStart: z.date(), periodEnd: z.date() }))
    .query(async ({ ctx, input }) => {
      await guardProject(ctx, input.projectId, "report:manage", "ngo");
      const data = await buildReportData(ctx.db, input.projectId, input.periodStart, input.periodEnd);
      return { narrative: draftNarrative(data) };
    }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      grantId: z.string().nullish(),
      title: z.string().min(2).max(200),
      periodStart: z.date(),
      periodEnd: z.date(),
      narrative: z.string().max(60000).default(""),
    }))
    .mutation(async ({ ctx, input }) => {
      const { workspace } = await guardProject(ctx, input.projectId, "report:manage", "ngo");
      if (input.periodEnd < input.periodStart) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "The end date is before the start date" });
      }
      const r = await ctx.db.donorReport.create({ data: { ...input, createdById: ctx.user.id } });
      await log(ctx, workspace.id, "report.created", "DonorReport", r.id);
      return r;
    }),

  // Only a draft can be edited
  update: protectedProcedure
    .input(z.object({
      reportId: z.string(),
      title: z.string().min(2).max(200).optional(),
      narrative: z.string().max(60000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const r = await ctx.db.donorReport.findUnique({ where: { id: input.reportId } });
      if (!r) throw new TRPCError({ code: "NOT_FOUND" });
      await guardProject(ctx, r.projectId, "report:manage", "ngo");
      if (r.status !== "DRAFT") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only drafts can be edited" });
      }
      const { reportId: _id, ...data } = input;
      return ctx.db.donorReport.update({ where: { id: r.id }, data });
    }),

  setStatus: protectedProcedure
    .input(z.object({ reportId: z.string(), status }))
    .mutation(async ({ ctx, input }) => {
      const r = await ctx.db.donorReport.findUnique({ where: { id: input.reportId } });
      if (!r) throw new TRPCError({ code: "NOT_FOUND" });
      const { project, workspace } = await guardProject(ctx, r.projectId, "report:manage", "ngo");
      await ctx.db.donorReport.update({ where: { id: r.id }, data: { status: input.status } });
      await log(ctx, workspace.id, `report.${input.status.toLowerCase()}`, "DonorReport", r.id);
      if (input.status === "SUBMITTED") {
        await notifyMany(ctx.db, (await approverIds(ctx.db, workspace.id)).filter((id) => id !== ctx.user.id), {
          workspaceId: workspace.id,
          type: "report",
          title: `Donor report submitted: ${r.title}`,
          body: project.name,
          link: `/${workspace.slug}/projects/${project.id}/reports`,
        });
      }
      return { ok: true };
    }),

  delete: protectedProcedure.input(z.object({ reportId: z.string() })).mutation(async ({ ctx, input }) => {
    const r = await ctx.db.donorReport.findUnique({ where: { id: input.reportId } });
    if (!r) throw new TRPCError({ code: "NOT_FOUND" });
    await guardProject(ctx, r.projectId, "report:manage", "ngo");
    if (r.status !== "DRAFT") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Only drafts can be deleted" });
    }
    await ctx.db.donorReport.delete({ where: { id: r.id } });
    return { ok: true };
  }),
});
