import { z } from "zod";
import { db } from "@orbit/db";
import { ApiError, api, readJson, taskInclude, taskJson } from "@/server/public-api";
import { emit } from "@/server/events";
import { writeAudit } from "@/server/audit";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "use YYYY-MM-DD").refine((s) => !Number.isNaN(Date.parse(s)), "not a real date");
const patch = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(10000).nullable().optional(),
  status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  startDate: date.nullable().optional(),
  dueDate: date.nullable().optional(),
  estimateHours: z.number().min(0).max(10000).nullable().optional(),
  assigneeEmail: z.string().email().nullable().optional(),
});

async function load(workspaceId: string, id: string) {
  const t = await db.task.findFirst({ where: { id, deletedAt: null, project: { workspaceId, deletedAt: null } }, include: { ...taskInclude, project: { select: { name: true } } } });
  if (!t) throw new ApiError(404, "not_found", "Task not found.");
  return t;
}
const toDate = (s: string | null | undefined) => (s === undefined ? undefined : s === null ? null : new Date(s.slice(0, 10) + "T00:00:00Z"));

export const GET = api({}, async (c, _req, p) => ({ data: taskJson(await load(c.workspaceId, p.id)) }));

export const PATCH = api({ write: true }, async (c, req, p) => {
  const before = await load(c.workspaceId, p.id);
  const b = patch.parse(await readJson(req));

  let assigneeId: string | null | undefined;
  if (b.assigneeEmail !== undefined) {
    if (b.assigneeEmail === null) assigneeId = null;
    else {
      const m = await db.membership.findFirst({ where: { workspaceId: c.workspaceId, role: { not: "GUEST" }, user: { email: b.assigneeEmail.toLowerCase() } } });
      if (!m) throw new ApiError(400, "invalid_request", "assigneeEmail is not a member of this organization.");
      assigneeId = m.userId;
    }
  }
  const { assigneeEmail: _e, startDate, dueDate, status, ...rest } = b;
  const task = await db.task.update({
    where: { id: before.id },
    data: {
      ...rest, assigneeId, startDate: toDate(startDate), dueDate: toDate(dueDate),
      ...(status ? { status, completedAt: status === "DONE" ? new Date() : null } : {}),
    },
    include: taskInclude,
  });
  await writeAudit(db, { workspaceId: c.workspaceId, action: "task.updated", entityType: "Task", entityId: task.id, metadata: { via: "api", key: c.keyPrefix } });
  await emit(db, c.workspaceId, status === "DONE" && before.status !== "DONE" ? "task.completed" : "task.updated", { title: task.title, project: before.project.name, by: "API", path: `/tasks/${task.id}` });
  return { data: taskJson(task) };
});
