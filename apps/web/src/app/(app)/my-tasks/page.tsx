"use client";

import Link from "next/link";
import { trpc, type Out } from "@/lib/trpc";
import { Badge, Empty, ErrorText, Loading, SectionTitle } from "@/components/ui/kit";
import { fmtDate } from "@/lib/format";

type T = Out["task"]["mine"][number];

export default function MyTasksPage() {
  const utils = trpc.useUtils();
  const q = trpc.task.mine.useQuery();
  const done = trpc.task.update.useMutation({ onSuccess: () => utils.task.mine.invalidate() });

  if (q.isLoading) return <Loading />;
  const tasks = q.data ?? [];
  const now = Date.now();
  const week = now + 7 * 86400000;
  const groups: { title: string; items: T[] }[] = [
    { title: "Overdue", items: tasks.filter((t) => t.dueDate && +new Date(t.dueDate) < now) },
    { title: "Due this week", items: tasks.filter((t) => t.dueDate && +new Date(t.dueDate) >= now && +new Date(t.dueDate) <= week) },
    { title: "Later", items: tasks.filter((t) => t.dueDate && +new Date(t.dueDate) > week) },
    { title: "No due date", items: tasks.filter((t) => !t.dueDate) },
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">My tasks</h1>
      <ErrorText error={q.error ?? done.error} />
      {tasks.length === 0 && <Empty>Nothing assigned to you. Enjoy the quiet.</Empty>}
      {groups.filter((g) => g.items.length).map((g) => (
        <section key={g.title}>
          <SectionTitle>{g.title} ({g.items.length})</SectionTitle>
          <ul className="space-y-2">
            {g.items.map((t) => (
              <li key={t.id} className="flex items-center gap-3 rounded-xl border border-slate-200/70 bg-white shadow-soft p-3 text-sm">
                <input type="checkbox" onChange={() => done.mutate({ taskId: t.id, status: "DONE" })} title="Mark done" />
                <Link href={`/tasks/${t.id}`} className="font-medium hover:text-brand-600">{t.title}</Link>
                <Badge value={t.priority} />
                <span className="ml-auto text-xs text-slate-500">{t.project.workspace.name} · {t.project.name}</span>
                {t.dueDate && <span className={`text-xs ${g.title === "Overdue" ? "font-medium text-red-600" : "text-slate-500"}`}>{fmtDate(t.dueDate)}</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
