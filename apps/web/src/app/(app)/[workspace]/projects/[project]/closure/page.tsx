"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useProject } from "@/lib/contexts";
import { Card, ErrorText, Loading, SectionTitle } from "@/components/ui/kit";
import { GatePanel } from "@/components/lifecycle/gate-panel";
import { money } from "@/lib/format";

// Closing a project: is everything really finished? Then get the final sign-off.
export default function ClosurePage() {
  const { project, slug, has } = useProject();
  const projectId = project.id;
  const dash = trpc.report.projectDashboard.useQuery({ projectId });
  const lessons = trpc.evaluation.lessons.list.useQuery({ projectId }, { enabled: has("evaluation") });
  const expenses = trpc.budget.expenses.useQuery({ projectId }, { enabled: has("budget") });

  if (dash.isLoading) return <Loading />;
  const d = dash.data;
  if (!d) return <ErrorText error={dash.error} />;

  const openTasks = d.tasks.total - d.tasks.done;
  const pendingExpenses = expenses.data?.filter((e) => e.status === "PENDING").length ?? 0;
  const base = `/${slug}/projects/${projectId}`;

  const checks = [
    { ok: openTasks === 0, text: `All tasks are done`, detail: openTasks ? `${openTasks} still open` : undefined, href: `${base}/list` },
    ...(has("changes") ? [{ ok: d.pendingChanges === 0, text: "No change requests waiting", detail: d.pendingChanges ? `${d.pendingChanges} waiting` : undefined, href: `${base}/changes` }] : []),
    ...(has("budget") ? [{ ok: pendingExpenses === 0, text: "All expenses decided", detail: pendingExpenses ? `${pendingExpenses} pending` : undefined, href: `${base}/budget` }] : []),
    ...(has("risks") ? [{ ok: d.openIssues === 0, text: "No open issues", detail: d.openIssues ? `${d.openIssues} open` : undefined, href: `${base}/risks` }] : []),
    ...(has("evaluation") ? [{ ok: (lessons.data?.length ?? 0) > 0, text: "Lessons learned recorded", detail: lessons.data?.length ? undefined : "none yet", href: `${base}/evaluation` }] : []),
  ];

  return (
    <div className="space-y-6">
      <GatePanel projectId={projectId} />

      <Card>
        <SectionTitle>Closure readiness</SectionTitle>
        <ul className="space-y-2 text-sm">
          {checks.map((c) => (
            <li key={c.text} className="flex items-center gap-2">
              <span className={c.ok ? "text-green-600" : "text-amber-600"}>{c.ok ? "✓" : "!"}</span>
              <Link href={c.href} className="hover:underline">{c.text}</Link>
              {c.detail && <span className="text-xs text-slate-500">({c.detail})</span>}
            </li>
          ))}
        </ul>
        {d.budget && d.budget.totalPlanned > 0 && (
          <p className="mt-4 border-t border-slate-100 pt-3 text-sm text-slate-600">
            Final budget position: {money(d.budget.totalSpent, d.project.currency)} spent of {money(d.budget.totalPlanned, d.project.currency)} ({d.budget.burnPct}%), {money(d.budget.remaining, d.project.currency)} remaining.
          </p>
        )}
      </Card>

      <Card>
        <SectionTitle>Records to keep</SectionTitle>
        <p className="mb-2 text-sm text-slate-600">Download the project record before archiving.</p>
        <a className="text-sm text-brand-600 hover:underline" href={`/api/export/tasks?projectId=${projectId}`}>Download all tasks (CSV)</a>
      </Card>
    </div>
  );
}
