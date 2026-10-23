// The common shape every import is turned into, plus the rules for reading
// messy real-world spreadsheets (status words, date styles, column names).

export type Status = "BACKLOG" | "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type DepType = "FINISH_TO_START" | "START_TO_START" | "FINISH_TO_FINISH" | "START_TO_FINISH";

export type PlanTask = {
  ref: string;
  title: string;
  description?: string;
  status: Status;
  priority: Priority;
  startDate?: string; // YYYY-MM-DD
  dueDate?: string;
  estimateHours?: number;
  assignee?: string; // an email or a name; matched to a member later
  parentRef?: string;
  labels: string[];
};
export type PlanDep = { ref: string; dependsOnRef: string; type: DepType; lagDays: number };
export type PlanMilestone = { name: string; dueDate: string; done: boolean };
export type ImportPlan = { tasks: PlanTask[]; dependencies: PlanDep[]; milestones: PlanMilestone[]; warnings: string[] };

export const MAX_TASKS = 5000;

// ───────── words people use ─────────
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9%]/g, "");

export function mapStatus(raw: string): Status | null {
  const s = squash(raw);
  if (!s) return "TODO";
  const pct = /^(\d{1,3})%?$/.exec(s);
  if (pct) return statusFromPercent(Number(pct[1]));
  if (["done", "complete", "completed", "closed", "finished", "resolved", "delivered"].includes(s)) return "DONE";
  if (["inprogress", "doing", "started", "wip", "active", "ongoing", "underway", "inprocess", "working"].includes(s)) return "IN_PROGRESS";
  if (["inreview", "review", "testing", "qa", "pendingreview", "underreview"].includes(s)) return "IN_REVIEW";
  if (["todo", "open", "notstarted", "new", "planned", "ready", "pending", "tobedone"].includes(s)) return "TODO";
  if (["backlog", "icebox", "later", "onhold", "parked", "someday"].includes(s)) return "BACKLOG";
  return null; // unknown word
}

export function statusFromPercent(p: number): Status {
  if (p >= 100) return "DONE";
  if (p >= 90) return "IN_REVIEW";
  if (p > 0) return "IN_PROGRESS";
  return "TODO";
}
export function percentFromStatus(s: string): number {
  return s === "DONE" ? 100 : s === "IN_REVIEW" ? 90 : s === "IN_PROGRESS" ? 50 : 0;
}

export function mapPriority(raw: string): Priority {
  const s = squash(raw);
  if (["low", "minor", "lowest", "trivial"].includes(s)) return "LOW";
  if (["high", "major", "important"].includes(s)) return "HIGH";
  if (["urgent", "critical", "highest", "blocker", "asap"].includes(s)) return "URGENT";
  return "MEDIUM";
}

export const priorityFromMsp = (n: number): Priority => (n >= 800 ? "URGENT" : n >= 600 ? "HIGH" : n >= 400 ? "MEDIUM" : "LOW");
export const mspFromPriority = (p: string) => ({ LOW: 250, MEDIUM: 500, HIGH: 750, URGENT: 900 })[p] ?? 500;

// ───────── dates ─────────
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function iso(y: number, m: number, d: number): string | null {
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1) return null;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d > last) return null;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
const fullYear = (y: number) => (y < 100 ? 2000 + y : y);

/** Understands 2026-03-15, 15/03/2026, 3/15/2026, 15 Mar 2026, Mar 15, 2026 ... Returns YYYY-MM-DD or null. */
export function parseDate(raw: string, dayFirst = true): string | null {
  const s = raw.trim();
  if (!s) return null;
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/.exec(s);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(s);
  if (m) {
    const [a, b, y] = [+m[1], +m[2], fullYear(+m[3])];
    if (a > 12) return iso(y, b, a); // must be day first
    if (b > 12) return iso(y, a, b); // must be month first
    return dayFirst ? iso(y, b, a) : iso(y, a, b);
  }
  m = /^(\d{1,2})[ \-/]([A-Za-z]{3,9})[ \-/,]*(\d{2,4})$/.exec(s);
  if (m) { const mi = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()); return mi >= 0 ? iso(fullYear(+m[3]), mi + 1, +m[1]) : null; }
  m = /^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{2,4})$/.exec(s);
  if (m) { const mi = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()); return mi >= 0 ? iso(fullYear(+m[3]), mi + 1, +m[2]) : null; }
  return null;
}

