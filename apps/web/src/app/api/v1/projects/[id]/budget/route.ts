import { api, findProject } from "@/server/public-api";
import { budgetSummary } from "@/modules/budget/service";
import { db } from "@orbit/db";

export const GET = api({}, async (c, _req, p) => {
  const project = await findProject(c, p.id);
  const b = await budgetSummary(db, p.id);
  return {
    data: {
      currency: project.currency, planned: b.totalPlanned, spent: b.totalSpent, pending: b.totalPending, remaining: b.remaining, usedPercent: b.burnPct,
      lines: b.lines.map((l) => ({ id: l.id, category: l.category, planned: l.planned, spent: l.spent, pending: l.pending, remaining: l.remaining, usedPercent: l.burnPct })),
    },
  };
});
