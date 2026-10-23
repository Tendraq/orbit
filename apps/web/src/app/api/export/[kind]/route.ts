import { db } from "@orbit/db";
import { getCurrentUser } from "@/server/auth";
import { can } from "@/config/permissions";
import { buildExport, EXPORT_KINDS, EXPORT_MODULE, type ExportKind } from "@/modules/data-exchange/service";

// Downloads: /api/export/<tasks|expenses|budget|indicators|risks|time|msproject|ics>?projectId=...
export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!(EXPORT_KINDS as readonly string[]).includes(kind)) return new Response("Unknown download type", { status: 404 });
  const projectId = new URL(req.url).searchParams.get("projectId");
  if (!projectId) return new Response("projectId is required", { status: 400 });

  const user = await getCurrentUser();
  if (!user) return new Response("Please sign in", { status: 401 });

  const project = await db.project.findFirst({ where: { id: projectId, deletedAt: null }, include: { workspace: true } });
  if (!project) return new Response("Not found", { status: 404 });
  const membership = await db.membership.findFirst({ where: { userId: user.id, workspaceId: project.workspaceId } });
  if (!membership || !can(membership.role, "workspace:read")) return new Response("Not allowed", { status: 403 });

  const needed = EXPORT_MODULE[kind as ExportKind];
  if (needed && !project.workspace.enabledModules.includes(needed)) return new Response("This module is switched off", { status: 403 });

  const out = await buildExport(db, kind as ExportKind, project, (process.env.APP_URL ?? "").replace(/\/$/, ""), project.workspace.slug);
  return new Response(out.body, {
    headers: { "Content-Type": out.contentType, "Content-Disposition": `attachment; filename="${out.filename}"`, "Cache-Control": "no-store" },
  });
}