export function parseNumber(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned.includes(".") ? cleaned.replace(/,/g, "") : cleaned.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function parseIsoDurationHours(d: string): number {
  const m = /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(d.trim());
  if (!m) return 0;
  return (Number(m[1] ?? 0) * 8) + Number(m[2] ?? 0) + Number(m[3] ?? 0) / 60 + Number(m[4] ?? 0) / 3600;
}

// ───────── spreadsheet columns ─────────
const norm = (h: string) =>
  h.toLowerCase().replace(/\(.*?\)/g, "").replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();

const COLUMNS: Record<string, string[]> = {
  title: ["title", "task", "task name", "name", "summary", "subject", "activity"],
  description: ["description", "details", "notes", "note"],
  status: ["status", "state", "progress"],
  priority: ["priority"],
  assignee: ["assignee", "assigned to", "assigned", "owner", "responsible", "assignee email"],
  start: ["start", "start date", "begin", "starts"],
  due: ["due", "due date", "end", "end date", "finish", "finish date", "deadline"],
  estimate: ["estimate", "estimated hours", "hours", "effort", "est h", "est. h", "estimate hours"],
  parent: ["parent", "parent task", "parent title"],
  labels: ["labels", "label", "tags"],
  depends: ["depends on", "dependencies", "predecessors", "depends"],
  type: ["type", "kind"],
};

export function detectColumns(header: string[]): Record<string, number> {
  const found: Record<string, number> = {};
  header.forEach((h, i) => {
    const n = norm(h);
    for (const [key, names] of Object.entries(COLUMNS)) {
      if (found[key] === undefined && names.includes(n)) { found[key] = i; break; }
    }
  });
  return found;
}

const clean = (s: string | undefined) => {
  const t = (s ?? "").trim();
  return /^'[=+\-@]/.test(t) ? t.slice(1) : t; // undo the guard we add when exporting
};

/** Turns spreadsheet rows (first row = column names) into an import plan. */
export function planFromRows(rows: string[][], opts: { dayFirst: boolean }): ImportPlan {
  const plan: ImportPlan = { tasks: [], dependencies: [], milestones: [], warnings: [] };
  if (rows.length < 2) { plan.warnings.push("The file has no data rows."); return plan; }
  const col = detectColumns(rows[0]);
  if (col.title === undefined) {
    plan.warnings.push("Could not find a column called Title (or Task, Name, Summary). Add one and try again.");
    return plan;
  }
  const get = (r: string[], key: string) => (col[key] === undefined ? "" : clean(r[col[key]]));
  const unknownStatus = new Set<string>();
  let badDates = 0;

  const dep: { ref: string; names: string[] }[] = [];
  const parents: { ref: string; name: string }[] = [];
  const byTitle = new Map<string, string>();

  rows.slice(1).forEach((r, i) => {
    const title = get(r, "title");
    if (!title) return;
    if (plan.tasks.length >= MAX_TASKS) return;
    const ref = `r${i + 2}`;
    const start = get(r, "start") ? parseDate(get(r, "start"), opts.dayFirst) : null;
    const due = get(r, "due") ? parseDate(get(r, "due"), opts.dayFirst) : null;
    if ((get(r, "start") && !start) || (get(r, "due") && !due)) badDates++;

    if (/milestone/i.test(get(r, "type"))) {
      const when = due ?? start;
      if (when) plan.milestones.push({ name: title, dueDate: when, done: mapStatus(get(r, "status")) === "DONE" });
      else plan.warnings.push(`Milestone "${title}" has no date and was skipped.`);
      return;
    }

    const status = mapStatus(get(r, "status"));
    if (status === null) unknownStatus.add(get(r, "status"));
    const est = get(r, "estimate") ? parseNumber(get(r, "estimate")) : null;
    plan.tasks.push({
      ref, title: title.slice(0, 200),
      description: get(r, "description") || undefined,
      status: status ?? "TODO",
      priority: mapPriority(get(r, "priority")),
      startDate: start ?? undefined, dueDate: due ?? undefined,
      estimateHours: est !== null && est >= 0 ? est : undefined,
      assignee: get(r, "assignee") || undefined,
      labels: get(r, "labels").split(/[;|,]/).map((x) => x.trim()).filter(Boolean),
    });
    const key = title.toLowerCase();
    if (!byTitle.has(key)) byTitle.set(key, ref);
    if (get(r, "parent")) parents.push({ ref, name: get(r, "parent") });
    if (get(r, "depends")) dep.push({ ref, names: get(r, "depends").split(/[;|]/).map((x) => x.trim()).filter(Boolean) });
  });

  if (rows.length > MAX_TASKS + 1) plan.warnings.push(`Only the first ${MAX_TASKS} tasks were read.`);
  if (unknownStatus.size) plan.warnings.push(`Unknown status word(s) treated as "To do": ${[...unknownStatus].slice(0, 5).join(", ")}.`);
  if (badDates) plan.warnings.push(`${badDates} row(s) had a date that could not be read. Use YYYY-MM-DD to be safe.`);

  for (const p of parents) {
    const target = byTitle.get(p.name.toLowerCase());
    if (!target || target === p.ref) plan.warnings.push(`Parent "${p.name}" was not found; the task was added at the top level.`);
    else plan.tasks.find((t) => t.ref === p.ref)!.parentRef = target;
  }
  for (const d of dep) for (const name of d.names) {
    const target = byTitle.get(name.toLowerCase());
    if (!target || target === d.ref) plan.warnings.push(`Dependency "${name}" was not found and was skipped.`);
    else plan.dependencies.push({ ref: d.ref, dependsOnRef: target, type: "FINISH_TO_START", lagDays: 0 });
  }
  finishPlan(plan);
  return plan;
}

/** Orbit shows one level of subtasks, so deeper levels attach to their top-level ancestor. Removes loops. */
export function finishPlan(plan: ImportPlan) {
  const byRef = new Map(plan.tasks.map((t) => [t.ref, t]));
  for (const t of plan.tasks) {
    const seen = new Set([t.ref]);
    let cur = t.parentRef ? byRef.get(t.parentRef) : undefined;
    let root: string | undefined;
    while (cur) {
      if (seen.has(cur.ref)) { plan.warnings.push(`"${t.title}" was in a parent loop and was added at the top level.`); root = undefined; t.parentRef = undefined; break; }
      seen.add(cur.ref);
      root = cur.ref;
      cur = cur.parentRef ? byRef.get(cur.parentRef) : undefined;
    }
    if (root && t.parentRef) t.parentRef = root;
  }
  // drop dependencies that would loop
  const kept: PlanDep[] = [];
  const reaches = (from: string, to: string): boolean => {
    const stack = [from]; const seen = new Set<string>();
    while (stack.length) {
      const x = stack.pop()!;
      if (x === to) return true;
      if (seen.has(x)) continue;
      seen.add(x);
      for (const d of kept) if (d.ref === x) stack.push(d.dependsOnRef);
    }
    return false;
  };
  let skipped = 0;
  for (const d of plan.dependencies) {
    if (reaches(d.dependsOnRef, d.ref)) { skipped++; continue; }
    kept.push(d);
  }
  if (skipped) plan.warnings.push(`${skipped} dependency link(s) would have formed a loop and were skipped.`);
  plan.dependencies = kept;
}
