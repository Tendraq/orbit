"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useProject } from "@/lib/contexts";
import { Card, Empty, ErrorText, Loading } from "@/components/ui/kit";
import { fmtDate } from "@/lib/format";

const DAY = 86400000;
const ROW = 32;

// Gantt chart: a bar for every task that has a start or due date.
export default function TimelinePage() {
  const { project } = useProject();
  const tasksQ = trpc.task.listAll.useQuery({ projectId: project.id });
  const msQ = trpc.milestone.list.useQuery({ projectId: project.id });

  if (tasksQ.isLoading) return <Loading />;
  const all = tasksQ.data ?? [];
  const milestones = msQ.data ?? [];

  const scheduled = all
    .filter((t) => t.startDate || t.dueDate)
    .map((t) => {
      const a = +new Date((t.startDate ?? t.dueDate)!);
      const b = +new Date((t.dueDate ?? t.startDate)!);
      return { t, start: Math.min(a, b), end: Math.max(a, b) + DAY };
    })
    .sort((x, y) => x.start - y.start);
  const unscheduled = all.filter((t) => !t.startDate && !t.dueDate);

  if (scheduled.length === 0 && milestones.length === 0) {
    return <Empty>Give tasks a start or due date (in the Table view or on a task) and they will appear here.</Empty>;
  }

  const now = Date.now();
  const points = [now, ...scheduled.flatMap((s) => [s.start, s.end]), ...milestones.map((m) => +new Date(m.dueDate))];
  const min = Math.min(...points) - 3 * DAY;
  const max = Math.max(...points) + 3 * DAY;
  const span = max - min;
  const pct = (ms: number) => ((ms - min) / span) * 100;

  const ticks: number[] = [];
  for (let x = min; x <= max; x += 7 * DAY) ticks.push(x);

  const color = (s: (typeof scheduled)[number]) =>
    s.t.status === "DONE" ? "bg-green-500"
    : s.end < now ? "bg-red-500"
    : s.t.status === "IN_PROGRESS" ? "bg-blue-500"
    : "bg-slate-400";

  const nameOf = (id: string) => all.find((x) => x.id === id)?.title ?? "task";

  return (
    <div className="space-y-4">
      <ErrorText error={tasksQ.error} />
      <Card className="overflow-x-auto p-0">
        <div className="flex min-w-[900px]">
          {/* task names */}
          <div className="w-60 shrink-0 border-r border-slate-200">
            <div className="h-8 border-b border-slate-200 px-3 text-xs font-semibold uppercase leading-8 text-slate-500">Task</div>
            <div style={{ height: ROW }} className="border-b border-slate-100 px-3 text-xs italic leading-8 text-slate-500">Milestones</div>
            {scheduled.map((s) => (
              <div key={s.t.id} style={{ height: ROW }} className="truncate border-b border-slate-100 px-3 text-sm leading-8">
                <Link href={`/tasks/${s.t.id}`} className="hover:text-brand-600">{s.t.title}</Link>
              </div>
            ))}
          </div>

          {/* chart area */}
          <div className="relative flex-1">
            <div className="relative h-8 border-b border-slate-200">
              {ticks.map((x) => (
                <span key={x} className="absolute top-0 -translate-x-1/2 text-[10px] leading-8 text-slate-500" style={{ left: `${pct(x)}%` }}>
                  {new Date(x).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" })}
                </span>
              ))}
            </div>
            <div className="relative" style={{ height: ROW * (scheduled.length + 1) }}>
              {ticks.map((x) => (
                <div key={x} className="absolute top-0 h-full border-l border-slate-100" style={{ left: `${pct(x)}%` }} />
              ))}
              <div className="absolute top-0 z-10 h-full border-l-2 border-red-400" style={{ left: `${pct(now)}%` }} title="Today" />

              {milestones.map((m) => (
                <div
                  key={m.id}
                  className={`absolute h-3 w-3 -translate-x-1/2 rotate-45 ${m.doneAt ? "bg-green-600" : "bg-amber-500"}`}
                  style={{ left: `${pct(+new Date(m.dueDate))}%`, top: 10 }}
                  title={`${m.name} · ${fmtDate(m.dueDate)}`}
                />
              ))}

              {scheduled.map((s, i) => (
                <div
                  key={s.t.id}
                  className={`absolute h-5 rounded ${color(s)}`}
                  style={{
                    left: `${pct(s.start)}%`,
                    width: `${Math.max(pct(s.end) - pct(s.start), 0.8)}%`,
                    top: ROW * (i + 1) + 6,
                  }}
                  title={`${s.t.title} · ${fmtDate(s.t.startDate)} → ${fmtDate(s.t.dueDate)}${
                    s.t.dependencies.length ? ` · after: ${s.t.dependencies.map((d) => nameOf(d.dependsOnId)).join(", ")}` : ""
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </Card>

      <p className="text-xs text-slate-500">
        <span className="mr-3">🟩 done</span><span className="mr-3">🟦 in progress</span>
        <span className="mr-3">🟥 overdue</span><span className="mr-3">⬜ planned</span>
        <span>◆ milestone · red line = today · hover a bar for details</span>
      </p>

      {unscheduled.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-semibold">Not scheduled ({unscheduled.length})</h3>
          <ul className="text-sm text-slate-600">
            {unscheduled.slice(0, 20).map((t) => (
              <li key={t.id}><Link href={`/tasks/${t.id}`} className="hover:text-brand-600">{t.title}</Link></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
