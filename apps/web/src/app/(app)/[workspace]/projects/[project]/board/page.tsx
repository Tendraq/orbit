"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc, type Out } from "@/lib/trpc";
import { useProject } from "@/lib/contexts";
import { Avatar, Badge, ErrorText, Loading } from "@/components/ui/kit";
import { STATUS_LABELS, TASK_STATUSES } from "@/config";
import { fmtDate, isOverdue } from "@/lib/format";
import { cn } from "@/lib/utils";

type Task = Out["task"]["listAll"][number];
type Status = (typeof TASK_STATUSES)[number];

export default function BoardPage() {
  const { project, can } = useProject();
  const projectId = project.id;
  const utils = trpc.useUtils();
  const q = trpc.task.listAll.useQuery({ projectId });
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Status | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const reload = () => utils.task.listAll.invalidate({ projectId });
  const move = trpc.task.move.useMutation({ onError: reload });
  const create = trpc.task.create.useMutation({ onSuccess: reload });

  if (q.isLoading) return <Loading />;
  const tasks = (q.data ?? []).filter((t) => !t.parentId); // subtasks live inside their parent

  const column = (s: Status) =>
    tasks
      .filter((t) => t.status === s)
      .sort((a, b) => a.position - b.position || +new Date(a.createdAt) - +new Date(b.createdAt));

  // Drop the dragged card into a column, before another card (or at the end)
  function drop(status: Status, beforeId?: string) {
    setOverCol(null);
    if (!dragId || !can("task:update") || beforeId === dragId) { setDragId(null); return; }
    const moving = tasks.find((t) => t.id === dragId);
    if (!moving) return;
    const rest = column(status).filter((t) => t.id !== dragId);
    const idx = beforeId ? rest.findIndex((t) => t.id === beforeId) : rest.length;
    const ordered = [...rest.slice(0, Math.max(0, idx)), moving, ...rest.slice(Math.max(0, idx))];

    // update the screen immediately, then save
    utils.task.listAll.setData({ projectId }, (old) =>
      old?.map((t) => {
        const i = ordered.findIndex((o) => o.id === t.id);
        return i >= 0 ? { ...t, status, position: i * 1000 } : t;
      })
    );
    ordered.forEach((t, i) => {
      if (t.id === dragId || t.position !== i * 1000 || t.status !== status) {
        move.mutate({ taskId: t.id, status, position: i * 1000 });
      }
    });
    setDragId(null);
  }

  const card = (t: Task, s: Status) => (
    <div
      key={t.id}
      draggable={can("task:update")}
      onDragStart={() => setDragId(t.id)}
      onDragEnd={() => { setDragId(null); setOverCol(null); }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.stopPropagation(); drop(s, t.id); }}
      className={cn(
        "cursor-grab rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm",
        dragId === t.id && "opacity-40"
      )}
    >
      <Link href={`/tasks/${t.id}`} className="font-medium hover:text-brand-600">{t.title}</Link>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge value={t.priority} />
        {t.labels.map((l) => (
          <span key={l.labelId} className="rounded-full px-2 py-0.5 text-xs text-white" style={{ background: l.label.color }}>
            {l.label.name}
          </span>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
        {t.dueDate && (
          <span className={isOverdue(t.dueDate, t.status) ? "font-medium text-red-600" : ""}>{fmtDate(t.dueDate)}</span>
        )}
        {t._count.subtasks > 0 && <span>☰ {t._count.subtasks}</span>}
        {t._count.comments > 0 && <span>💬 {t._count.comments}</span>}
        <span className="ml-auto"><Avatar name={t.assignee?.name} /></span>
      </div>
    </div>
  );

  return (
    <div>
      <ErrorText error={q.error ?? move.error ?? create.error} />
      <div className="grid min-w-[900px] grid-cols-5 gap-3 overflow-x-auto">
        {TASK_STATUSES.map((s) => {
          const items = column(s);
          return (
            <div
              key={s}
              onDragOver={(e) => { e.preventDefault(); setOverCol(s); }}
              onDrop={() => drop(s)}
              className={cn("rounded-xl bg-slate-100/70 p-2", overCol === s && "ring-2 ring-brand-500")}
            >
              <div className="mb-2 flex items-center justify-between px-1 text-sm font-semibold">
                {STATUS_LABELS[s]}
                <span className="text-xs font-normal text-slate-500">{items.length}</span>
              </div>
              <div className="min-h-[60px] space-y-2">{items.map((t) => card(t, s))}</div>
              {can("task:create") && (
                <form
                  className="mt-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const title = (drafts[s] ?? "").trim();
                    if (!title) return;
                    create.mutate({ projectId, title, status: s });
                    setDrafts((d) => ({ ...d, [s]: "" }));
                  }}
                >
                  <input
                    value={drafts[s] ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [s]: e.target.value }))}
                    placeholder="+ Add a card"
                    className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm hover:bg-white focus:border-brand-500 focus:bg-white focus:outline-none"
                  />
                </form>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
