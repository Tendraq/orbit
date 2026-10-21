"use client";

import { useState } from "react";
import { trpc, type Out } from "@/lib/trpc";
import { useProject } from "@/lib/contexts";
import { Badge, Card, Empty, ErrorText, Loading, ProgressBar, SectionTitle, Select } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { fmtDate, fromInput } from "@/lib/format";

type Ind = Out["indicator"]["list"][number];
const FREQ = ["MONTHLY", "QUARTERLY", "BIANNUAL", "ANNUAL", "ONE_OFF"] as const;

// "female=120, male=80"  ->  { female: 120, male: 80 }
function parseBreakdown(text: string) {
  const out: Record<string, number> = {};
  for (const part of text.split(",")) {
    const [k, v] = part.split("=").map((s) => s.trim());
    if (k && v !== undefined && !Number.isNaN(Number(v))) out[k] = Number(v);
  }
  return Object.keys(out).length ? out : undefined;
}

function Values({ ind, canEnter, canManage }: { ind: Ind; canEnter: boolean; canManage: boolean }) {
  const { project } = useProject();
  const utils = trpc.useUtils();
  const vals = trpc.indicator.values.useQuery({ indicatorId: ind.id });
  const reload = () => { utils.indicator.values.invalidate({ indicatorId: ind.id }); utils.indicator.list.invalidate({ projectId: project.id }); utils.report.projectDashboard.invalidate({ projectId: project.id }); };
  const add = trpc.indicator.addValue.useMutation({ onSuccess: () => { setValue(""); setNote(""); setBreak(""); reload(); } });
  const del = trpc.indicator.deleteValue.useMutation({ onSuccess: reload });
  const [period, setPeriod] = useState("");
  const [start, setStart] = useState("");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [brk, setBreak] = useState("");

  return (
    <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-sm">
      <ErrorText error={add.error ?? del.error} />
      {vals.data?.length === 0 && <p className="text-slate-500">No data recorded yet.</p>}
      <ul className="space-y-1">
        {vals.data?.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center gap-3">
            <span className="w-24 font-medium">{v.period}</span>
            <span>{v.value} {ind.unit}</span>
            {v.disaggregation && <span className="text-xs text-slate-500">{Object.entries(v.disaggregation as Record<string, number>).map(([k, n]) => `${k}: ${n}`).join(", ")}</span>}
            {v.note && <span className="text-xs italic text-slate-500">{v.note}</span>}
            <span className="ml-auto text-xs text-slate-400">{fmtDate(v.periodStart)}</span>
            {canManage && <button className="text-xs text-red-600" onClick={() => del.mutate({ valueId: v.id })}>✕</button>}
          </li>
        ))}
      </ul>
      {canEnter && (
        <form className="flex flex-wrap gap-2 rounded-lg bg-slate-100 p-2"
          onSubmit={(e) => { e.preventDefault(); const ps = fromInput(start); if (period.trim() && ps && value !== "") add.mutate({ indicatorId: ind.id, period: period.trim(), periodStart: ps, value: Number(value), disaggregation: parseBreakdown(brk), note: note || undefined }); }}>
          <Input className="w-28" placeholder="Period (2026-Q1)" value={period} onChange={(e) => setPeriod(e.target.value)} />
          <DateInput className="w-40" value={start} onChange={(e) => setStart(e.target.value)} />
          <Input className="w-28" type="number" placeholder={`Value (${ind.unit})`} value={value} onChange={(e) => setValue(e.target.value)} />
          <Input className="w-56" placeholder={ind.disaggregateBy.length ? `Breakdown: ${ind.disaggregateBy[0]}=10, ...` : "Breakdown (optional) a=1, b=2"} value={brk} onChange={(e) => setBreak(e.target.value)} />
          <Input className="min-w-[140px] flex-1" placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button type="submit" disabled={add.isPending}>Record</Button>
        </form>
      )}
    </div>
  );
}

