"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useProject } from "@/lib/contexts";
import { Card, Empty, ErrorText, Loading, SectionTitle, Select, Stat } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { fmtDate, fromInput, hours } from "@/lib/format";

export default function TimePage() {
  const { project, can } = useProject();
  const projectId = project.id;
  const utils = trpc.useUtils();
  const sum = trpc.time.summary.useQuery({ projectId });
  const entries = trpc.time.forProject.useQuery({ projectId });
  const tasks = trpc.task.listAll.useQuery({ projectId });

  const [taskId, setTaskId] = useState("");
  const [hrs, setHrs] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [billable, setBillable] = useState(false);

  const refresh = () => { utils.time.summary.invalidate({ projectId }); utils.time.forProject.invalidate({ projectId }); };
  const log = trpc.time.log.useMutation({ onSuccess: () => { setHrs(""); setNote(""); refresh(); } });
  const del = trpc.time.delete.useMutation({ onSuccess: refresh });

  if (sum.isLoading) return <Loading />;
  const s = sum.data;
  if (!s) return <ErrorText error={sum.error} />;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Total logged" value={hours(s.totalMinutes)} />
        <Stat label="Billable" value={hours(s.billableMinutes)} />
        <Stat label="Non-billable" value={hours(s.totalMinutes - s.billableMinutes)} />
      </div>
      <ErrorText error={log.error ?? del.error} />

      {can("time:log") && (
        <Card>
          <SectionTitle>Log time</SectionTitle>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const minutes = Math.round(Number(hrs) * 60);
              if (taskId && minutes > 0) log.mutate({ taskId, minutes, date: fromInput(date) ?? new Date(), note: note || undefined, billable });
            }}
          >
            <Select className="w-56" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
              <option value="">Choose a task…</option>
              {tasks.data?.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </Select>
            <Input className="w-24" type="number" min={0} step="0.25" placeholder="Hours" value={hrs} onChange={(e) => setHrs(e.target.value)} />
            <DateInput className="w-40" value={date} onChange={(e) => setDate(e.target.value)} />
            <Input className="min-w-[160px] flex-1" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} /> Billable</label>
            <Button type="submit" disabled={!taskId || !(Number(hrs) > 0) || log.isPending}>Log</Button>
          </form>
        </Card>
      )}

      <section>
        <SectionTitle>By person</SectionTitle>
        {s.perUser.length === 0 ? <Empty>No time logged yet.</Empty> : (
          <ul className="space-y-1 text-sm">
            {s.perUser.map((u) => (
              <li key={u.name} className="flex justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                <span>{u.name}</span><span>{hours(u.minutes)} <span className="text-slate-500">({hours(u.billable)} billable)</span></span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle>Recent entries</SectionTitle>
        <ul className="space-y-1 text-sm">
          {entries.data?.map((e) => (
            <li key={e.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <span className="w-24 text-xs text-slate-500">{fmtDate(e.date)}</span>
              <span className="flex-1">{e.task.title}{e.note && <span className="text-slate-500"> · {e.note}</span>}</span>
              <span className="text-slate-500">{e.user.name}</span>
              <span className="w-16 text-right font-medium">{hours(e.minutes)}</span>
              <button className="text-xs text-red-600" onClick={() => del.mutate({ entryId: e.id })}>✕</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
