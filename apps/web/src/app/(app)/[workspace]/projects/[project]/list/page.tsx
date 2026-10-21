"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useProject } from "@/lib/contexts";
import { Avatar, Badge, Empty, ErrorText, Loading, Select } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { fmtDate, fromInput, isOverdue } from "@/lib/format";
import { PRIORITIES } from "@/config";

export default function TaskListPage() {
  const { project, can } = useProject();
  const projectId = project.id;
  const utils = trpc.useUtils();
  const data = trpc.task.list.useQuery({ projectId });
  const members = trpc.project.members.useQuery({ projectId });
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>("MEDIUM");
  const [assigneeId, setAssigneeId] = useState("");
  const [due, setDue] = useState("");

  const refresh = () => { utils.task.list.invalidate({ projectId }); utils.task.listAll.invalidate({ projectId }); };
  const create = trpc.task.create.useMutation({ onSuccess: refresh });
  const update = trpc.task.update.useMutation({ onSuccess: refresh });
  const remove = trpc.task.delete.useMutation({ onSuccess: refresh });

  const toggle = (id: string, status: string) =>
    update.mutate({ taskId: id, status: status === "DONE" ? "TODO" : "DONE" });

  const addSubtask = (parentId: string) => {
    const t = window.prompt("Subtask title");
    if (t?.trim()) create.mutate({ projectId, parentId, title: t.trim() });
  };

  if (data.isLoading) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{data.data?.tasks.length ?? 0} top-level tasks</p>
        <a href={`/api/export/tasks?projectId=${projectId}`} className="text-sm text-brand-600 hover:underline">
          Download CSV
        </a>
      </div>
      <ErrorText error={data.error ?? create.error ?? update.error ?? remove.error} />

      <ul className="space-y-2">
        {data.data?.tasks.map((task) => (
          <li key={task.id} className="rounded-xl border border-slate-200/70 bg-white shadow-soft p-3">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="checkbox"
                checked={task.status === "DONE"}
                disabled={!can("task:update")}
                onChange={() => toggle(task.id, task.status)}
              />
              <Link href={`/tasks/${task.id}`} className={task.status === "DONE" ? "text-slate-400 line-through" : "font-medium hover:text-brand-600"}>
                {task.title}
              </Link>
              <Badge value={task.priority} />
              {task.status !== "DONE" && task.status !== "TODO" && <Badge value={task.status} />}
              {task.dueDate && (
                <span className={isOverdue(task.dueDate, task.status) ? "text-xs font-medium text-red-600" : "text-xs text-slate-500"}>
                  {fmtDate(task.dueDate)}
                </span>
              )}
              <span className="ml-auto flex items-center gap-1">
                <Avatar name={task.assignee?.name} />
                {can("task:create") && <Button variant="ghost" onClick={() => addSubtask(task.id)}>+ subtask</Button>}
                {can("task:delete") && (
                  <Button variant="danger" onClick={() => remove.mutate({ taskId: task.id })}>Delete</Button>
                )}
              </span>
            </div>

            {task.subtasks.length > 0 && (
              <ul className="mt-2 space-y-1 border-l-2 border-slate-100 pl-6">
                {task.subtasks.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={s.status === "DONE"}
                      disabled={!can("task:update")}
                      onChange={() => toggle(s.id, s.status)}
                    />
                    <Link href={`/tasks/${s.id}`} className={s.status === "DONE" ? "text-slate-400 line-through" : "hover:text-brand-600"}>
                      {s.title}
                    </Link>
                    {can("task:delete") && (
                      <Button variant="danger" className="ml-auto" onClick={() => remove.mutate({ taskId: s.id })}>
                        Delete
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      {data.data?.tasks.length === 0 && <Empty>No tasks yet. Add the first one below.</Empty>}

      {can("task:create") && (
        <form
          className="flex flex-wrap gap-2 rounded-xl bg-slate-100/70 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(
              { projectId, title, priority, assigneeId: assigneeId || null, dueDate: fromInput(due) },
              { onSuccess: () => { setTitle(""); setDue(""); } }
            );
          }}
        >
          <Input className="min-w-[200px] flex-1" placeholder="Add a task" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Select className="w-32" value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p.toLowerCase()}</option>)}
          </Select>
          <Select className="w-40" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            <option value="">Unassigned</option>
            {members.data?.map((m) => <option key={m.id} value={m.id}>{m.name ?? m.email}</option>)}
          </Select>
          <DateInput className="w-40" value={due} onChange={(e) => setDue(e.target.value)} />
          <Button type="submit" disabled={!title.trim() || create.isPending}>Add</Button>
        </form>
      )}
    </div>
  );
}
