"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useProject } from "@/lib/contexts";
import { Badge, Card, Empty, ErrorText, Loading, SectionTitle, Select } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PRIORITIES } from "@/config";
import { cn } from "@/lib/utils";

const RISK_STATUS = ["OPEN", "MITIGATING", "CLOSED", "OCCURRED"] as const;
const ISSUE_STATUS = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
const scoreColor = (s: number) => (s >= 15 ? "bg-red-200" : s >= 8 ? "bg-amber-200" : "bg-green-100");

export default function RisksPage() {
  const { project, can } = useProject();
  const projectId = project.id;
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<"risks" | "issues">("risks");
  const risks = trpc.risk.list.useQuery({ projectId });
  const issues = trpc.issue.list.useQuery({ projectId });

  const reload = () => { utils.risk.list.invalidate({ projectId }); utils.issue.list.invalidate({ projectId }); utils.report.projectDashboard.invalidate({ projectId }); };
  const addRisk = trpc.risk.create.useMutation({ onSuccess: () => { setTitle(""); setResponse(""); reload(); } });
  const updRisk = trpc.risk.update.useMutation({ onSuccess: reload });
  const delRisk = trpc.risk.delete.useMutation({ onSuccess: reload });
  const addIssue = trpc.issue.create.useMutation({ onSuccess: () => { setITitle(""); reload(); } });
  const updIssue = trpc.issue.update.useMutation({ onSuccess: reload });
  const delIssue = trpc.issue.delete.useMutation({ onSuccess: reload });

  const [title, setTitle] = useState("");
  const [prob, setProb] = useState(3);
  const [impact, setImpact] = useState(3);
  const [response, setResponse] = useState("");
  const [iTitle, setITitle] = useState("");
  const [sev, setSev] = useState<(typeof PRIORITIES)[number]>("MEDIUM");

  if (risks.isLoading) return <Loading />;
  const live = (risks.data ?? []).filter((r) => r.status === "OPEN" || r.status === "MITIGATING");
  const scores = [1, 2, 3, 4, 5];

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {(["risks", "issues"] as const).map((t) => (
          <Button key={t} variant={tab === t ? "primary" : "ghost"} onClick={() => setTab(t)}>
            {t === "risks" ? `Risks (${risks.data?.length ?? 0})` : `Issues (${issues.data?.length ?? 0})`}
          </Button>
        ))}
      </div>
      <ErrorText error={addRisk.error ?? updRisk.error ?? delRisk.error ?? addIssue.error ?? updIssue.error ?? delIssue.error} />

      {tab === "risks" && (
        <>
          <Card>
            <SectionTitle>Risk heat map (open risks)</SectionTitle>
            <div className="inline-grid grid-cols-[auto_repeat(5,48px)] gap-1 text-center text-xs">
              {[5, 4, 3, 2, 1].map((imp) => (
                <div key={imp} className="contents">
                  <span className="self-center pr-2 text-slate-500">Impact {imp}</span>
                  {scores.map((p) => {
                    const n = live.filter((r) => r.impact === imp && r.probability === p).length;
                    return (
                      <div key={p} className={cn("flex h-10 items-center justify-center rounded font-semibold", scoreColor(imp * p))}>
                        {n || ""}
                      </div>
                    );
                  })}
                </div>
              ))}
              <span />
              {scores.map((p) => <span key={p} className="text-slate-500">P{p}</span>)}
            </div>
          </Card>

          {risks.data?.length === 0 && <Empty>No risks logged yet.</Empty>}
          <ul className="space-y-2">
            {risks.data?.map((r) => (
              <li key={r.id} className="rounded-xl border border-slate-200/70 bg-white shadow-soft p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={cn("rounded px-2 py-0.5 text-xs font-bold", scoreColor(r.score))}>{r.score}</span>
                  <span className="font-medium">{r.title}</span>
                  <span className="text-xs text-slate-500">P{r.probability} × I{r.impact}</span>
                  <span className="ml-auto flex items-center gap-2">
                    <Select className="w-36" value={r.status} disabled={!can("risk:manage")} onChange={(e) => updRisk.mutate({ riskId: r.id, status: e.target.value as (typeof RISK_STATUS)[number] })}>
                      {RISK_STATUS.map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
                    </Select>
                    {can("risk:manage") && <button className="text-xs text-red-600" onClick={() => delRisk.mutate({ riskId: r.id })}>Delete</button>}
                  </span>
                </div>
                {r.response && <p className="mt-1 text-sm text-slate-600">Response: {r.response}</p>}
              </li>
            ))}
          </ul>

          {can("risk:manage") && (
            <form className="flex flex-wrap items-end gap-2 rounded-xl bg-slate-100/70 p-3" onSubmit={(e) => { e.preventDefault(); if (title.trim().length >= 2) addRisk.mutate({ projectId, title: title.trim(), probability: prob, impact, response: response || undefined }); }}>
              <Input className="min-w-[200px] flex-1" placeholder="Describe the risk" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Select className="w-32" value={prob} onChange={(e) => setProb(Number(e.target.value))}>{scores.map((n) => <option key={n} value={n}>Probability {n}</option>)}</Select>
              <Select className="w-28" value={impact} onChange={(e) => setImpact(Number(e.target.value))}>{scores.map((n) => <option key={n} value={n}>Impact {n}</option>)}</Select>
              <Input className="min-w-[200px] flex-1" placeholder="Planned response (optional)" value={response} onChange={(e) => setResponse(e.target.value)} />
              <Button type="submit" disabled={title.trim().length < 2 || addRisk.isPending}>Add risk</Button>
            </form>
          )}
        </>
      )}

      {tab === "issues" && (
        <>
          {issues.data?.length === 0 && <Empty>No issues logged.</Empty>}
          <ul className="space-y-2">
            {issues.data?.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/70 bg-white shadow-soft p-3">
                <Badge value={i.severity} />
                <span className="font-medium">{i.title}</span>
                <span className="ml-auto flex items-center gap-2">
                  <Select className="w-36" value={i.status} disabled={!can("risk:manage")} onChange={(e) => updIssue.mutate({ issueId: i.id, status: e.target.value as (typeof ISSUE_STATUS)[number] })}>
                    {ISSUE_STATUS.map((s) => <option key={s} value={s}>{s.replace("_", " ").toLowerCase()}</option>)}
                  </Select>
                  {can("risk:manage") && <button className="text-xs text-red-600" onClick={() => delIssue.mutate({ issueId: i.id })}>Delete</button>}
                </span>
              </li>
            ))}
          </ul>
          {can("risk:manage") && (
            <form className="flex flex-wrap gap-2 rounded-xl bg-slate-100/70 p-3" onSubmit={(e) => { e.preventDefault(); if (iTitle.trim().length >= 2) addIssue.mutate({ projectId, title: iTitle.trim(), severity: sev }); }}>
              <Input className="min-w-[200px] flex-1" placeholder="Describe the issue" value={iTitle} onChange={(e) => setITitle(e.target.value)} />
              <Select className="w-32" value={sev} onChange={(e) => setSev(e.target.value as typeof sev)}>{PRIORITIES.map((p) => <option key={p} value={p}>{p.toLowerCase()}</option>)}</Select>
              <Button type="submit" disabled={iTitle.trim().length < 2 || addIssue.isPending}>Add issue</Button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
