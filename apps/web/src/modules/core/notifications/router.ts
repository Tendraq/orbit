import { z } from "zod";
import { router, protectedProcedure } from "@/server/api/trpc";

export const notificationRouter = router({
  list: protectedProcedure
    .input(z.object({ unreadOnly: z.boolean().default(false), limit: z.number().min(1).max(100).default(50) }))
    .query(({ ctx, input }) =>
      ctx.db.notification.findMany({
        where: { userId: ctx.user.id, ...(input.unreadOnly ? { readAt: null } : {}) },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      })
    ),

  unreadCount: protectedProcedure.query(({ ctx }) =>
    ctx.db.notification.count({ where: { userId: ctx.user.id, readAt: null } })
  ),

  markRead: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.db.notification.updateMany({
      where: { id: input.id, userId: ctx.user.id },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.notification.updateMany({
      where: { userId: ctx.user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }),
});