export default function IndicatorsPage() {
  const { project, can } = useProject();
  const projectId = project.id;
  const utils = trpc.useUtils();
  const q = trpc.indicator.list.useQuery({ projectId });
  const frame = trpc.logframe.list.useQuery({ projectId });
  const reload = () => { utils.indicator.list.invalidate({ projectId }); utils.report.projectDashboard.invalidate({ projectId }); };
  const create = trpc.indicator.create.useMutation({ onSuccess: () => { setName(""); setBaseline("0"); setTarget(""); setSource(""); setDis(""); reload(); } });
  const del = trpc.indicator.delete.useMutation({ onSuccess: reload });

  const [open, setOpen] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("number");
  const [baseline, setBaseline] = useState("0");
  const [target, setTarget] = useState("");
  const [freq, setFreq] = useState<(typeof FREQ)[number]>("QUARTERLY");
  const [source, setSource] = useState("");
  const [itemId, setItemId] = useState("");
  const [dis, setDis] = useState("");

  if (q.isLoading) return <Loading />;

  return (
    <div className="space-y-6">
      <ErrorText error={q.error ?? create.error ?? del.error} />
      {q.data?.length === 0 && <Empty>No indicators yet. Define what success looks like, with a baseline and a target.</Empty>}
      <ul className="space-y-3">
        {q.data?.map((i) => (
          <Card key={i.id}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{i.name}</span>
              {i.logframeItem && <Badge tone="slate">{i.logframeItem.code}</Badge>}
              <Badge tone={i.onTrack ? "green" : "amber"}>{i.progressPct}%</Badge>
              <span className="ml-auto flex gap-3 text-xs">
                <button className="text-brand-600" onClick={() => setOpen(open === i.id ? null : i.id)}>{open === i.id ? "Hide data" : "Data"}</button>
                {can("ngo:manage") && <button className="text-red-600" onClick={() => window.confirm("Delete this indicator and its data?") && del.mutate({ indicatorId: i.id })}>Delete</button>}
              </span>
            </div>
            <div className="my-2"><ProgressBar pct={i.progressPct} tone={i.onTrack ? "green" : "amber"} /></div>
            <p className="text-xs text-slate-500">
              Baseline {i.baseline} → Target {i.target} {i.unit} · Latest: {i.latestValue ?? "no data"}{i.latestPeriod && ` (${i.latestPeriod})`} · {i.frequency.toLowerCase()}
              {i.dataSource && ` · Source: ${i.dataSource}`}
            </p>
            {open === i.id && <Values ind={i} canEnter={can("ngo:data")} canManage={can("ngo:manage")} />}
          </Card>
        ))}
      </ul>

      {can("ngo:manage") && (
        <Card>
          <SectionTitle>New indicator</SectionTitle>
          <form className="grid gap-2 md:grid-cols-3"
            onSubmit={(e) => { e.preventDefault(); if (name.trim().length >= 2 && target !== "") create.mutate({ projectId, logframeItemId: itemId || null, name: name.trim(), unit: unit || "number", baseline: Number(baseline) || 0, target: Number(target), frequency: freq, dataSource: source || undefined, disaggregateBy: dis.split(",").map((s) => s.trim()).filter(Boolean) }); }}>
            <Input className="md:col-span-3" placeholder="Indicator (e.g. Number of households with safe water)" value={name} onChange={(e) => setName(e.target.value)} />
            <Select value={itemId} onChange={(e) => setItemId(e.target.value)}>
              <option value="">Link to logframe item (optional)</option>
              {frame.data?.map((f) => <option key={f.id} value={f.id}>{f.code} · {f.statement.slice(0, 40)}</option>)}
            </Select>
            <Input placeholder="Unit (number, %, USD…)" value={unit} onChange={(e) => setUnit(e.target.value)} />
            <Select value={freq} onChange={(e) => setFreq(e.target.value as typeof freq)}>{FREQ.map((f) => <option key={f} value={f}>{f.replace("_", " ").toLowerCase()}</option>)}</Select>
            <Input type="number" placeholder="Baseline" value={baseline} onChange={(e) => setBaseline(e.target.value)} />
            <Input type="number" placeholder="Target" value={target} onChange={(e) => setTarget(e.target.value)} />
            <Input placeholder="Data source" value={source} onChange={(e) => setSource(e.target.value)} />
            <Input className="md:col-span-2" placeholder="Disaggregate by (comma separated: gender, age, location)" value={dis} onChange={(e) => setDis(e.target.value)} />
            <Button type="submit" disabled={name.trim().length < 2 || target === "" || create.isPending}>Add indicator</Button>
          </form>
        </Card>
      )}
    </div>
  );
}
