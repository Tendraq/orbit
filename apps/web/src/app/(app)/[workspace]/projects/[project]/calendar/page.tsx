"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useProject } from "@/lib/contexts";
import { ErrorText, Loading } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { toInput } from "@/lib/format";
import { cn } from "@/lib/utils";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Month view: tasks on their due date, milestones as diamonds.
export default function CalendarPage() {
  const { project } = useProject();
  const tasks = trpc.task.listAll.useQuery({ projectId: project.id });
  const ms = trpc.milestone.list.useQuery({ projectId: project.id });
  const today = new Date();
  const [ym, setYm] = useState({ y: today.getUTCFullYear(), m: today.getUTCMonth() });

  if (tasks.isLoading) return <Loading />;

  const first = new Date(Date.UTC(ym.y, ym.m, 1));
  const offset = (first.getUTCDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate();
  const cells = Math.ceil((offset + daysInMonth) / 7) * 7;

  const byDay = new Map<string, { tasks: NonNullable<typeof tasks.data>; milestones: NonNullable<typeof ms.data> }>();
  const slot = (k: string) => {
    if (!byDay.has(k)) byDay.set(k, { tasks: [], milestones: [] });
    return byDay.get(k)!;
  };
  tasks.data?.forEach((t) => t.dueDate && slot(toInput(t.dueDate)).tasks.push(t));
  ms.data?.forEach((m) => slot(toInput(m.dueDate)).milestones.push(m));

  const shift = (n: number) =>
    setYm(({ y, m }) => {
      const d = new Date(Date.UTC(y, m + n, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    });

  const todayKey = toInput(today);

  return (
    <div className="space-y-3">
      <ErrorText error={tasks.error} />
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => shift(-1)}>←</Button>
        <h2 className="w-44 text-center text-lg font-semibold">
          {first.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}
        </h2>
        <Button variant="ghost" onClick={() => shift(1)}>→</Button>
        <Button variant="ghost" onClick={() => setYm({ y: today.getUTCFullYear(), m: today.getUTCMonth() })}>Today</Button>
      </div>

      <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-soft text-sm">
        {DAYS.map((d) => (
          <div key={d} className="border-b border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold uppercase text-slate-500">{d}</div>
        ))}
        {Array.from({ length: cells }, (_, i) => {
          const dayNum = i - offset + 1;
          const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
          const key = inMonth ? toInput(new Date(Date.UTC(ym.y, ym.m, dayNum))) : "";
          const items = inMonth ? byDay.get(key) : undefined;
          return (
            <div key={i} className={cn("min-h-[96px] border-b border-r border-slate-100 p-1", !inMonth && "bg-slate-50")}>
              {inMonth && (
                <>
                  <div className={cn("mb-1 text-xs", key === todayKey ? "inline-block rounded-full bg-brand-600 px-1.5 text-white" : "text-slate-500")}>
                    {dayNum}
                  </div>
                  {items?.milestones.map((m) => (
                    <div key={m.id} className="truncate text-xs text-amber-700">◆ {m.name}</div>
                  ))}
                  {items?.tasks.slice(0, 3).map((t) => (
                    <Link
                      key={t.id}
                      href={`/tasks/${t.id}`}
                      className={cn("mb-0.5 block truncate rounded px-1 text-xs", t.status === "DONE" ? "bg-green-100 text-green-800 line-through" : "bg-indigo-50 text-indigo-800 hover:bg-indigo-100")}
                    >
                      {t.title}
                    </Link>
                  ))}
                  {(items?.tasks.length ?? 0) > 3 && <div className="text-xs text-slate-500">+{items!.tasks.length - 3} more</div>}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
