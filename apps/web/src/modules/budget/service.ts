import type { PrismaClient } from "@orbit/db";

// Planned vs. actual spending for a project. Used by the budget page,
// the dashboard, the portfolio and donor reports.
export async function budgetSummary(db: PrismaClient, projectId: string) {
  const [lines, grouped] = await Promise.all([
    db.budgetLine.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    db.expense.groupBy({
      by: ["budgetLineId", "status"],
      where: { projectId, status: { not: "REJECTED" } },
      _sum: { amount: true },
    }),
  ]);

  const sum = (lineId: string | null, status: "APPROVED" | "PENDING") =>
    grouped
      .filter((g) => g.budgetLineId === lineId && g.status === status)
      .reduce((n, g) => n + (g._sum.amount ?? 0), 0);

  const rows = lines.map((l) => {
    const spent = sum(l.id, "APPROVED");
    const pending = sum(l.id, "PENDING");
    return {
      ...l,
      spent,
      pending,
      remaining: l.planned - spent,
      burnPct: l.planned > 0 ? Math.round((spent / l.planned) * 100) : 0,
    };
  });

  const unassignedSpent = sum(null, "APPROVED");
  const unassignedPending = sum(null, "PENDING");
  const totalPlanned = rows.reduce((n, r) => n + r.planned, 0);
  const totalSpent = rows.reduce((n, r) => n + r.spent, 0) + unassignedSpent;
  const totalPending = rows.reduce((n, r) => n + r.pending, 0) + unassignedPending;

  return {
    lines: rows,
    unassignedSpent,
    totalPlanned,
    totalSpent,
    totalPending,
    remaining: totalPlanned - totalSpent,
    burnPct: totalPlanned > 0 ? Math.round((totalSpent / totalPlanned) * 100) : 0,
  };
}
