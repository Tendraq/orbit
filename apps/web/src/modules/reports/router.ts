import { z } from "zod";
import { router, protectedProcedure } from "@/server/api/trpc";
import { guardProject, guardWorkspace } from "@/server/api/guard";
import { budgetSummary } from "@/modules/budget/service";
import { indicatorProgress, averageProgress } from "@/modules/ngo/indicators/service";

type Health = "GREEN" | "AMBER" | "RED";

// A suggestion, not a verdict: the project manager still sets the final health.
function suggestHealth(input: {
  overdueRatio: number;
  budgetBurnPct: number | null;
  progressPct: number;
  topRiskScore: number;
}) {
  const reasons: string[] = [];
  let level: Health = "GREEN";
  const raise = (to: Health, why: string) => {
    reasons.push(why);
    if (to === "RED" || (to === "AMBER" && level === "GREEN")) level = to;
  };

  if (input.overdueRatio > 0.25) raise("RED", "More than 25% of open tasks are overdue");
  else if (input.overdueRatio > 0.1) raise("AMBER", "More than 10% of open tasks are overdue");

  if (input.budgetBurnPct !== null) {
    if (input.budgetBurnPct > 100) raise("RED", "Spending is over budget");
    else if (input.budgetBurnPct > 85) raise("AMBER", "More than 85% of the budget is spent");
    if (input.budgetBurnPct - input.progressPct > 25) {
      raise("AMBER", "Spending is running well ahead of task progress");
    }
  }
  if (input.topRiskScore >= 20) raise("RED", "A critical risk is open");
  else if (input.topRiskScore >= 12) raise("AMBER", "A high risk is open");

  return { level, reasons };
}

