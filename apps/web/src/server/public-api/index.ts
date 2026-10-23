import { createHash } from "node:crypto";
import { ZodError } from "zod";
import { db } from "@orbit/db";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export type ApiCtx = { workspaceId: string; keyId: string; keyPrefix: string; createdById: string };

// A simple limit (120 requests a minute per key). It resets when the server restarts.
const hits = new Map<string, { n: number; reset: number }>();
function rateLimit(keyId: string) {
  const now = Date.now();
  const h = hits.get(keyId);
  if (!h || h.reset < now) { hits.set(keyId, { n: 1, reset: now + 60000 }); return; }
  if (++h.n > 120) throw new ApiError(429, "rate_limited", "Too many requests. The limit is 120 per minute.");
}

async function authenticate(req: Request, needWrite: boolean): Promise<ApiCtx> {
  const m = /^Bearer\s+(orbit_[A-Za-z0-9_-]{20,80})$/.exec(req.headers.get("authorization") ?? "");
  if (!m) throw new ApiError(401, "unauthorized", "Send your API key like this:  Authorization: Bearer orbit_...");
  const key = await db.apiKey.findUnique({ where: { keyHash: createHash("sha256").update(m[1]).digest("hex") } });
  if (!key || key.revokedAt) throw new ApiError(401, "unauthorized", "This API key is not valid.");
  if (needWrite && key.scope !== "WRITE") throw new ApiError(403, "forbidden", "This key is read-only. Create a key with write access.");
  const ws = await db.workspace.findFirst({ where: { id: key.workspaceId, deletedAt: null }, select: { id: true } });
  if (!ws) throw new ApiError(401, "unauthorized", "This API key is not valid.");
  rateLimit(key.id);
  db.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return { workspaceId: key.workspaceId, keyId: key.id, keyPrefix: key.prefix, createdById: key.createdById };
}

/** Wraps an endpoint: checks the key, handles errors, and returns JSON. */
export function api(
  opts: { write?: boolean },
  fn: (c: ApiCtx, req: Request, params: Record<string, string>) => Promise<unknown>
) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
    try {
      const c = await authenticate(req, !!opts.write);
      const result = await fn(c, req, await ctx.params);
      if (result instanceof Response) return result;
      return Response.json(result, { status: req.method === "POST" ? 201 : 200 });
    } catch (e) {
      if (e instanceof ApiError) return Response.json({ error: { code: e.code, message: e.message } }, { status: e.status });
      if (e instanceof ZodError) {
        return Response.json({ error: { code: "invalid_request", message: e.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ") } }, { status: 400 });
      }
      console.error("API error", e);
      return Response.json({ error: { code: "server_error", message: "Something went wrong on our side." } }, { status: 500 });
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try { return await req.json(); } catch { throw new ApiError(400, "invalid_json", "The request body must be valid JSON."); }
}

export function paging(req: Request) {
  const u = new URL(req.url);
  const limit = Math.min(500, Math.max(1, Number(u.searchParams.get("limit")) || 100));
  const offset = Math.max(0, Number(u.searchParams.get("offset")) || 0);
  return { limit, offset };
}

export async function findProject(c: ApiCtx, id: string) {
  const p = await db.project.findFirst({ where: { id, workspaceId: c.workspaceId, deletedAt: null } });
  if (!p) throw new ApiError(404, "not_found", "Project not found.");
  return p;
}

export const projectJson = (p: Awaited<ReturnType<typeof findProject>>) => ({
  id: p.id, name: p.name, code: p.code, description: p.description, phase: p.phase, status: p.status, health: p.health,
  currency: p.currency, startDate: p.startDate, endDate: p.endDate, createdAt: p.createdAt, updatedAt: p.updatedAt,
});

export const taskInclude = {
  assignee: { select: { id: true, name: true, email: true } },
  labels: { include: { label: { select: { name: true } } } },
  dependencies: { select: { dependsOnId: true, type: true, lagDays: true } },
} as const;

type TaskRow = {
  id: string; projectId: string; parentId: string | null; title: string; description: string | null; status: string; priority: string;
  startDate: Date | null; dueDate: Date | null; completedAt: Date | null; estimateHours: number | null; createdAt: Date; updatedAt: Date;
  assignee: { id: string; name: string | null; email: string } | null;
  labels: { label: { name: string } }[]; dependencies: { dependsOnId: string; type: string; lagDays: number }[];
};
export const taskJson = (t: TaskRow) => ({
  id: t.id, projectId: t.projectId, parentId: t.parentId, title: t.title, description: t.description, status: t.status, priority: t.priority,
  assignee: t.assignee, startDate: t.startDate, dueDate: t.dueDate, completedAt: t.completedAt, estimateHours: t.estimateHours,
  labels: t.labels.map((l) => l.label.name), dependsOn: t.dependencies, createdAt: t.createdAt, updatedAt: t.updatedAt,
});
