import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/api/trpc";
import { guardProject, log } from "@/server/api/guard";
import { emit } from "@/server/events";
import { commitPlan, describePlan, parseImport } from "./service";

const input = z.object({
  projectId: z.string(),
  format: z.enum(["csv", "xlsx", "msproject"]),
  data: z.string().max(14_000_000), // text for csv/xml, base64 for xlsx
  dayFirst: z.boolean().default(true),
  skipExisting: z.boolean().default(true),
});

function read(format: "csv" | "xlsx" | "msproject", data: string, dayFirst: boolean) {
  try {
    return parseImport(format, data, dayFirst);
  } catch (e) {
    throw new TRPCError({ code: "BAD_REQUEST", message: e instanceof Error ? e.message : "This file could not be read." });
  }
}

// Both steps are "mutations" because they send the whole file (too big for a web address).
export const exchangeRouter = router({
  // Step 1: read the file and show what would happen. Nothing is saved.
  preview: protectedProcedure.input(input).mutation(async ({ ctx, input: i }) => {
    const { workspace } = await guardProject(ctx, i.projectId, "task:create");
    const { plan, projectName, columns } = read(i.format, i.data, i.dayFirst);
    const summary = await describePlan(ctx.db, { workspaceId: workspace.id, projectId: i.projectId, plan, skipExisting: i.skipExisting });
    return { ...summary, projectName: projectName ?? null, columns };
  }),

  // Step 2: save it.
  commit: protectedProcedure
    .input(input.extend({ importMilestones: z.boolean().default(true) }))
    .mutation(async ({ ctx, input: i }) => {
      const { project, workspace } = await guardProject(ctx, i.projectId, "task:create");
      const { plan } = read(i.format, i.data, i.dayFirst);
      if (plan.tasks.length === 0 && plan.milestones.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: plan.warnings[0] ?? "There is nothing to import in this file." });
      }
      const result = await commitPlan(ctx.db, {
        workspaceId: workspace.id, projectId: i.projectId, userId: ctx.user.id, plan,
        skipExisting: i.skipExisting, importMilestones: i.importMilestones,
      });
      await log(ctx, workspace.id, "data.imported", "Project", project.id, { format: i.format, created: result.created, skipped: result.skipped });
      await emit(ctx.db, workspace.id, "import.completed", {
        project: project.name, by: ctx.user.name ?? ctx.user.email,
        note: `${result.created} task(s), ${result.milestones} milestone(s), ${result.dependencies} link(s)`,
        path: `/${workspace.slug}/projects/${project.id}/list`,
      });
      return result;
    }),
});
