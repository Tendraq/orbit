import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@orbit/db";
import { STATUS_LABELS } from "@/config";
import { budgetSummary } from "@/modules/budget/service";
import { indicatorProgress } from "@/modules/ngo/indicators/service";
import { parseCsv, toCsv, type Cell } from "./csv";
import { buildIcs, type IcsEvent } from "./ics";
import { planFromMsProject, toMsProjectXml } from "./mspdi";
import { detectColumns, planFromRows, type ImportPlan } from "./plan";
import { readXlsx } from "./xlsx";

export type ImportFormat = "csv" | "xlsx" | "msproject";

// ───────────────────────── reading a file ─────────────────────────
export function parseImport(format: ImportFormat, data: string, dayFirst: boolean) {
  if (format === "msproject") {
    const r = planFromMsProject(data);
    return { plan: r.plan, projectName: r.projectName as string | undefined, columns: [] as string[] };
  }
  const rows = format === "csv" ? parseCsv(data) : readXlsx(Buffer.from(data, "base64"));
  const found = detectColumns(rows[0] ?? []);
  const columns = Object.values(found).map((i) => (rows[0][i] ?? "").trim()).filter(Boolean);
  return { plan: planFromRows(rows, { dayFirst }), projectName: undefined as string | undefined, columns };
}

const LABEL_COLORS = ["#6a3eea", "#16a34a", "#d97706", "#0ea5e9", "#ec4899", "#64748b"];
const day = (s: string) => new Date(`${s}T00:00:00Z`);
const chunk = <T,>(a: T[], n = 500) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

