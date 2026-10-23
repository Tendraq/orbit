import { db } from "@orbit/db";
import { buildIcs, type IcsEvent } from "@/modules/data-exchange/ics";

// A private calendar feed: /api/calendar/<secret>.ics
//   ?scope=all      everything in your organizations (default: only your own tasks)
//   ?project=<id>   one project only
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token.replace(/\.ics$/i, "");
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) return new Response("Not found", { status: 404 });
  const user = await db.user.findUnique({ where: { calendarToken: token } });
  if (!user) return new Response("Not found", { status: 404 });

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") === "all" ? "all" : "me";
  const projectId = url.searchParams.get("project");
  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");

  const memberships = await db.membership.findMany({
    where: { userId: user.id, workspace: { deletedAt: null } },
    select: { workspaceId: true },
  });
  const project = { workspaceId: { in: memberships.map((m) => m.workspaceId) }, deletedAt: null, ...(projectId ? { id: projectId } : {}) };
  const since = new Date(Date.now() - 30 * 86400000);

  const [tasks, milestones] = await Promise.all([
    db.task.findMany({
      where: {
        deletedAt: null, status: { not: "DONE" }, project,
        ...(scope === "me" ? { assigneeId: user.id } : {}),
        OR: [{ dueDate: { gte: since } }, { startDate: { gte: since } }],
      },
      include: { project: { select: { name: true, workspace: { select: { slug: true } } } } },
      orderBy: { dueDate: "asc" }, take: 1000,
    }),
    db.milestone.findMany({
      where: { doneAt: null, dueDate: { gte: since }, project },
      include: { project: { select: { id: true, name: true, workspace: { select: { slug: true } } } } },
      orderBy: { dueDate: "asc" }, take: 500,
    }),
  ]);

  const events: IcsEvent[] = [
    ...tasks.map((t) => ({
      uid: `task-${t.id}@orbit`, title: t.title,
      description: `${t.project.name} · ${t.status.replace("_", " ").toLowerCase()}${t.description ? `\n${t.description.slice(0, 300)}` : ""}`,
      start: (t.startDate ?? t.dueDate)!, end: t.dueDate ?? undefined, categories: [t.project.name],
      url: appUrl ? `${appUrl}/tasks/${t.id}` : undefined,
    })),
    ...milestones.map((m) => ({
      uid: `milestone-${m.id}@orbit`, title: `Milestone: ${m.name}`, description: m.project.name, start: m.dueDate, categories: [m.project.name],
      url: appUrl ? `${appUrl}/${m.project.workspace.slug}/projects/${m.project.id}/overview` : undefined,
    })),
  ];

  return new Response(buildIcs(scope === "all" ? "Orbit: all work" : "Orbit: my work", events), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=300", "Content-Disposition": 'inline; filename="orbit.ics"' },
  });
}
