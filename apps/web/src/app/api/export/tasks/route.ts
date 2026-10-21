import { db } from "@orbit/db";
import { getCurrentUser } from "@/server/auth";
import { can } from "@/config/permissions";

// Downloads a project's tasks as a CSV file (opens in Excel).
// Use:  /api/export/tasks?projectId=...
export async function GET(req: Request) {
  const projectId = new URL(req.url).searchParams.get("projectId");
  if (!projectId) return new Response("projectId is required", { status: 400 });

  const user = await getCurrentUser();
  if (!user) return new Response("Please sign in", { status: 401 });

  const project = await db.project.findFirst({ where: { id: projectId, deletedAt: null } });
  if (!project) return new Response("Not found", { status: 404 });

  const membership = await db.membership.findFirst({
    where: { userId: user.id, workspaceId: project.workspaceId },
  });
  if (!membership || !can(membership.role, "workspace:read")) {
    return new Response("Not allowed", { status: 403 });
  }

  const tasks = await db.task.findMany({
    where: { projectId, deletedAt: null },
    include: { assignee: { select: { name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
  const header = ["Title", "Status", "Priority", "Assignee", "Start", "Due", "Estimate (h)", "Parent task"];
  const lines = [
    header.map(cell).join(","),
    ...tasks.map((t) =>
      [
        t.title, t.status, t.priority,
        t.assignee?.name ?? t.assignee?.email ?? "",
        day(t.startDate), day(t.dueDate), t.estimateHours ?? "",
        t.parentId ? "yes" : "",
      ].map(cell).join(",")
    ),
  ];

  return new Response("\uFEFF" + lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${project.name.replace(/[^a-z0-9]+/gi, "-")}-tasks.csv"`,
    },
  });
}
