import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/api/trpc";
import { guardProject, guardTask, log } from "@/server/api/guard";
import { notify } from "@/server/notify";
import { createTaskInput, updateTaskInput, taskStatus, dependencyType } from "./schema";

export const taskRouter = router({
  // Top-level tasks with their subtasks (list view)
  list: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { project } = await guardProject(ctx, input.projectId, "workspace:read");
      const tasks = await ctx.db.task.findMany({
        where: { projectId: input.projectId, parentId: null, deletedAt: null },
        include: {
          subtasks: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
          assignee: { select: { id: true, name: true, imageUrl: true } },
        },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      });
      return { project, tasks };
    }),

  // Every task, flat (board, table, timeline and calendar views)
  listAll: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await guardProject(ctx, input.projectId, "workspace:read");
      return ctx.db.task.findMany({
        where: { projectId: input.projectId, deletedAt: null },
        include: {
          assignee: { select: { id: true, name: true, imageUrl: true } },
          labels: { include: { label: true } },
          dependencies: { select: { dependsOnId: true, type: true, lagDays: true } },
          _count: { select: { comments: true, subtasks: true } },
        },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      });
    }),

  // One task in full (task page)
  get: protectedProcedure.input(z.object({ taskId: z.string() })).query(async ({ ctx, input }) => {
    const { task, project, workspace, role } = await guardTask(ctx, input.taskId, "workspace:read");
    const full = await ctx.db.task.findUniqueOrThrow({
      where: { id: task.id },
      include: {
        assignee: { select: { id: true, name: true, imageUrl: true } },
        subtasks: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
        labels: { include: { label: true } },
        attachments: { orderBy: { createdAt: "desc" } },
        dependencies: { include: { dependsOn: { select: { id: true, title: true, status: true } } } },
        dependents: { include: { task: { select: { id: true, title: true, status: true } } } },
      },
    });
    return {
      task: full,
      project: { id: project.id, name: project.name },
      workspace: {
        slug: workspace.slug,
        enabledModules: workspace.enabledModules,
      },
      role,
    };
  }),

  // My tasks across every project and organization
  mine: protectedProcedure.query(({ ctx }) =>
    ctx.db.task.findMany({
      where: {
        assigneeId: ctx.user.id,
        status: { not: "DONE" },
        deletedAt: null,
        project: { deletedAt: null },
      },
      include: {
        project: { select: { id: true, name: true, workspace: { select: { slug: true, name: true } } } },
      },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      take: 200,
    })
  ),

  create: protectedProcedure.input(createTaskInput).mutation(async ({ ctx, input }) => {
    const { project, workspace } = await guardProject(ctx, input.projectId, "task:create");
    const task = await ctx.db.task.create({
      data: { ...input, reporterId: ctx.user.id },
    });
    await log(ctx, workspace.id, input.parentId ? "subtask.created" : "task.created", "Task", task.id);
    if (task.assigneeId && task.assigneeId !== ctx.user.id) {
      await notify(ctx.db, task.assigneeId, {
        workspaceId: workspace.id,
        type: "assigned",
        title: `You were assigned: ${task.title}`,
        body: project.name,
        link: `/tasks/${task.id}`,
      });
    }
    return task;
  }),

  update: protectedProcedure.input(updateTaskInput).mutation(async ({ ctx, input }) => {
    const { task, project, workspace } = await guardTask(ctx, input.taskId, "task:update");
    const { taskId: _id, status, ...rest } = input;
    const updated = await ctx.db.task.update({
      where: { id: task.id },
      data: {
        ...rest,
        ...(status
          ? { status, completedAt: status === "DONE" ? new Date() : null }
          : {}),
      },
    });
    await log(ctx, workspace.id, "task.updated", "Task", task.id, {
      status: status ?? null,
      title: input.title ?? null,
    });
    if (input.assigneeId && input.assigneeId !== task.assigneeId && input.assigneeId !== ctx.user.id) {
      await notify(ctx.db, input.assigneeId, {
        workspaceId: workspace.id,
        type: "assigned",
        title: `You were assigned: ${updated.title}`,
        body: project.name,
        link: `/tasks/${task.id}`,
      });
    }
    return updated;
  }),

  // Drag a card on the Kanban board
  move: protectedProcedure
    .input(z.object({ taskId: z.string(), status: taskStatus, position: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { task } = await guardTask(ctx, input.taskId, "task:update");
      return ctx.db.task.update({
        where: { id: task.id },
        data: {
          status: input.status,
          position: input.position,
          completedAt: input.status === "DONE" ? new Date() : null,
        },
      });
    }),

  // Soft delete: the row stays in the database, hidden (30-day recovery later)
  delete: protectedProcedure
    .input(z.object({ taskId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { task, workspace } = await guardTask(ctx, input.taskId, "task:delete");
      await ctx.db.task.update({ where: { id: task.id }, data: { deletedAt: new Date() } });
      await log(ctx, workspace.id, "task.deleted", "Task", task.id);
      return { ok: true };
    }),

  // ───── dependencies ─────
  addDependency: protectedProcedure
    .input(z.object({
      taskId: z.string(),
      dependsOnId: z.string(),
      type: dependencyType.default("FINISH_TO_START"),
      lagDays: z.number().int().min(-365).max(365).default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const { task } = await guardTask(ctx, input.taskId, "task:update");
      if (input.taskId === input.dependsOnId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A task cannot depend on itself" });
      }
      const other = await ctx.db.task.findFirst({
        where: { id: input.dependsOnId, projectId: task.projectId, deletedAt: null },
      });
      if (!other) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found in this project" });

      // Stop circular chains: walk up from `other`; if we meet `task`, it would loop
      const seen = new Set<string>();
      let frontier = [other.id];
      while (frontier.length && seen.size < 500) {
        const next = await ctx.db.taskDependency.findMany({
          where: { taskId: { in: frontier } },
          select: { dependsOnId: true },
        });
        frontier = next.map((n) => n.dependsOnId).filter((id) => !seen.has(id));
        for (const id of frontier) seen.add(id);
        if (seen.has(task.id)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "That would create a circular dependency" });
        }
      }

      return ctx.db.taskDependency.upsert({
        where: { taskId_dependsOnId: { taskId: input.taskId, dependsOnId: input.dependsOnId } },
        update: { type: input.type, lagDays: input.lagDays },
        create: input,
      });
    }),

  removeDependency: protectedProcedure
    .input(z.object({ taskId: z.string(), dependsOnId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await guardTask(ctx, input.taskId, "task:update");
      await ctx.db.taskDependency.deleteMany({
        where: { taskId: input.taskId, dependsOnId: input.dependsOnId },
      });
      return { ok: true };
    }),

  // ───── labels ─────
  setLabels: protectedProcedure
    .input(z.object({ taskId: z.string(), labelIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const { workspace } = await guardTask(ctx, input.taskId, "task:update");
      const valid = await ctx.db.label.findMany({
        where: { id: { in: input.labelIds }, workspaceId: workspace.id },
        select: { id: true },
      });
      await ctx.db.$transaction([
        ctx.db.taskLabel.deleteMany({ where: { taskId: input.taskId } }),
        ctx.db.taskLabel.createMany({
          data: valid.map((l) => ({ taskId: input.taskId, labelId: l.id })),
        }),
      ]);
      return { ok: true };
    }),

  // ───── attachments (metadata; file upload storage comes later) ─────
  addAttachment: protectedProcedure
    .input(z.object({
      taskId: z.string(),
      fileName: z.string().min(1).max(200),
      url: z.string().url(),
      sizeBytes: z.number().int().min(0).default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      await guardTask(ctx, input.taskId, "task:update");
      return ctx.db.attachment.create({ data: { ...input, uploaderId: ctx.user.id } });
    }),

  removeAttachment: protectedProcedure
    .input(z.object({ attachmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const att = await ctx.db.attachment.findUnique({ where: { id: input.attachmentId } });
      if (!att) throw new TRPCError({ code: "NOT_FOUND" });
      await guardTask(ctx, att.taskId, "task:update");
      await ctx.db.attachment.delete({ where: { id: att.id } });
      return { ok: true };
    }),
});
