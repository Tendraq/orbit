import { db } from "@orbit/db";
import { getCurrentUser } from "@/server/auth";
import { can } from "@/config/permissions";
import { buildReportData, renderReportHtml } from "@/modules/ngo/donor-reports/service";

// Opens a clean, printable donor report. Use the browser's "Print > Save as PDF".
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Please sign in", { status: 401 });

  const report = await db.donorReport.findUnique({ where: { id }, include: { project: true } });
  if (!report) return new Response("Not found", { status: 404 });

  const membership = await db.membership.findFirst({
    where: { userId: user.id, workspaceId: report.project.workspaceId },
  });
  if (!membership || !can(membership.role, "workspace:read")) {
    return new Response("Not allowed", { status: 403 });
  }

  const data = await buildReportData(db, report.projectId, report.periodStart, report.periodEnd);
  return new Response(renderReportHtml(report, data), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
