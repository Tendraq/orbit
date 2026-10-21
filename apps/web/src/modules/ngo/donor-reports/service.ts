import type { PrismaClient } from "@orbit/db";
import { budgetSummary } from "@/modules/budget/service";
import { indicatorProgress, averageProgress } from "@/modules/ngo/indicators/service";

// Collects everything a donor report needs for a period.
export async function buildReportData(db: PrismaClient, projectId: string, start: Date, end: Date) {
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });

  const [completed, inProgress, milestones, risks, openChanges, indicators, budget] = await Promise.all([
    db.task.findMany({
      where: { projectId, deletedAt: null, completedAt: { gte: start, lte: end } },
      select: { id: true, title: true, completedAt: true },
      orderBy: { completedAt: "asc" },
    }),
    db.task.count({ where: { projectId, deletedAt: null, status: { in: ["IN_PROGRESS", "IN_REVIEW"] } } }),
    db.milestone.findMany({
      where: { projectId, dueDate: { gte: start, lte: end } },
      orderBy: { dueDate: "asc" },
    }),
    db.risk.findMany({ where: { projectId, status: { in: ["OPEN", "MITIGATING"] } } }),
    db.changeRequest.findMany({
      where: { projectId, decidedAt: { gte: start, lte: end } },
      select: { title: true, status: true, costImpact: true, scheduleImpactDays: true },
    }),
    indicatorProgress(db, projectId),
    budgetSummary(db, projectId),
  ]);

  const topRisks = risks
    .map((r) => ({ title: r.title, score: r.probability * r.impact, response: r.response }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return {
    project,
    period: { start, end },
    tasks: { completed, inProgress },
    milestones,
    topRisks,
    changes: openChanges,
    indicators,
    indicatorAverage: averageProgress(indicators),
    budget,
  };
}

export type ReportData = Awaited<ReturnType<typeof buildReportData>>;

const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
const money = (n: number, cur: string) => `${n.toLocaleString("en-US", { maximumFractionDigits: 0 })} ${cur}`;

// A starting draft the team edits, so nobody writes from a blank page.
export function draftNarrative(d: ReportData) {
  const cur = d.project.currency;
  const lines: string[] = [];
  lines.push(`Reporting period: ${fmtDate(d.period.start)} to ${fmtDate(d.period.end)}.`);
  lines.push("");
  lines.push("PROGRESS");
  lines.push(
    `During this period the team completed ${d.tasks.completed.length} task(s); ${d.tasks.inProgress} more are in progress.`
  );
  if (d.milestones.length) {
    const reached = d.milestones.filter((m) => m.doneAt).length;
    lines.push(`${reached} of ${d.milestones.length} milestone(s) due in the period were reached.`);
  }
  if (d.indicators.length) {
    lines.push("");
    lines.push("RESULTS");
    lines.push(`Average progress toward indicator targets is ${d.indicatorAverage ?? 0}%.`);
    for (const i of d.indicators) {
      lines.push(
        `- ${i.name}: ${i.latestValue ?? "no data yet"} ${i.unit} (target ${i.target}, ${i.progressPct}%)`
      );
    }
  }
  lines.push("");
  lines.push("FINANCE");
  lines.push(
    `${money(d.budget.totalSpent, cur)} spent of ${money(d.budget.totalPlanned, cur)} budgeted (${d.budget.burnPct}%).`
  );
  if (d.topRisks.length) {
    lines.push("");
    lines.push("RISKS");
    for (const r of d.topRisks) lines.push(`- ${r.title} (score ${r.score})${r.response ? `: ${r.response}` : ""}`);
  }
  if (d.changes.length) {
    lines.push("");
    lines.push("CHANGES APPROVED OR REJECTED");
    for (const c of d.changes) lines.push(`- ${c.title}: ${c.status}`);
  }
  lines.push("");
  lines.push("CHALLENGES AND NEXT STEPS");
  lines.push("(Add your own notes here.)");
  return lines.join("\n");
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// A clean printable page. Open it and use "Print > Save as PDF".
export function renderReportHtml(
  report: { title: string; narrative: string; periodStart: Date; periodEnd: Date; status: string },
  d: ReportData
) {
  const cur = d.project.currency;
  const rows = (items: string[][], head: string[]) =>
    `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${items
      .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
      .join("")}</tbody></table>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(report.title)}</title>
<style>
body{font:14px/1.5 system-ui,sans-serif;max-width:820px;margin:32px auto;padding:0 16px;color:#0f172a}
h1{font-size:24px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 8px;border-bottom:1px solid #e2e8f0;padding-bottom:4px}
table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left}
th{background:#f1f5f9}.muted{color:#64748b}pre{white-space:pre-wrap;font:inherit}
@media print{body{margin:0}}
</style></head><body>
<h1>${esc(report.title)}</h1>
<p class="muted">${esc(d.project.name)} · ${fmtDate(report.periodStart)} to ${fmtDate(report.periodEnd)} · Status: ${esc(report.status)}</p>
<h2>Narrative</h2><pre>${esc(report.narrative)}</pre>
<h2>Indicator results</h2>
${d.indicators.length
  ? rows(
      d.indicators.map((i) => [i.name, `${i.baseline}`, `${i.target}`, i.latestValue === null ? "—" : `${i.latestValue}`, `${i.progressPct}%`]),
      ["Indicator", "Baseline", "Target", "Latest", "Progress"]
    )
  : "<p class='muted'>No indicators defined.</p>"}
<h2>Budget</h2>
${rows(
  [
    ...d.budget.lines.map((l) => [l.category, money(l.planned, cur), money(l.spent, cur), money(l.remaining, cur), `${l.burnPct}%`]),
    ["TOTAL", money(d.budget.totalPlanned, cur), money(d.budget.totalSpent, cur), money(d.budget.remaining, cur), `${d.budget.burnPct}%`],
  ],
  ["Budget line", "Planned", "Spent", "Remaining", "Used"]
)}
<h2>Tasks completed in the period</h2>
${d.tasks.completed.length ? `<ul>${d.tasks.completed.map((t) => `<li>${esc(t.title)}</li>`).join("")}</ul>` : "<p class='muted'>None.</p>"}
</body></html>`;
}
