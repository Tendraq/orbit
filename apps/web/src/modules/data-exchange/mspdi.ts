// Microsoft Project file exchange, using Project's XML format ("Save As > XML" in Project).
import { esc, kid, kids, parseXml, txt } from "./xml";
import {
  finishPlan, mspFromPriority, parseIsoDurationHours, percentFromStatus, priorityFromMsp, statusFromPercent,
  type DepType, type ImportPlan, MAX_TASKS,
} from "./plan";

// Project numbers links: 0 = FF, 1 = FS, 2 = SF, 3 = SS
const TYPE_FROM_MSP: Record<number, DepType> = { 0: "FINISH_TO_FINISH", 1: "FINISH_TO_START", 2: "START_TO_FINISH", 3: "START_TO_START" };
const MSP_FROM_TYPE: Record<string, number> = { FINISH_TO_FINISH: 0, FINISH_TO_START: 1, START_TO_FINISH: 2, START_TO_START: 3 };

// ───────────────────────── reading ─────────────────────────
export function planFromMsProject(xml: string): { plan: ImportPlan; projectName: string } {
  const root = parseXml(xml);
  if (root.name !== "Project") throw new Error("This is not a Microsoft Project XML file. In Project use File > Save As > XML Format.");
  const plan: ImportPlan = { tasks: [], dependencies: [], milestones: [], warnings: [] };
  const minutesPerDay = Number(txt(root, "MinutesPerDay")) || 480;

  // who is assigned to what
  const resName = new Map<string, string>();
  for (const r of kids(kid(root, "Resources"), "Resource")) {
    const name = txt(r, "EmailAddress") || txt(r, "Name");
    if (name) resName.set(txt(r, "UID"), name);
  }
  const assignee = new Map<string, string>();
  for (const a of kids(kid(root, "Assignments"), "Assignment")) {
    const who = resName.get(txt(a, "ResourceUID"));
    if (who && !assignee.has(txt(a, "TaskUID"))) assignee.set(txt(a, "TaskUID"), who);
  }

  type Raw = { uid: string; level: number; name: string; milestone: boolean; summary: boolean; start?: string; finish?: string; percent: number; priority: number; notes: string; work: number; preds: { uid: string; type: number; lag: number; lagFormat: number }[] };
  const raws: Raw[] = [];
  for (const t of kids(kid(root, "Tasks"), "Task")) {
    if (txt(t, "IsNull") === "1") continue;
    const level = Number(txt(t, "OutlineLevel") || 1);
    const name = txt(t, "Name");
    if (level === 0 || !name) continue; // level 0 is Project's own "project summary" row
    const day = (s: string) => (/^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : undefined);
    raws.push({
      uid: txt(t, "UID"), level, name,
      milestone: txt(t, "Milestone") === "1", summary: txt(t, "Summary") === "1",
      start: day(txt(t, "Start")), finish: day(txt(t, "Finish")),
      percent: Number(txt(t, "PercentComplete") || 0), priority: Number(txt(t, "Priority") || 500),
      notes: txt(t, "Notes"), work: parseIsoDurationHours(txt(t, "Work")),
      preds: kids(t, "PredecessorLink").map((p) => ({
        uid: txt(p, "PredecessorUID"), type: Number(txt(p, "Type") || 1),
        lag: Number(txt(p, "LinkLag") || 0), lagFormat: Number(txt(p, "LagFormat") || 7),
      })),
    });
  }
  if (raws.length > MAX_TASKS) plan.warnings.push(`Only the first ${MAX_TASKS} tasks were read.`);

  const used = raws.slice(0, MAX_TASKS);
  const taskUids = new Set<string>();
  const parentOf = new Map<string, string>();
  const stack: { level: number; uid: string }[] = [];
  for (const r of used) {
    while (stack.length && stack[stack.length - 1].level >= r.level) stack.pop();
    if (stack.length && !r.milestone) parentOf.set(r.uid, stack[stack.length - 1].uid);
    if (!r.milestone) stack.push({ level: r.level, uid: r.uid });
  }
  const milestoneUids = new Set(used.filter((r) => r.milestone).map((r) => r.uid));

  for (const r of used) {
    if (r.milestone) {
      const when = r.start ?? r.finish;
      if (when) plan.milestones.push({ name: r.name, dueDate: when, done: r.percent >= 100 });
      else plan.warnings.push(`Milestone "${r.name}" has no date and was skipped.`);
      continue;
    }
    taskUids.add(r.uid);
    plan.tasks.push({
      ref: r.uid, title: r.name.slice(0, 200), description: r.notes || undefined,
      status: statusFromPercent(r.percent), priority: priorityFromMsp(r.priority),
      startDate: r.start, dueDate: r.finish,
      estimateHours: r.work > 0 ? Math.round(r.work * 10) / 10 : undefined,
      assignee: assignee.get(r.uid), parentRef: parentOf.get(r.uid), labels: [],
    });
  }

  let skippedMilestoneLinks = 0;
  for (const r of used) {
    if (r.milestone) continue;
    for (const p of r.preds) {
      if (milestoneUids.has(p.uid)) { skippedMilestoneLinks++; continue; }
      if (!taskUids.has(p.uid) || p.uid === r.uid) continue;
      const lagDays = p.lagFormat === 19 || p.lagFormat === 20 ? 0 : Math.round(p.lag / 10 / minutesPerDay);
      plan.dependencies.push({ ref: r.uid, dependsOnRef: p.uid, type: TYPE_FROM_MSP[p.type] ?? "FINISH_TO_START", lagDays });
    }
  }
  if (skippedMilestoneLinks) plan.warnings.push(`${skippedMilestoneLinks} link(s) to milestones were skipped (Orbit milestones are dates, not tasks).`);
  if (used.some((r) => r.level > 2)) plan.warnings.push("Tasks nested deeper than two levels were attached to their top-level task.");
  finishPlan(plan);
  return { plan, projectName: txt(root, "Title") || txt(root, "Name") || "Imported plan" };
}

