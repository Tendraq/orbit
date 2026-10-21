import { z } from "zod";
import { router, protectedProcedure } from "@/server/api/trpc";
import { guardWorkspace } from "@/server/api/guard";

// Simple "contains" search. Later this can move to Postgres full-text or Meilisearch.
export const searchRouter = router({
  query: protectedProcedure
    .input(z.object({ workspaceSlug: z.string(), q: z.string().min(2).max(100) }))
    .query(async ({ ctx, input }) => {
      const { workspace } = await guardWorkspace(ctx, input.workspaceSlug, "workspace:read");
      const contains = { contains: input.q, mode: "insensitive" as const };

      const [projects, tasks, documents] = await Promise.all([
        ctx.db.project.findMany({
          where: { workspaceId: workspace.id, deletedAt: null, OR: [{ name: contains }, { description: contains }] },
          select: { id: true, name: true, phase: true },
          take: 10,
        }),
        ctx.db.task.findMany({
          where: {
            deletedAt: null,
            project: { workspaceId: workspace.id, deletedAt: null },
            OR: [{ title: contains }, { description: contains }],
          },
          select: { id: true, title: true, status: true, project: { select: { id: true, name: true } } },
          take: 20,
        }),
        workspace.enabledModules.includes("documents")
          ? ctx.db.document.findMany({
              where: {
                project: { workspaceId: workspace.id, deletedAt: null },
                OR: [{ title: contains }, { content: contains }],
              },
              select: { id: true, title: true, kind: true, project: { select: { id: true, name: true } } },
              take: 10,
            })
          : Promise.resolve([]),
      ]);
      return { projects, tasks, documents };
    }),

  // Feeds the Ctrl+K command palette: every project the person can open
  palette: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.project.findMany({
      where: {
        deletedAt: null,
        workspace: { deletedAt: null, memberships: { some: { userId: ctx.user.id } } },
      },
      select: { id: true, name: true, code: true, workspace: { select: { slug: true, name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    return rows.map((p) => ({ id: p.id, name: p.name, code: p.code, slug: p.workspace.slug, workspaceName: p.workspace.name }));
  }),
});
