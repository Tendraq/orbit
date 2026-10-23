import { z } from "zod";
import { db } from "@orbit/db";
import { ApiError, api, findProject, paging, readJson, taskInclude, taskJson } from "@/server/public-api";
import { emit } from "@/server/events";
import { writeAudit } from "@/server/audit";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "use YYYY-MM-DD").refine((s) => !Number.isNaN(Date.parse(s)), "not a real date");
const createTask = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(10000).optional(),
  status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  startDate: date.optional(),
  dueDate: date.optional(),
  estimateHours: z.number().min(0).max(10000).optional(),
  assigneeEmail: z.string().email().optional(),
  parentId: z.string().optional(),
});

export const GET = api({}, async (c, req, p) => {
  await findProject(c, p.id);
  const u = new URL(req.url);
  const { limit, offset } = paging(req);
  const status = u.searchParams.get("status");
  const email = u.searchParams.get("assigneeEmail");
  const rows = await db.task.findMany({
    where: {
      projectId: p.id, deletedAt: null,
      ...(status ? { status: status as never } : {}),
      ...(email ? { assignee: { email: email.toLowerCase() } } : {}),
    },
    include: taskInclude, orderBy: [{ position: "asc" }, { createdAt: "asc" }], take: limit, skip: offset,
  });
  return { data: rows.map(taskJson) };
});

export const POST = api({ write: true }, async (c, req, p) => {
  const project = await findProject(c, p.id);
  const b = createTask.parse(await readJson(req));

  let assigneeId: string | null = null;
  if (b.assigneeEmail) {
    const m = await db.membership.findFirst({ where: { workspaceId: c.workspaceId, role: { not: "GUEST" }, user: { email: b.assigneeEmail.toLowerCase() } } });
    if (!m) throw new ApiError(400, "invalid_request", "assigneeEmail is not a member of this organization.");
    assigneeId = m.userId;
  }
  if (b.parentId) {
    const parent = await db.task.findFirst({ where: { id: b.parentId, projectId: project.id, deletedAt: null } });
    if (!parent) throw new ApiError(400, "invalid_request", "parentId is not a task in this project.");
  }
  const status = b.status ?? "TODO";
  const task = await db.task.create({
    data: {
      projectId: project.id, parentId: b.parentId ?? null, title: b.title, description: b.description ?? null, status, priority: b.priority ?? "MEDIUM",
      assigneeId, startDate: b.startDate ? new Date(b.startDate.slice(0, 10) + "T00:00:00Z") : null,
      dueDate: b.dueDate ? new Date(b.dueDate.slice(0, 10) + "T00:00:00Z") : null, estimateHours: b.estimateHours ?? null,
      completedAt: status === "DONE" ? new Date() : null,
    },
    include: taskInclude,
  });
  await writeAudit(db, { workspaceId: c.workspaceId, action: "task.created", entityType: "Task", entityId: task.id, metadata: { via: "api", key: c.keyPrefix } });
  await emit(db, c.workspaceId, "task.created", { title: task.title, project: project.name, by: "API", path: `/tasks/${task.id}` });
  return { data: taskJson(task) };
});
