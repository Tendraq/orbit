"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { can } from "@/config/permissions";
import { Avatar, Badge, Card, ErrorText, Loading, SectionTitle, Select, Textarea } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { PRIORITIES, STATUS_LABELS, TASK_STATUSES } from "@/config";
import { fmtDate, fromInput, hours, toInput } from "@/lib/format";

const DEP_TYPES = [
  ["FINISH_TO_START", "Finish to start"],
  ["START_TO_START", "Start to start"],
  ["FINISH_TO_FINISH", "Finish to finish"],
  ["START_TO_FINISH", "Start to finish"],
] as const;

export default function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const utils = trpc.useUtils();
  const q = trpc.task.get.useQuery({ taskId: id });
  const task = q.data?.task;
  const projectId = q.data?.project.id ?? "";
  const slug = q.data?.workspace.slug ?? "";
  const role = q.data?.role ?? "GUEST";
  const hasTime = q.data?.workspace.enabledModules.includes("time") ?? false;

  const members = trpc.project.members.useQuery({ projectId }, { enabled: !!projectId });
  const labels = trpc.label.list.useQuery({ workspaceSlug: slug }, { enabled: !!slug });
  const fields = trpc.customField.list.useQuery({ workspaceSlug: slug, entity: "TASK" }, { enabled: !!slug });
  const siblings = trpc.task.listAll.useQuery({ projectId }, { enabled: !!projectId });
  const comments = trpc.comment.list.useQuery({ taskId: id });
  const times = trpc.time.forTask.useQuery({ taskId: id }, { enabled: hasTime });

  const reload = () => { utils.task.get.invalidate({ taskId: id }); utils.task.listAll.invalidate({ projectId }); utils.task.list.invalidate({ projectId }); };
  const update = trpc.task.update.useMutation({ onSuccess: reload });
  const create = trpc.task.create.useMutation({ onSuccess: () => { setSub(""); reload(); } });
  const setLabels = trpc.task.setLabels.useMutation({ onSuccess: reload });
  const addDep = trpc.task.addDependency.useMutation({ onSuccess: () => { setDepOn(""); reload(); } });
  const delDep = trpc.task.removeDependency.useMutation({ onSuccess: reload });
  const addAtt = trpc.task.addAttachment.useMutation({ onSuccess: () => { setAttName(""); setAttUrl(""); reload(); } });
  const delAtt = trpc.task.removeAttachment.useMutation({ onSuccess: reload });
  const addComment = trpc.comment.create.useMutation({ onSuccess: () => { setBody(""); utils.comment.list.invalidate({ taskId: id }); } });
  const delComment = trpc.comment.delete.useMutation({ onSuccess: () => utils.comment.list.invalidate({ taskId: id }) });
  const logTime = trpc.time.log.useMutation({ onSuccess: () => { setHrs(""); utils.time.forTask.invalidate({ taskId: id }); } });

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [sub, setSub] = useState("");
  const [depOn, setDepOn] = useState("");
  const [depType, setDepType] = useState<(typeof DEP_TYPES)[number][0]>("FINISH_TO_START");
  const [lag, setLag] = useState("0");
  const [attName, setAttName] = useState("");
  const [attUrl, setAttUrl] = useState("");
  const [body, setBody] = useState("");
  const [hrs, setHrs] = useState("");

  useEffect(() => { if (task) { setTitle(task.title); setDesc(task.description ?? ""); } }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (q.isLoading) return <Loading />;
  if (!task || !q.data) return <ErrorText error={q.error ?? { message: "Task not found" }} />;

  const edit = can(role, "task:update");
  const cf = (task.customFields ?? {}) as Record<string, string | number>;
  const chosen = new Set(task.labels.map((l) => l.labelId));
  const depIds = new Set(task.dependencies.map((d) => d.dependsOnId));
  const options = siblings.data?.filter((t) => t.id !== task.id && !depIds.has(t.id)) ?? [];
  const err = q.error ?? update.error ?? create.error ?? setLabels.error ?? addDep.error ?? delDep.error ?? addAtt.error ?? delAtt.error ?? addComment.error ?? delComment.error ?? logTime.error;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href={`/${slug}/projects/${projectId}/list`} className="text-sm text-slate-500 hover:underline">← {q.data.project.name}</Link>
      <input
        className="w-full rounded border border-transparent px-2 py-1 text-2xl font-bold hover:border-slate-300 focus:border-brand-500 focus:outline-none"
        value={title} disabled={!edit}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => title.trim() && title !== task.title && update.mutate({ taskId: id, title: title.trim() })}
      />
      <ErrorText error={err} />

      <div className="grid gap-6 md:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          <Card>
            <SectionTitle>Description</SectionTitle>
            <Textarea rows={5} value={desc} disabled={!edit} placeholder="Add details…"
              onChange={(e) => setDesc(e.target.value)}
              onBlur={() => desc !== (task.description ?? "") && update.mutate({ taskId: id, description: desc || null })} />
          </Card>

          <Card>
            <SectionTitle>Subtasks ({task.subtasks.length})</SectionTitle>
            <ul className="space-y-1 text-sm">
              {task.subtasks.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <input type="checkbox" disabled={!edit} checked={s.status === "DONE"} onChange={() => update.mutate({ taskId: s.id, status: s.status === "DONE" ? "TODO" : "DONE" })} />
                  <Link href={`/tasks/${s.id}`} className={s.status === "DONE" ? "text-slate-400 line-through" : "hover:text-brand-600"}>{s.title}</Link>
                </li>
              ))}
            </ul>
            {can(role, "task:create") && !task.parentId && (
              <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (sub.trim()) create.mutate({ projectId, parentId: id, title: sub.trim() }); }}>
                <Input placeholder="Add a subtask" value={sub} onChange={(e) => setSub(e.target.value)} />
                <Button type="submit" variant="ghost" disabled={!sub.trim()}>Add</Button>
              </form>
            )}
          </Card>

          <Card>
            <SectionTitle>Dependencies</SectionTitle>
            <p className="mb-2 text-xs text-slate-500">This task waits for:</p>
            <ul className="space-y-1 text-sm">
              {task.dependencies.map((d) => (
                <li key={d.id} className="flex items-center gap-2">
                  <Link href={`/tasks/${d.dependsOn.id}`} className="hover:text-brand-600">{d.dependsOn.title}</Link>
                  <Badge value={d.dependsOn.status} />
                  <span className="text-xs text-slate-500">{d.type.replace(/_/g, " ").toLowerCase()}{d.lagDays ? `, ${d.lagDays > 0 ? "+" : ""}${d.lagDays}d lag` : ""}</span>
                  {edit && <button className="ml-auto text-xs text-red-600" onClick={() => delDep.mutate({ taskId: id, dependsOnId: d.dependsOn.id })}>Remove</button>}
                </li>
              ))}
              {task.dependencies.length === 0 && <li className="text-slate-400">Nothing</li>}
            </ul>
            {task.dependents.length > 0 && (
              <>
                <p className="mb-1 mt-3 text-xs text-slate-500">These tasks are waiting for this one:</p>
                <ul className="space-y-1 text-sm">{task.dependents.map((d) => <li key={d.id}><Link href={`/tasks/${d.task.id}`} className="hover:text-brand-600">{d.task.title}</Link></li>)}</ul>
              </>
            )}
            {edit && (
              <form className="mt-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (depOn) addDep.mutate({ taskId: id, dependsOnId: depOn, type: depType, lagDays: Math.round(Number(lag)) || 0 }); }}>
                <Select className="w-56" value={depOn} onChange={(e) => setDepOn(e.target.value)}>
                  <option value="">Waits for…</option>
                  {options.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                </Select>
                <Select className="w-40" value={depType} onChange={(e) => setDepType(e.target.value as typeof depType)}>{DEP_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
                <Input className="w-24" type="number" placeholder="Lag (days)" value={lag} onChange={(e) => setLag(e.target.value)} />
                <Button type="submit" variant="ghost" disabled={!depOn}>Add</Button>
              </form>
            )}
          </Card>

          <Card>
            <SectionTitle>Attachments</SectionTitle>
            <p className="mb-2 text-xs text-slate-500">Paste a link to a file (Drive, SharePoint, Dropbox…). Direct uploads come in a later stage.</p>
            <ul className="space-y-1 text-sm">
              {task.attachments.map((a) => (
                <li key={a.id} className="flex items-center gap-2">
                  <a href={a.url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">{a.fileName}</a>
                  <span className="text-xs text-slate-400">{fmtDate(a.createdAt)}</span>
                  {edit && <button className="ml-auto text-xs text-red-600" onClick={() => delAtt.mutate({ attachmentId: a.id })}>Remove</button>}
                </li>
              ))}
              {task.attachments.length === 0 && <li className="text-slate-400">No attachments</li>}
            </ul>
            {edit && (
              <form className="mt-2 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (attName.trim() && attUrl.trim()) addAtt.mutate({ taskId: id, fileName: attName.trim(), url: attUrl.trim() }); }}>
                <Input className="w-48" placeholder="Name" value={attName} onChange={(e) => setAttName(e.target.value)} />
                <Input className="min-w-[220px] flex-1" placeholder="https://…" value={attUrl} onChange={(e) => setAttUrl(e.target.value)} />
                <Button type="submit" variant="ghost" disabled={!attName.trim() || !attUrl.trim()}>Add link</Button>
              </form>
            )}
          </Card>

          {hasTime && (
            <Card>
              <SectionTitle right={<span className="text-sm text-slate-500">{hours(times.data?.reduce((n, t) => n + t.minutes, 0) ?? 0)} logged</span>}>Time</SectionTitle>
              <ul className="space-y-1 text-sm">
                {times.data?.map((t) => <li key={t.id} className="flex gap-3"><span className="w-24 text-xs text-slate-500">{fmtDate(t.date)}</span><span>{hours(t.minutes)}</span><span className="text-slate-500">{t.user.name}{t.note && ` · ${t.note}`}</span></li>)}
              </ul>
              {can(role, "time:log") && (
                <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); const m = Math.round(Number(hrs) * 60); if (m > 0) logTime.mutate({ taskId: id, minutes: m }); }}>
                  <Input className="w-28" type="number" min={0} step="0.25" placeholder="Hours" value={hrs} onChange={(e) => setHrs(e.target.value)} />
                  <Button type="submit" variant="ghost" disabled={!(Number(hrs) > 0)}>Log time</Button>
                </form>
              )}
            </Card>
          )}

          <Card>
            <SectionTitle>Comments ({comments.data?.length ?? 0})</SectionTitle>
            <ul className="space-y-3">
              {comments.data?.map((c) => (
                <li key={c.id} className="flex gap-2 text-sm">
                  <Avatar name={c.author.name ?? c.author.email} size={28} />
                  <div className="flex-1">
                    <p><b>{c.author.name ?? c.author.email}</b> <span className="text-xs text-slate-400">{new Date(c.createdAt).toLocaleString("en-GB")}</span></p>
                    <p className="whitespace-pre-wrap text-slate-700">{c.body}</p>
                  </div>
                  {(can(role, "task:delete") ) && <button className="text-xs text-red-600" onClick={() => delComment.mutate({ commentId: c.id })}>Delete</button>}
                </li>
              ))}
            </ul>
            {can(role, "comment:create") && (
              <form className="mt-3 space-y-2" onSubmit={(e) => { e.preventDefault(); if (body.trim()) addComment.mutate({ taskId: id, body: body.trim() }); }}>
                <Textarea rows={3} placeholder="Write a comment…" value={body} onChange={(e) => setBody(e.target.value)} />
                <Button type="submit" disabled={!body.trim() || addComment.isPending}>Comment</Button>
              </form>
            )}
          </Card>
        </div>

        {/* side panel */}
        <aside className="space-y-4">
          <Card className="space-y-3">
            <label className="block text-sm"><span className="mb-1 block text-xs font-medium text-slate-600">Status</span>
              <Select value={task.status} disabled={!edit} onChange={(e) => update.mutate({ taskId: id, status: e.target.value as (typeof TASK_STATUSES)[number] })}>
                {TASK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </Select></label>
            <label className="block text-sm"><span className="mb-1 block text-xs font-medium text-slate-600">Priority</span>
              <Select value={task.priority} disabled={!edit} onChange={(e) => update.mutate({ taskId: id, priority: e.target.value as (typeof PRIORITIES)[number] })}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p.toLowerCase()}</option>)}
              </Select></label>
            <label className="block text-sm"><span className="mb-1 block text-xs font-medium text-slate-600">Assignee</span>
              <Select value={task.assigneeId ?? ""} disabled={!edit} onChange={(e) => update.mutate({ taskId: id, assigneeId: e.target.value || null })}>
                <option value="">Unassigned</option>
                {members.data?.map((m) => <option key={m.id} value={m.id}>{m.name ?? m.email}</option>)}
              </Select></label>
            <label className="block text-sm"><span className="mb-1 block text-xs font-medium text-slate-600">Start date</span>
              <DateInput disabled={!edit} defaultValue={toInput(task.startDate)} onBlur={(e) => e.target.value !== toInput(task.startDate) && update.mutate({ taskId: id, startDate: fromInput(e.target.value) })} /></label>
            <label className="block text-sm"><span className="mb-1 block text-xs font-medium text-slate-600">Due date</span>
              <DateInput disabled={!edit} defaultValue={toInput(task.dueDate)} onBlur={(e) => e.target.value !== toInput(task.dueDate) && update.mutate({ taskId: id, dueDate: fromInput(e.target.value) })} /></label>
            <label className="block text-sm"><span className="mb-1 block text-xs font-medium text-slate-600">Estimate (hours)</span>
              <Input type="number" min={0} step="0.5" disabled={!edit} defaultValue={task.estimateHours ?? ""}
                onBlur={(e) => { const v = e.target.value === "" ? null : Number(e.target.value); if (v !== task.estimateHours) update.mutate({ taskId: id, estimateHours: v }); }} /></label>
            {fields.data?.map((f) => (
              <label key={f.id} className="block text-sm"><span className="mb-1 block text-xs font-medium text-slate-600">{f.label}</span>
                {f.type === "SELECT" ? (
                  <Select disabled={!edit} value={String(cf[f.key] ?? "")} onChange={(e) => update.mutate({ taskId: id, customFields: { ...cf, [f.key]: e.target.value } })}>
                    <option value="">—</option>{f.options.map((o) => <option key={o}>{o}</option>)}
                  </Select>
                ) : (
                  <Input type={f.type === "NUMBER" ? "number" : f.type === "DATE" ? "date" : "text"} disabled={!edit} defaultValue={String(cf[f.key] ?? "")}
                    onBlur={(e) => { const raw = e.target.value; const v = f.type === "NUMBER" && raw !== "" ? Number(raw) : raw; if (String(v) !== String(cf[f.key] ?? "")) update.mutate({ taskId: id, customFields: { ...cf, [f.key]: v } }); }} />
                )}
              </label>
            ))}
          </Card>

          <Card>
            <p className="mb-2 text-xs font-medium text-slate-600">Labels</p>
            <div className="flex flex-wrap gap-1.5">
              {labels.data?.map((l) => {
                const on = chosen.has(l.id);
                return (
                  <button key={l.id} disabled={!edit} className="rounded-full border px-2 py-0.5 text-xs"
                    style={on ? { background: l.color, color: "#fff", borderColor: l.color } : { borderColor: l.color, color: l.color }}
                    onClick={() => setLabels.mutate({ taskId: id, labelIds: on ? [...chosen].filter((x) => x !== l.id) : [...chosen, l.id] })}>
                    {l.name}
                  </button>
                );
              })}
              {labels.data?.length === 0 && <span className="text-xs text-slate-400">Create labels in organization settings.</span>}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
