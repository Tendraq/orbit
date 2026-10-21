"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useProject } from "@/lib/contexts";
import { Badge, Card, Empty, ErrorText, Loading, ProgressBar, SectionTitle, Stat } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { GatePanel } from "@/components/lifecycle/gate-panel";
import { fmtDate, fromInput, label, money } from "@/lib/format";
import { STATUS_LABELS, TASK_STATUSES } from "@/config";

export default function OverviewPage() {
  const { project, can, has } = useProject();
  const projectId = project.id;
  const utils = trpc.useUtils();
  const dash = trpc.report.projectDashboard.useQuery({ projectId });
  const activity = trpc.project.activity.useQuery({ projectId });
  const [msName, setMsName] = useState("");
  const [msDate, setMsDate] = useState("");

  const refresh = () => utils.report.projectDashboard.invalidate({ projectId });
  const setHealth = trpc.project.update.useMutation({
    onSuccess: () => { refresh(); utils.project.get.invalidate({ projectId }); },
  });
  const addMs = trpc.milestone.create.useMutation({ onSuccess: () => { setMsName(""); setMsDate(""); refresh(); } });
  const toggleMs = trpc.milestone.toggleDone.useMutation({ onSuccess: refresh });
  const delMs = trpc.milestone.delete.useMutation({ onSuccess: refresh });

  if (dash.isLoading) return <Loading />;
  const d = dash.data;
  if (!d) return <ErrorText error={dash.error} />;

  const cur = d.project.currency;

  return (
    <div className="space-y-8">
      <GatePanel projectId={projectId} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Progress" value={`${d.tasks.progressPct}%`} hint={`${d.tasks.done} of ${d.tasks.total} tasks done`} />
        <Stat label="Overdue" value={d.tasks.overdue} tone={d.tasks.overdue ? "red" : undefined} hint="open tasks past due" />
        <Stat label="Due in 7 days" value={d.tasks.dueSoon} />
        <Stat label="Unassigned" value={d.tasks.unassigned} tone={d.tasks.unassigned ? "amber" : undefined} hint="open tasks, no owner" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* health */}
        <Card>
          <SectionTitle>Project health</SectionTitle>
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm text-slate-600">Now:</span>
            <Badge value={d.project.health} />
            <span className="ml-2 text-sm text-slate-600">Suggested:</span>
            <Badge value={d.suggestedHealth.level} />
          </div>
          {d.suggestedHealth.reasons.length > 0 ? (
            <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
              {d.suggestedHealth.reasons.map((r) => <li key={r}>{r}</li>)}
            </ul>
          ) : (
            <p className="mb-3 text-sm text-slate-500">No warning signs found in tasks, budget or risks.</p>
          )}
          {can("project:update") && (
            <div className="flex gap-2">
              {(["GREEN", "AMBER", "RED"] as const).map((h) => (
                <Button
                  key={h}
                  variant="ghost"
                  disabled={d.project.health === h || setHealth.isPending}
                  onClick={() => setHealth.mutate({ projectId, health: h })}
                >
                  Set {h.toLowerCase()}
                </Button>
              ))}
            </div>
          )}
        </Card>

        {/* tasks by status */}
        <Card>
          <SectionTitle>Tasks by status</SectionTitle>
          <ul className="space-y-2">
            {TASK_STATUSES.map((s) => {
              const n = d.tasks.byStatus[s] ?? 0;
              return (
                <li key={s} className="text-sm">
                  <div className="mb-1 flex justify-between"><span>{STATUS_LABELS[s]}</span><span>{n}</span></div>
                  <ProgressBar pct={d.tasks.total ? (n / d.tasks.total) * 100 : 0} tone={s === "DONE" ? "green" : "brand"} />
                </li>
              );
            })}
          </ul>
        </Card>

        {/* budget */}
        {d.budget && (
          <Card>
            <SectionTitle>Budget</SectionTitle>
            {d.budget.totalPlanned === 0 ? (
              <p className="text-sm text-slate-500">No budget lines yet.</p>
            ) : (
              <>
                <p className="text-sm">
                  <b>{money(d.budget.totalSpent, cur)}</b> spent of {money(d.budget.totalPlanned, cur)} ({d.budget.burnPct}%)
                </p>
                <div className="my-2">
                  <ProgressBar pct={d.budget.burnPct} tone={d.budget.burnPct > 100 ? "red" : d.budget.burnPct > 85 ? "amber" : "green"} />
                </div>
                <p className="text-xs text-slate-500">
                  Remaining {money(d.budget.remaining, cur)}
                  {d.budget.totalPending > 0 && ` · ${money(d.budget.totalPending, cur)} awaiting approval`}
                </p>
              </>
            )}
          </Card>
        )}

        {/* risks */}
        {has("risks") && (
          <Card>
            <SectionTitle>Top risks</SectionTitle>
            {d.topRisks.length === 0 ? (
              <p className="text-sm text-slate-500">No open risks.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {d.topRisks.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <span>{r.title}</span>
                    <Badge tone={r.score >= 15 ? "red" : r.score >= 8 ? "amber" : "slate"}>Score {r.score}</Badge>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-slate-500">
              {d.openIssues} open issue(s)
              {has("changes") && ` · ${d.pendingChanges} change request(s) awaiting a decision`}
            </p>
          </Card>
        )}

        {/* NGO results */}
        {has("ngo") && (
          <Card>
            <SectionTitle>Results</SectionTitle>
            {d.indicators.count === 0 ? (
              <p className="text-sm text-slate-500">No indicators yet. Define them in the Indicators tab.</p>
            ) : (
              <>
                <p className="text-sm">Average progress toward targets: <b>{d.indicators.averageProgress}%</b> across {d.indicators.count} indicators</p>
                <div className="mt-2"><ProgressBar pct={d.indicators.averageProgress ?? 0} tone="green" /></div>
              </>
            )}
          </Card>
        )}

        {/* milestones */}
        <Card>
          <SectionTitle>Milestones</SectionTitle>
          {d.milestones.length === 0 && <p className="text-sm text-slate-500">No milestones yet.</p>}
          <ul className="space-y-1.5 text-sm">
            {d.milestones.map((m) => (
              <li key={m.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!m.doneAt}
                  disabled={!can("project:update")}
                  onChange={(e) => toggleMs.mutate({ milestoneId: m.id, done: e.target.checked })}
                />
                <span className={m.doneAt ? "text-slate-400 line-through" : ""}>{m.name}</span>
                <span className="ml-auto text-xs text-slate-500">{fmtDate(m.dueDate)}</span>
                {can("project:update") && (
                  <button className="text-xs text-red-600" onClick={() => delMs.mutate({ milestoneId: m.id })}>✕</button>
                )}
              </li>
            ))}
          </ul>
          {can("project:update") && (
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const due = fromInput(msDate);
                if (msName.trim() && due) addMs.mutate({ projectId, name: msName.trim(), dueDate: due });
              }}
            >
              <Input placeholder="New milestone" value={msName} onChange={(e) => setMsName(e.target.value)} />
              <DateInput className="w-40" value={msDate} onChange={(e) => setMsDate(e.target.value)} />
              <Button type="submit" variant="ghost">Add</Button>
            </form>
          )}
          <ErrorText error={addMs.error} />
        </Card>
      </div>

      {/* activity */}
      <div>
        <SectionTitle>Recent activity</SectionTitle>
        {activity.data?.length === 0 && <Empty>No activity yet.</Empty>}
        <ul className="space-y-1 text-sm text-slate-600">
          {activity.data?.slice(0, 12).map((a) => (
            <li key={a.id}>
              <span className="text-xs text-slate-400">{fmtDate(a.createdAt)}</span> · {label(a.action.replace(".", " "))}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