// ───────────────────────── writing ─────────────────────────
export type ExportTask = {
  id: string; parentId: string | null; title: string; description: string | null; status: string; priority: string;
  startDate: Date | null; dueDate: Date | null; estimateHours: number | null; assigneeName: string | null;
};
export type ExportDep = { taskId: string; dependsOnId: string; type: string; lagDays: number };

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => new Date(Date.parse(s + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);

function workdays(a: string, b: string): number {
  let n = 0;
  for (let d = a; d <= b; d = addDays(d, 1)) { const wd = new Date(d + "T00:00:00Z").getUTCDay(); if (wd !== 0 && wd !== 6) n++; }
  return Math.max(1, n);
}
const dur = (days: number) => `PT${days * 8}H0M0S`;

export function toMsProjectXml(input: {
  name: string; currency: string; startDate: Date | null; tasks: ExportTask[]; deps: ExportDep[];
  milestones: { name: string; dueDate: Date }[];
}): string {
  const today = ymd(new Date());
  const fallback = input.startDate ? ymd(input.startDate) : today;

  const top = input.tasks.filter((t) => !t.parentId);
  const childrenOf = (id: string) => input.tasks.filter((t) => t.parentId === id);
  type Row = { uid: number; wbs: string; level: number; summary: boolean; milestone: boolean; task?: ExportTask; name: string; start: string; finish: string; days: number };
  const rows: Row[] = [];
  const uidOf = new Map<string, number>();

  const span = (t: ExportTask): [string, string] => {
    let s = t.startDate ? ymd(t.startDate) : t.dueDate ? ymd(t.dueDate) : fallback;
    let f = t.dueDate ? ymd(t.dueDate) : s;
    if (f < s) [s, f] = [f, s];
    return [s, f];
  };

  top.forEach((t, i) => {
    const kids = childrenOf(t.id);
    const spans = [span(t), ...kids.map(span)];
    const s = spans.map((x) => x[0]).sort()[0];
    const f = spans.map((x) => x[1]).sort().reverse()[0];
    const uid = rows.length + 1;
    uidOf.set(t.id, uid);
    rows.push({ uid, wbs: String(i + 1), level: 1, summary: kids.length > 0, milestone: false, task: t, name: t.title, start: s, finish: f, days: workdays(s, f) });
    kids.forEach((k, j) => {
      const [ks, kf] = span(k);
      const kuid = rows.length + 1;
      uidOf.set(k.id, kuid);
      rows.push({ uid: kuid, wbs: `${i + 1}.${j + 1}`, level: 2, summary: false, milestone: false, task: k, name: k.title, start: ks, finish: kf, days: workdays(ks, kf) });
    });
  });
  input.milestones.forEach((m, i) => {
    const d = ymd(m.dueDate);
    rows.push({ uid: rows.length + 1, wbs: String(top.length + i + 1), level: 1, summary: false, milestone: true, name: m.name, start: d, finish: d, days: 0 });
  });

  const all = rows.map((r) => [r.start, r.finish]).flat().sort();
  const projStart = all[0] ?? fallback;
  const projFinish = all[all.length - 1] ?? fallback;

  const predsOf = (taskId: string) =>
    input.deps.filter((d) => d.taskId === taskId && uidOf.has(d.dependsOnId))
      .map((d) => `<PredecessorLink><PredecessorUID>${uidOf.get(d.dependsOnId)}</PredecessorUID><Type>${MSP_FROM_TYPE[d.type] ?? 1}</Type><CrossProject>0</CrossProject><LinkLag>${d.lagDays * 4800}</LinkLag><LagFormat>7</LagFormat></PredecessorLink>`).join("");

  const taskXml = rows.map((r) => {
    const t = r.task;
    const note = [t?.description, t?.assigneeName ? `Assignee: ${t.assigneeName}` : ""].filter(Boolean).join("\n");
    const work = t?.estimateHours ? `<Work>PT${Math.round(t.estimateHours)}H0M0S</Work>` : "";
    return `<Task><UID>${r.uid}</UID><ID>${r.uid}</ID><Name>${esc(r.name)}</Name><Type>0</Type><IsNull>0</IsNull>` +
      `<WBS>${r.wbs}</WBS><OutlineNumber>${r.wbs}</OutlineNumber><OutlineLevel>${r.level}</OutlineLevel>` +
      `<Priority>${t ? mspFromPriority(t.priority) : 500}</Priority>` +
      `<Start>${r.start}T08:00:00</Start><Finish>${r.finish}T${r.milestone ? "08" : "17"}:00:00</Finish>` +
      `<Duration>${dur(r.days)}</Duration><DurationFormat>7</DurationFormat>` +
      `<Milestone>${r.milestone ? 1 : 0}</Milestone><Summary>${r.summary ? 1 : 0}</Summary>` +
      `<PercentComplete>${t ? percentFromStatus(t.status) : 0}</PercentComplete>` +
      `<ConstraintType>0</ConstraintType><CalendarUID>-1</CalendarUID>` +
      `${work}${note ? `<Notes>${esc(note)}</Notes>` : ""}${t ? predsOf(t.id) : ""}</Task>`;
  }).join("");

  const day = (n: number, working: boolean) =>
    working
      ? `<WeekDay><DayType>${n}</DayType><DayWorking>1</DayWorking><WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime><WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime></WorkingTimes></WeekDay>`
      : `<WeekDay><DayType>${n}</DayType><DayWorking>0</DayWorking></WeekDay>`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Project xmlns="http://schemas.microsoft.com/project">` +
    `<SaveVersion>14</SaveVersion><Name>${esc(input.name)}.xml</Name><Title>${esc(input.name)}</Title>` +
    `<ScheduleFromStart>1</ScheduleFromStart><StartDate>${projStart}T08:00:00</StartDate><FinishDate>${projFinish}T17:00:00</FinishDate>` +
    `<CurrencyDigits>2</CurrencyDigits><CurrencySymbol>${esc(input.currency)}</CurrencySymbol><CurrencyCode>${esc(input.currency)}</CurrencyCode>` +
    `<CalendarUID>1</CalendarUID><DefaultStartTime>08:00:00</DefaultStartTime><DefaultFinishTime>17:00:00</DefaultFinishTime>` +
    `<MinutesPerDay>480</MinutesPerDay><MinutesPerWeek>2400</MinutesPerWeek><DaysPerMonth>20</DaysPerMonth>` +
    `<DefaultTaskType>0</DefaultTaskType><DurationFormat>7</DurationFormat>` +
    `<Calendars><Calendar><UID>1</UID><Name>Standard</Name><IsBaseCalendar>1</IsBaseCalendar><WeekDays>` +
    [day(1, false), day(2, true), day(3, true), day(4, true), day(5, true), day(6, true), day(7, false)].join("") +
    `</WeekDays></Calendar></Calendars><Tasks>${taskXml}</Tasks></Project>\n`;
}