export const reportRouter = router({
  // Everything the project overview page needs
  projectDashboard: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { project, workspace } = await guardProject(ctx, input.projectId, "workspace:read");
      const has = (m: string) => workspace.enabledModules.includes(m);
      const now = new Date();
      const weekAhead = new Date(now.getTime() + 7 * 86400000);
      const open = { projectId: input.projectId, deletedAt: null, status: { not: "DONE" as const } };

      const [byStatus, overdue, dueSoon, unassigned, milestones] = await Promise.all([
        ctx.db.task.groupBy({
          by: ["status"],
          where: { projectId: input.projectId, deletedAt: null },
          _count: { _all: true },
        }),
        ctx.db.task.count({ where: { ...open, dueDate: { lt: now } } }),
        ctx.db.task.count({ where: { ...open, dueDate: { gte: now, lte: weekAhead } } }),
        ctx.db.task.count({ where: { ...open, assigneeId: null } }),
        ctx.db.milestone.findMany({
          where: { projectId: input.projectId },
          orderBy: { dueDate: "asc" },
          take: 6,
        }),
      ]);

      const counts = Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])) as Record<string, number>;
      const total = byStatus.reduce((n, s) => n + s._count._all, 0);
      const done = counts.DONE ?? 0;
      const progressPct = total ? Math.round((done / total) * 100) : 0;
      const openCount = total - done;

      const budget = has("budget") ? await budgetSummary(ctx.db, input.projectId) : null;

      let topRisks: { id: string; title: string; score: number; status: string }[] = [];
      let openIssues = 0;
      if (has("risks")) {
        const risks = await ctx.db.risk.findMany({
          where: { projectId: input.projectId, status: { in: ["OPEN", "MITIGATING"] } },
        });
        topRisks = risks
          .map((r) => ({ id: r.id, title: r.title, score: r.probability * r.impact, status: r.status }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);
        openIssues = await ctx.db.issue.count({
          where: { projectId: input.projectId, status: { in: ["OPEN", "IN_PROGRESS"] } },
        });
      }

      const pendingChanges = has("changes")
        ? await ctx.db.changeRequest.count({ where: { projectId: input.projectId, status: "SUBMITTED" } })
        : 0;

      const indicators = has("ngo") ? await indicatorProgress(ctx.db, input.projectId) : [];

      const suggested = suggestHealth({
        overdueRatio: openCount ? overdue / openCount : 0,
        budgetBurnPct: budget && budget.totalPlanned > 0 ? budget.burnPct : null,
        progressPct,
        topRiskScore: topRisks[0]?.score ?? 0,
      });

      return {
        project: {
          id: project.id,
          name: project.name,
          phase: project.phase,
          status: project.status,
          health: project.health,
          currency: project.currency,
          startDate: project.startDate,
          endDate: project.endDate,
        },
        tasks: { total, done, progressPct, byStatus: counts, overdue, dueSoon, unassigned },
        milestones,
        budget,
        topRisks,
        openIssues,
        pendingChanges,
        indicators: { count: indicators.length, averageProgress: averageProgress(indicators) },
        suggestedHealth: suggested,
        modules: workspace.enabledModules,
      };
    }),

  // What needs this person's attention, across every organization they belong to
  attention: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.db.membership.findMany({
      where: { userId: ctx.user.id, workspace: { deletedAt: null } },
      include: { workspace: { select: { id: true, slug: true, name: true } } },
    });
    const wsIds = memberships.map((m) => m.workspaceId);
    const approverWs = memberships.filter((m) => m.role === "OWNER" || m.role === "ADMIN").map((m) => m.workspaceId);
    const slugOf = new Map(memberships.map((m) => [m.workspaceId, m.workspace.slug]));
    const now = new Date();
    const in14 = new Date(now.getTime() + 14 * 86400000);
    const proj = { select: { id: true, name: true, currency: true, workspaceId: true } } as const;
    const asApprover = { workspaceId: { in: approverWs }, deletedAt: null };
    const asMember = { workspaceId: { in: wsIds }, deletedAt: null };

    const [gates, changes, expenses, overdue, milestones, atRisk, projectCount, taskCount, peopleCount, inviteCount, approvedGates] =
      await Promise.all([
        ctx.db.stageGate.findMany({ where: { status: "SUBMITTED", project: asApprover }, include: { project: proj }, take: 20 }),
        ctx.db.changeRequest.findMany({ where: { status: "SUBMITTED", project: asApprover }, include: { project: proj }, take: 20 }),
        ctx.db.expense.findMany({ where: { status: "PENDING", project: asApprover }, include: { project: proj }, take: 20 }),
        ctx.db.task.findMany({
          where: { assigneeId: ctx.user.id, status: { not: "DONE" }, deletedAt: null, dueDate: { lt: now }, project: asMember },
          include: { project: proj }, orderBy: { dueDate: "asc" }, take: 10,
        }),
        ctx.db.milestone.findMany({
          where: { doneAt: null, dueDate: { gte: now, lte: in14 }, project: asMember },
          include: { project: proj }, orderBy: { dueDate: "asc" }, take: 10,
        }),
        ctx.db.project.findMany({ where: { ...asMember, status: "ACTIVE", health: "RED" }, select: proj.select, take: 10 }),
        ctx.db.project.count({ where: asMember }),
        ctx.db.task.count({ where: { deletedAt: null, project: asMember } }),
        ctx.db.membership.count({ where: { workspaceId: { in: wsIds } } }),
        ctx.db.invitation.count({ where: { workspaceId: { in: wsIds } } }),
        ctx.db.stageGate.count({ where: { status: "APPROVED", project: asMember } }),
      ]);

    const slug = (workspaceId: string) => slugOf.get(workspaceId) ?? "";
    const withSlug = <T extends { project: { workspaceId: string } }>(rows: T[]) =>
      rows.map((r) => ({ ...r, slug: slug(r.project.workspaceId) }));

    return {
      firstSlug: memberships[0]?.workspace.slug ?? null,
      gates: withSlug(gates),
      changes: withSlug(changes),
      expenses: withSlug(expenses),
      overdue: withSlug(overdue),
      milestones: withSlug(milestones),
      atRisk: atRisk.map((p) => ({ ...p, slug: slug(p.workspaceId) })),
      approvalsCount: gates.length + changes.length + expenses.length,
      // used by the getting-started checklist
      steps: {
        organization: wsIds.length > 0,
        project: projectCount > 0,
        tasks: taskCount > 0,
        teammate: peopleCount > wsIds.length || inviteCount > 0,
        gate: approvedGates > 0,
      },
    };
  }),

  // Everything waiting for an owner or admin to decide in one organization
  approvals: protectedProcedure
    .input(z.object({ workspaceSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const { workspace } = await guardWorkspace(ctx, input.workspaceSlug, "gate:approve");
      const scope = { workspaceId: workspace.id, deletedAt: null };
      const proj = { select: { id: true, name: true, currency: true } } as const;
      const [gates, changes, expenses, reports] = await Promise.all([
        ctx.db.stageGate.findMany({ where: { status: "SUBMITTED", project: scope }, include: { project: proj }, orderBy: { submittedAt: "asc" } }),
        ctx.db.changeRequest.findMany({ where: { status: "SUBMITTED", project: scope }, include: { project: proj }, orderBy: { createdAt: "asc" } }),
        ctx.db.expense.findMany({
          where: { status: "PENDING", project: scope },
          include: { project: proj, budgetLine: { select: { category: true } } },
          orderBy: { date: "asc" },
        }),
        workspace.enabledModules.includes("ngo")
          ? ctx.db.donorReport.findMany({ where: { status: "SUBMITTED", project: scope }, include: { project: proj }, orderBy: { updatedAt: "asc" } })
          : Promise.resolve([]),
      ]);
      return { gates, changes, expenses, reports, total: gates.length + changes.length + expenses.length + reports.length };
    }),

  // All projects of an organization on one screen
  portfolio: protectedProcedure
    .input(z.object({ workspaceSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const { workspace } = await guardWorkspace(ctx, input.workspaceSlug, "workspace:read");
      const projects = await ctx.db.project.findMany({
        where: { workspaceId: workspace.id, deletedAt: null },
        orderBy: { createdAt: "desc" },
      });
      const ids = projects.map((p) => p.id);
      const now = new Date();

      const [byStatus, overdue, planned, spent] = await Promise.all([
        ctx.db.task.groupBy({
          by: ["projectId", "status"],
          where: { projectId: { in: ids }, deletedAt: null },
          _count: { _all: true },
        }),
        ctx.db.task.groupBy({
          by: ["projectId"],
          where: { projectId: { in: ids }, deletedAt: null, status: { not: "DONE" }, dueDate: { lt: now } },
          _count: { _all: true },
        }),
        ctx.db.budgetLine.groupBy({ by: ["projectId"], where: { projectId: { in: ids } }, _sum: { planned: true } }),
        ctx.db.expense.groupBy({
          by: ["projectId"],
          where: { projectId: { in: ids }, status: "APPROVED" },
          _sum: { amount: true },
        }),
      ]);

      return projects.map((p) => {
        const mine = byStatus.filter((s) => s.projectId === p.id);
        const total = mine.reduce((n, s) => n + s._count._all, 0);
        const done = mine.find((s) => s.status === "DONE")?._count._all ?? 0;
        const pl = planned.find((x) => x.projectId === p.id)?._sum.planned ?? 0;
        const sp = spent.find((x) => x.projectId === p.id)?._sum.amount ?? 0;
        return {
          id: p.id,
          name: p.name,
          code: p.code,
          phase: p.phase,
          status: p.status,
          health: p.health,
          currency: p.currency,
          endDate: p.endDate,
          taskTotal: total,
          taskDone: done,
          progressPct: total ? Math.round((done / total) * 100) : 0,
          overdue: overdue.find((x) => x.projectId === p.id)?._count._all ?? 0,
          planned: pl,
          spent: sp,
          burnPct: pl > 0 ? Math.round((sp / pl) * 100) : null,
        };
      });
    }),
});