type Member = { id: string; email: string; name: string | null };
async function loadMembers(db: PrismaClient, workspaceId: string): Promise<Member[]> {
  const rows = await db.membership.findMany({
    where: { workspaceId, role: { not: "GUEST" } },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  return rows.map((r) => r.user);
}
function matchPerson(members: Member[], who: string | undefined): string | null {
  if (!who) return null;
  const w = who.trim().toLowerCase();
  return members.find((m) => m.email.toLowerCase() === w)?.id ?? members.find((m) => (m.name ?? "").toLowerCase() === w)?.id ?? null;
}

// ───────────────────────── preview ─────────────────────────
export async function describePlan(db: PrismaClient, p: { workspaceId: string; projectId: string; plan: ImportPlan; skipExisting: boolean }) {
  const [members, existing] = await Promise.all([
    loadMembers(db, p.workspaceId),
    db.task.findMany({ where: { projectId: p.projectId, deletedAt: null }, select: { title: true } }),
  ]);
  const have = new Set(existing.map((t) => t.title.toLowerCase()));
  const byRef = new Map(p.plan.tasks.map((t) => [t.ref, t]));
  const alreadyThere = p.skipExisting ? p.plan.tasks.filter((t) => have.has(t.title.toLowerCase())).length : 0;
  const unmatched = [...new Set(p.plan.tasks.map((t) => t.assignee).filter((a): a is string => !!a && !matchPerson(members, a)))];
  return {
    counts: {
      tasks: p.plan.tasks.filter((t) => !t.parentRef).length,
      subtasks: p.plan.tasks.filter((t) => t.parentRef).length,
      dependencies: p.plan.dependencies.length,
      milestones: p.plan.milestones.length,
      alreadyThere,
    },
    sample: p.plan.tasks.slice(0, 12).map((t) => ({
      title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate ?? null,
      parent: t.parentRef ? byRef.get(t.parentRef)?.title ?? null : null, assignee: t.assignee ?? null,
    })),
    warnings: p.plan.warnings.slice(0, 12),
    moreWarnings: Math.max(0, p.plan.warnings.length - 12),
    unmatchedAssignees: unmatched.slice(0, 10),
  };
}

// ───────────────────────── saving ─────────────────────────
export async function commitPlan(
  db: PrismaClient,
  a: { workspaceId: string; projectId: string; userId: string; plan: ImportPlan; skipExisting: boolean; importMilestones: boolean }
) {
  const { plan } = a;
  const [members, existing, labelRows, maxPos, existingMs] = await Promise.all([
    loadMembers(db, a.workspaceId),
    db.task.findMany({ where: { projectId: a.projectId, deletedAt: null }, select: { id: true, title: true } }),
    db.label.findMany({ where: { workspaceId: a.workspaceId } }),
    db.task.aggregate({ where: { projectId: a.projectId }, _max: { position: true } }),
    db.milestone.findMany({ where: { projectId: a.projectId }, select: { name: true } }),
  ]);

  // which rows are new, which already exist
  const existingByTitle = new Map<string, string>(existing.map((t): [string, string] => [t.title.toLowerCase(), t.id]));
  const refToId = new Map<string, string>();
  const fresh: typeof plan.tasks = [];
  let skipped = 0;
  for (const t of plan.tasks) {
    const hit = a.skipExisting ? existingByTitle.get(t.title.toLowerCase()) : undefined;
    if (hit) { refToId.set(t.ref, hit); skipped++; continue; }
    refToId.set(t.ref, randomUUID());
    fresh.push(t);
  }
  const newIds = new Set(fresh.map((t) => refToId.get(t.ref)!));

  // labels: create the ones that do not exist yet
  const wanted = [...new Set(fresh.flatMap((t) => t.labels).map((l) => l.slice(0, 40)))];
  const haveLabel = new Map(labelRows.map((l) => [l.name.toLowerCase(), l.id]));
  const missing = wanted.filter((n) => !haveLabel.has(n.toLowerCase()));
  if (missing.length) {
    await db.label.createMany({ data: missing.map((name, i) => ({ workspaceId: a.workspaceId, name, color: LABEL_COLORS[i % LABEL_COLORS.length] })), skipDuplicates: true });
    for (const l of await db.label.findMany({ where: { workspaceId: a.workspaceId } })) haveLabel.set(l.name.toLowerCase(), l.id);
  }

  const unmatched = new Set<string>();
  const base = (maxPos._max.position ?? 0) + 1000;
  const rows = fresh.map((t, i) => {
    const assigneeId = matchPerson(members, t.assignee);
    if (t.assignee && !assigneeId) unmatched.add(t.assignee);
    const parentId = t.parentRef ? refToId.get(t.parentRef) ?? null : null;
    return {
      id: refToId.get(t.ref)!, projectId: a.projectId, parentId, title: t.title, description: t.description ?? null,
      status: t.status, priority: t.priority, assigneeId, reporterId: a.userId,
      startDate: t.startDate ? day(t.startDate) : null, dueDate: t.dueDate ? day(t.dueDate) : null,
      estimateHours: t.estimateHours ?? null,
      completedAt: t.status === "DONE" ? (t.dueDate ? day(t.dueDate) : new Date()) : null,
      position: base + i * 1000,
    };
  });
  const firstWave = rows.filter((r) => !r.parentId || !newIds.has(r.parentId));
  const secondWave = rows.filter((r) => r.parentId && newIds.has(r.parentId));

  const taskLabels = fresh.flatMap((t) =>
    [...new Set(t.labels.map((l) => haveLabel.get(l.slice(0, 40).toLowerCase())).filter((x): x is string => !!x))].map((labelId) => ({ taskId: refToId.get(t.ref)!, labelId }))
  );
  const deps = plan.dependencies.flatMap((d) => {
    const taskId = refToId.get(d.ref), dependsOnId = refToId.get(d.dependsOnRef);
    return taskId && dependsOnId && taskId !== dependsOnId && (newIds.has(taskId) || newIds.has(dependsOnId))
      ? [{ taskId, dependsOnId, type: d.type, lagDays: d.lagDays }] : [];
  });
  const haveMs = new Set(existingMs.map((m) => m.name.toLowerCase()));
  const milestones = a.importMilestones
    ? plan.milestones.filter((m) => !(a.skipExisting && haveMs.has(m.name.toLowerCase())))
        .map((m) => ({ projectId: a.projectId, name: m.name.slice(0, 120), dueDate: day(m.dueDate), doneAt: m.done ? day(m.dueDate) : null }))
    : [];

  const ops: Prisma.PrismaPromise<unknown>[] = [
    ...chunk(firstWave).map((data) => db.task.createMany({ data })),
    ...chunk(secondWave).map((data) => db.task.createMany({ data })),
    ...chunk(taskLabels).map((data) => db.taskLabel.createMany({ data, skipDuplicates: true })),
    ...chunk(deps).map((data) => db.taskDependency.createMany({ data, skipDuplicates: true })),
    ...chunk(milestones).map((data) => db.milestone.createMany({ data })),
  ];
  await db.$transaction(ops);

  return {
    created: rows.length, skipped, dependencies: deps.length, milestones: milestones.length,
    labelsCreated: missing.length, unmatchedAssignees: [...unmatched].slice(0, 10),
  };
}

// ───────────────────────── exports ─────────────────────────
type Project = { id: string; name: string; currency: string; startDate: Date | null };
export type ExportResult = { filename: string; contentType: string; body: string };
const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "project";

export const EXPORT_KINDS = ["tasks", "expenses", "budget", "indicators", "risks", "time", "msproject", "ics"] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];
export const EXPORT_MODULE: Partial<Record<ExportKind, string>> = { budget: "budget", expenses: "budget", indicators: "ngo", risks: "risks", time: "time" };

export async function buildExport(db: PrismaClient, kind: ExportKind, project: Project, appUrl: string, slugOfWorkspace: string): Promise<ExportResult> {
  const name = slug(project.name);
  const csv = (rows: Cell[][], suffix: string): ExportResult => ({ filename: `${name}-${suffix}.csv`, contentType: "text/csv; charset=utf-8", body: toCsv(rows) });

  if (kind === "tasks" || kind === "msproject" || kind === "ics") {
    const [tasks, deps, milestones] = await Promise.all([
      db.task.findMany({
        where: { projectId: project.id, deletedAt: null },
        include: { assignee: { select: { name: true, email: true } }, labels: { include: { label: true } } },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      }),
      db.taskDependency.findMany({ where: { task: { projectId: project.id, deletedAt: null } } }),
      db.milestone.findMany({ where: { projectId: project.id }, orderBy: { dueDate: "asc" } }),
    ]);
    const titleOf = new Map(tasks.map((t) => [t.id, t.title]));
    const who = (t: (typeof tasks)[number]) => t.assignee?.name ?? t.assignee?.email ?? null;

    if (kind === "msproject") {
      return {
        filename: `${name}.xml`, contentType: "application/xml; charset=utf-8",
        body: toMsProjectXml({
          name: project.name, currency: project.currency, startDate: project.startDate,
          tasks: tasks.map((t) => ({ id: t.id, parentId: t.parentId, title: t.title, description: t.description, status: t.status, priority: t.priority, startDate: t.startDate, dueDate: t.dueDate, estimateHours: t.estimateHours, assigneeName: who(t) })),
          deps: deps.map((d) => ({ taskId: d.taskId, dependsOnId: d.dependsOnId, type: d.type, lagDays: d.lagDays })),
          milestones: milestones.map((m) => ({ name: m.name, dueDate: m.dueDate })),
        }),
      };
    }
    if (kind === "ics") {
      const events: IcsEvent[] = [
        ...tasks.filter((t) => t.startDate || t.dueDate).map((t) => ({
          uid: `task-${t.id}@orbit`, title: t.title, description: `${project.name} · ${STATUS_LABELS[t.status]}`,
          start: (t.startDate ?? t.dueDate)!, end: t.dueDate ?? undefined, categories: [project.name],
          url: appUrl ? `${appUrl}/tasks/${t.id}` : undefined,
        })),
        ...milestones.map((m) => ({ uid: `milestone-${m.id}@orbit`, title: `Milestone: ${m.name}`, description: project.name, start: m.dueDate, categories: [project.name], url: appUrl ? `${appUrl}/${slugOfWorkspace}/projects/${project.id}/overview` : undefined })),
      ];
      return { filename: `${name}.ics`, contentType: "text/calendar; charset=utf-8", body: buildIcs(project.name, events) };
    }

    const depsOf = (id: string) => deps.filter((d) => d.taskId === id).map((d) => titleOf.get(d.dependsOnId)).filter(Boolean).join("; ");
    return csv([
      ["Title", "Description", "Status", "Priority", "Assignee", "Start date", "Due date", "Estimate (hours)", "Parent task", "Labels", "Depends on", "Type"],
      ...tasks.map((t) => [t.title, t.description, STATUS_LABELS[t.status], t.priority.toLowerCase(), who(t), t.startDate, t.dueDate, t.estimateHours,
        t.parentId ? titleOf.get(t.parentId) : "", t.labels.map((l) => l.label.name).join("; "), depsOf(t.id), ""] as Cell[]),
      ...milestones.map((m) => [m.name, "", m.doneAt ? "Done" : "", "", "", "", m.dueDate, "", "", "", "", "Milestone"] as Cell[]),
    ], "tasks");
  }

  if (kind === "budget") {
    const b = await budgetSummary(db, project.id);
    return csv([
      ["Budget line", "Description", `Planned (${project.currency})`, "Spent (approved)", "Pending approval", "Remaining", "Used %"],
      ...b.lines.map((l) => [l.category, l.description, l.planned, l.spent, l.pending, l.remaining, l.burnPct] as Cell[]),
      ["TOTAL", "", b.totalPlanned, b.totalSpent, b.totalPending, b.remaining, b.burnPct],
    ], "budget");
  }
  if (kind === "expenses") {
    const ex = await db.expense.findMany({ where: { projectId: project.id }, include: { budgetLine: { select: { category: true } } }, orderBy: { date: "asc" } });
    return csv([["Date", "Description", "Budget line", `Amount (${project.currency})`, "Status"], ...ex.map((e) => [e.date, e.description, e.budgetLine?.category, e.amount, e.status] as Cell[])], "expenses");
  }
  if (kind === "indicators") {
    const ind = await indicatorProgress(db, project.id);
    const rows: Cell[][] = [["Indicator", "Logframe code", "Unit", "Baseline", "Target", "Frequency", "Period", "Period start", "Value", "Breakdown", "Note"]];
    for (const i of ind) {
      const base = [i.name, i.logframeItem?.code, i.unit, i.baseline, i.target, i.frequency.toLowerCase()];
      if (i.values.length === 0) rows.push([...base, "", "", "", "", ""]);
      for (const v of i.values) {
        const brk = v.disaggregation ? Object.entries(v.disaggregation as Record<string, number>).map(([k, n]) => `${k}=${n}`).join("; ") : "";
        rows.push([...base, v.period, v.periodStart, v.value, brk, v.note]);
      }
    }
    return csv(rows, "indicators");
  }
  if (kind === "risks") {
    const r = await db.risk.findMany({ where: { projectId: project.id }, orderBy: { createdAt: "asc" } });
    return csv([["Risk", "Probability (1-5)", "Impact (1-5)", "Score", "Status", "Response", "Description"],
      ...r.map((x) => [x.title, x.probability, x.impact, x.probability * x.impact, x.status.toLowerCase(), x.response, x.description] as Cell[])], "risks");
  }
  // time
  const t = await db.timeEntry.findMany({ where: { projectId: project.id }, include: { user: { select: { name: true, email: true } }, task: { select: { title: true } } }, orderBy: { date: "asc" } });
  return csv([["Date", "Task", "Person", "Hours", "Billable", "Note"],
    ...t.map((e) => [e.date, e.task.title, e.user.name ?? e.user.email, Math.round((e.minutes / 60) * 100) / 100, e.billable ? "yes" : "no", e.note] as Cell[])], "time");
}
