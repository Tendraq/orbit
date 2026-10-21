"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { trpc, type Out } from "@/lib/trpc";
import { useProject } from "@/lib/contexts";
import { ErrorText, Loading, Select } from "@/components/ui/kit";
import { Input } from "@/components/ui/input";
import { PRIORITIES, STATUS_LABELS, TASK_STATUSES } from "@/config";
import { fromInput, toInput } from "@/lib/format";

type Task = Out["task"]["listAll"][number];
type SortKey = "title" | "status" | "priority" | "assignee" | "dueDate";

const cell = "border-b border-slate-100 px-2 py-1.5";
const inline =
  "w-full rounded border border-transparent bg-transparent px-1 py-1 text-sm hover:border-slate-300 focus:border-brand-500 focus:bg-white focus:outline-none";

// A spreadsheet-style view: click any cell to edit it.
export default function TablePage() {
  const { project, slug, can } = useProject();
  const projectId = project.id;
  const utils = trpc.useUtils();
  const q = trpc.task.listAll.useQuery({ projectId });
  const members = trpc.project.members.useQuery({ projectId });
  const fields = trpc.customField.list.useQuery({ workspaceSlug: slug, entity: "TASK" });
  const update = trpc.task.update.useMutation({ onSuccess: () => utils.task.listAll.invalidate({ projectId }) });

  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "dueDate", dir: 1 });
  const editable = can("task:update");

  const rows = useMemo(() => {
    const val = (t: Task): string | number =>
      sort.key === "assignee" ? t.assignee?.name ?? "" :
      sort.key === "dueDate" ? (t.dueDate ? +new Date(t.dueDate) : Infinity) :
      sort.key === "priority" ? PRIORITIES.indexOf(t.priority) :
      t[sort.key];
    return (q.data ?? [])
      .filter((t) => (!status || t.status === status) && t.title.toLowerCase().includes(text.toLowerCase()))
      .sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
  }, [q.data, text, status, sort]);

  if (q.isLoading) return <Loading />;

  const head = (key: SortKey, name: string) => (
    <th
      className="cursor-pointer select-none border-b border-slate-200 px-2 py-2 text-left text-xs font-semibold uppercase text-slate-500"
      onClick={() => setSort((s) => ({ key, dir: s.key === key ? (-s.dir as 1 | -1) : 1 }))}
    >
      {name} {sort.key === key ? (sort.dir === 1 ? "▲" : "▼") : ""}
    </th>
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input className="max-w-xs" placeholder="Filter by title…" value={text} onChange={(e) => setText(e.target.value)} />
        <Select className="w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {TASK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </Select>
        <span className="self-center text-sm text-slate-500">{rows.length} tasks</span>
      </div>
      <ErrorText error={q.error ?? update.error} />

      <div className="overflow-x-auto rounded-xl border border-slate-200/70 bg-white shadow-soft">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50">
            <tr>
              {head("title", "Title")}
              {head("status", "Status")}
              {head("priority", "Priority")}
              {head("assignee", "Assignee")}
              <th className="border-b border-slate-200 px-2 py-2 text-left text-xs font-semibold uppercase text-slate-500">Start</th>
              {head("dueDate", "Due")}
              <th className="border-b border-slate-200 px-2 py-2 text-left text-xs font-semibold uppercase text-slate-500">Est. h</th>
              {fields.data?.map((f) => (
                <th key={f.id} className="border-b border-slate-200 px-2 py-2 text-left text-xs font-semibold uppercase text-slate-500">{f.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const cf = (t.customFields ?? {}) as Record<string, string | number>;
              return (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className={cell}>
                    <Link href={`/tasks/${t.id}`} className={t.parentId ? "pl-4 text-slate-600 hover:text-brand-600" : "font-medium hover:text-brand-600"}>
                      {t.title}
                    </Link>
                  </td>
                  <td className={cell}>
                    <select className={inline} disabled={!editable} value={t.status}
                      onChange={(e) => update.mutate({ taskId: t.id, status: e.target.value as Task["status"] })}>
                      {TASK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  </td>
                  <td className={cell}>
                    <select className={inline} disabled={!editable} value={t.priority}
                      onChange={(e) => update.mutate({ taskId: t.id, priority: e.target.value as Task["priority"] })}>
                      {PRIORITIES.map((p) => <option key={p} value={p}>{p.toLowerCase()}</option>)}
                    </select>
                  </td>
                  <td className={cell}>
                    <select className={inline} disabled={!editable} value={t.assigneeId ?? ""}
                      onChange={(e) => update.mutate({ taskId: t.id, assigneeId: e.target.value || null })}>
                      <option value="">—</option>
                      {members.data?.map((m) => <option key={m.id} value={m.id}>{m.name ?? m.email}</option>)}
                    </select>
                  </td>
                  <td className={cell}>
                    <input type="date" className={inline} disabled={!editable} defaultValue={toInput(t.startDate)}
                      onBlur={(e) => e.target.value !== toInput(t.startDate) && update.mutate({ taskId: t.id, startDate: fromInput(e.target.value) })} />
                  </td>
                  <td className={cell}>
                    <input type="date" className={inline} disabled={!editable} defaultValue={toInput(t.dueDate)}
                      onBlur={(e) => e.target.value !== toInput(t.dueDate) && update.mutate({ taskId: t.id, dueDate: fromInput(e.target.value) })} />
                  </td>
                  <td className={cell}>
                    <input type="number" min={0} step="0.5" className={`${inline} w-20`} disabled={!editable}
                      defaultValue={t.estimateHours ?? ""}
                      onBlur={(e) => {
                        const v = e.target.value === "" ? null : Number(e.target.value);
                        if (v !== t.estimateHours) update.mutate({ taskId: t.id, estimateHours: v });
                      }} />
                  </td>
                  {fields.data?.map((f) => (
                    <td key={f.id} className={cell}>
                      {f.type === "SELECT" ? (
                        <select className={inline} disabled={!editable} value={String(cf[f.key] ?? "")}
                          onChange={(e) => update.mutate({ taskId: t.id, customFields: { ...cf, [f.key]: e.target.value } })}>
                          <option value="">—</option>
                          {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input
                          type={f.type === "NUMBER" ? "number" : f.type === "DATE" ? "date" : "text"}
                          className={inline} disabled={!editable} defaultValue={String(cf[f.key] ?? "")}
                          onBlur={(e) => {
                            const raw = e.target.value;
                            const v = f.type === "NUMBER" && raw !== "" ? Number(raw) : raw;
                            if (String(v) !== String(cf[f.key] ?? "")) update.mutate({ taskId: t.id, customFields: { ...cf, [f.key]: v } });
                          }} />
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No tasks match.</p>}
      </div>
    </div>
  );
}
