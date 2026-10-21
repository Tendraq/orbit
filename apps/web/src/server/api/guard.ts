import { TRPCError } from "@trpc/server";
import type { PrismaClient, User, Prisma } from "@orbit/db";
import { requireWorkspaceAccess, type Action } from "@/server/permissions";
import { writeAudit } from "@/server/audit";

export type Ctx = { db: PrismaClient; user: User };

function requireModule(workspace: { enabledModules: string[] }, module?: string) {
  if (module && !workspace.enabledModules.includes(module)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `The "${module}" module is switched off for this organization`,
    });
  }
}

/** Check access to a workspace by its address (slug). */
export async function guardWorkspace(ctx: Ctx, slug: string, action: Action, module?: string) {
  const { workspace, role } = await requireWorkspaceAccess(ctx.db, ctx.user.id, { slug }, action);
  requireModule(workspace, module);
  return { workspace, role };
}

/** Check access to a project (finds its workspace for you). */
export async function guardProject(ctx: Ctx, projectId: string, action: Action, module?: string) {
  const project = await ctx.db.project.findFirst({ where: { id: projectId, deletedAt: null } });
  if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
  const { workspace, role } = await requireWorkspaceAccess(
    ctx.db, ctx.user.id, { id: project.workspaceId }, action
  );
  requireModule(workspace, module);
  return { project, workspace, role };
}

/** Check access to a task (finds its project and workspace for you). */
export async function guardTask(ctx: Ctx, taskId: string, action: Action, module?: string) {
  const task = await ctx.db.task.findFirst({ where: { id: taskId, deletedAt: null } });
  if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
  const { project, workspace, role } = await guardProject(ctx, task.projectId, action, module);
  return { task, project, workspace, role };
}

/** Shortcut: write an audit-log entry for the current user. */
export function log(
  ctx: Ctx,
  workspaceId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Prisma.InputJsonValue
) {
  return writeAudit(ctx.db, { workspaceId, userId: ctx.user.id, action, entityType, entityId, metadata });
}
