import { z } from "zod";
import { router, protectedProcedure } from "@/server/api/trpc";
import { guardProject, guardWorkspace, log } from "@/server/api/guard";
import { createProjectInput, updateProjectInput } from "./schema";

export const projectRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const { workspace } = await guardWorkspace(ctx, input.workspaceSlug, "workspace:read");
      const projects = await ctx.db.project.findMany({
        where: { workspaceId: workspace.id, deletedAt: null },
        orderBy: { createdAt: "desc" },
      });
      const counts = await ctx.db.task.groupBy({
        by: ["projectId", "status"],
        where: { projectId: { in: projects.map((p) => p.id) }, deletedAt: null, parentId: null },
        _count: { _all: true },
      });
      return projects.map((p) => {
        const mine = counts.filter((c) => c.projectId === p.id);
        const total = mine.reduce((n, c) => n + c._count._all, 0);
        const done = mine.find((c) => c.status === "DONE")?._count._all ?? 0;
        return { ...p, taskTotal: total, taskDone: done };
      });
    }),

  // One project + info the project pages need (workspace, my role, modules)
  get: protectedProcedure.input(z.object({ projectId: z.string() })).query(async ({ ctx, input }) => {
    const { project, workspace, role } = await guardProject(ctx, input.projectId, "workspace:read");
    return {
      ...project,
      workspace: {
        id: workspace.id,
        slug: workspace.slug,
        name: workspace.name,
        enabledModules: workspace.enabledModules,
        terminology: workspace.terminology as Record<string, string> | null,
      },
      role,
    };
  }),

  // People who can be assigned to work in this project
  members: protectedProcedure.input(z.object({ projectId: z.string() })).query(async ({ ctx, input }) => {
    const { workspace } = await guardProject(ctx, input.projectId, "workspace:read");
    const rows = await ctx.db.membership.findMany({
      where: { workspaceId: workspace.id, role: { not: "GUEST" } },
      include: { user: { select: { id: true, name: true, email: true, imageUrl: true } } },
    });
    return rows.map((m) => m.user);
  }),

  create: protectedProcedure.input(createProjectInput).mutation(async ({ ctx, input }) => {
    const { workspace } = await guardWorkspace(ctx, input.workspaceSlug, "project:create");
    const { workspaceSlug: _slug, ...data } = input;
    const project = await ctx.db.project.create({ data: { ...data, workspaceId: workspace.id } });
    await log(ctx, workspace.id, "project.created", "Project", project.id);
    return project;
  }),

  update: protectedProcedure.input(updateProjectInput).mutation(async ({ ctx, input }) => {
    const { project, workspace } = await guardProject(ctx, input.projectId, "project:update");
    const { projectId: _id, ...data } = input;
    const updated = await ctx.db.project.update({ where: { id: project.id }, data });
    await log(ctx, workspace.id, "project.updated", "Project", project.id);
    return updated;
  }),

  // Soft delete: hidden but recoverable
  archive: protectedProcedure.input(z.object({ projectId: z.string() })).mutation(async ({ ctx, input }) => {
    const { project, workspace } = await guardProject(ctx, input.projectId, "project:update");
    await ctx.db.project.update({ where: { id: project.id }, data: { deletedAt: new Date() } });
    await log(ctx, workspace.id, "project.archived", "Project", project.id);
    return { ok: true };
  }),

  // Recent changes in this project
  activity: protectedProcedure.input(z.object({ projectId: z.string() })).query(async ({ ctx, input }) => {
    const { project, workspace } = await guardProject(ctx, input.projectId, "workspace:read");
    const rows = await ctx.db.auditLog.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    // Keep entries about this project or its tasks (best effort, by entity id)
    const taskIds = new Set(
      (await ctx.db.task.findMany({ where: { projectId: project.id }, select: { id: true } })).map((t) => t.id)
    );
    return rows
      .filter((r) => r.entityId === project.id || taskIds.has(r.entityId))
      .slice(0, 30);
  }),
});
