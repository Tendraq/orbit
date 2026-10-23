import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { emit } from "@/server/events";
import { router, protectedProcedure } from "@/server/api/trpc";
import { guardTask, log } from "@/server/api/guard";
import { notify } from "@/server/notify";

export const commentRouter = router({
  list: protectedProcedure.input(z.object({ taskId: z.string() })).query(async ({ ctx, input }) => {
    await guardTask(ctx, input.taskId, "workspace:read");
    return ctx.db.comment.findMany({
      where: { taskId: input.taskId, deletedAt: null },
      include: { author: { select: { id: true, name: true, email: true, imageUrl: true } } },
      orderBy: { createdAt: "asc" },
    });
  }),

  create: protectedProcedure
    .input(z.object({ taskId: z.string(), body: z.string().min(1).max(5000) }))
    .mutation(async ({ ctx, input }) => {
      const { task, project, workspace } = await guardTask(ctx, input.taskId, "comment:create");
      const comment = await ctx.db.comment.create({
        data: { taskId: task.id, authorId: ctx.user.id, body: input.body },
      });
      await log(ctx, workspace.id, "comment.created", "Comment", comment.id);
      await emit(ctx.db, workspace.id, "comment.created", { title: task.title, project: project.name, by: ctx.user.name ?? ctx.user.email, note: input.body.slice(0, 200), path: `/tasks/${task.id}` });

      // Tell the assignee and the person who created the task
      const people = [task.assigneeId, task.reporterId].filter(
        (id): id is string => !!id && id !== ctx.user.id
      );
      for (const userId of new Set(people)) {
        await notify(ctx.db, userId, {
          workspaceId: workspace.id,
          type: "comment",
          title: `${ctx.user.name ?? "Someone"} commented on ${task.title}`,
          body: input.body.slice(0, 140),
          link: `/tasks/${task.id}`,
        });
      }
      return comment;
    }),

  delete: protectedProcedure.input(z.object({ commentId: z.string() })).mutation(async ({ ctx, input }) => {
    const comment = await ctx.db.comment.findUnique({ where: { id: input.commentId } });
    if (!comment) throw new TRPCError({ code: "NOT_FOUND" });
    const { role } = await guardTask(ctx, comment.taskId, "comment:create");
    if (comment.authorId !== ctx.user.id && role !== "OWNER" && role !== "ADMIN") {
      throw new TRPCError({ code: "FORBIDDEN", message: "You can only delete your own comments" });
    }
    await ctx.db.comment.update({ where: { id: comment.id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }),
});
