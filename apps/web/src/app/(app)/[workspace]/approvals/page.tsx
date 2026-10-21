"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useWorkspace } from "@/lib/contexts";
import { Badge, Card, Empty, ErrorText, Loading, SectionTitle } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PHASE_LABELS, type Phase } from "@/config";
import { fmtDate, money } from "@/lib/format";

// Everything waiting for an owner or admin to decide, in one place.
export default function ApprovalsPage() {
  const ws = useWorkspace();
  const utils = trpc.useUtils();
  const q = trpc.report.approvals.useQuery({ workspaceSlug: ws.slug });
  const [notes, setNotes] = useState<Record<string, string>>({});

  const reload = () => { utils.report.approvals.invalidate(); utils.report.attention.invalidate(); };
  const expense = trpc.budget.decideExpense.useMutation({ onSuccess: reload });
  const change = trpc.change.decide.useMutation({ onSuccess: reload });

  if (q.isLoading) return <Loading />;
  const d = q.data;
  if (!d) return <ErrorText error={q.error} />;
  const link = (projectId: string, tab: string) => `/${ws.slug}/projects/${projectId}/${tab}`;

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Approvals</h2>
        <p className="text-sm text-slate-500">{d.total === 0 ? "Nothing is waiting for you." : `${d.total} item(s) waiting for a decision.`}</p>
      </div>
      <ErrorText error={expense.error ?? change.error} />
      {d.total === 0 && <Empty>You are all caught up. New requests will appear here and in your notifications.</Empty>}

      {d.gates.length > 0 && (
        <section>
          <SectionTitle>Stage gates ({d.gates.length})</SectionTitle>
          <ul className="space-y-2">
            {d.gates.map((g) => (
              <Card key={g.id} className="flex flex-wrap items-center gap-3">
                <div className="flex-1">
                  <p className="font-medium">{g.project.name}</p>
                  <p className="text-sm text-slate-500">Ready to leave: {PHASE_LABELS[g.phase as Phase]} · submitted {fmtDate(g.submittedAt)}</p>
                </div>
                <Link href={link(g.project.id, "overview")} className="rounded-lg bg-gradient-to-b from-brand-500 to-brand-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm">Review and decide</Link>
              </Card>
            ))}
          </ul>
        </section>
      )}

      {d.changes.length > 0 && (
        <section>
          <SectionTitle>Change requests ({d.changes.length})</SectionTitle>
          <ul className="space-y-3">
            {d.changes.map((c) => (
              <Card key={c.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{c.title}</p>
                  <Link href={link(c.project.id, "changes")} className="text-xs text-brand-600 hover:underline">{c.project.name}</Link>
                </div>
                {c.description && <p className="mt-1 text-sm text-slate-600">{c.description}</p>}
                <p className="mt-1 text-sm">Cost: <b>{money(c.costImpact, c.project.currency)}</b> · Schedule: <b>{c.scheduleImpactDays} days</b></p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Input className="max-w-xs" placeholder="Decision note (optional)" value={notes[c.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [c.id]: e.target.value }))} />
                  <Button disabled={change.isPending} onClick={() => change.mutate({ changeId: c.id, approve: true, note: notes[c.id] })}>Approve</Button>
                  <Button variant="danger" disabled={change.isPending} onClick={() => change.mutate({ changeId: c.id, approve: false, note: notes[c.id] })}>Reject</Button>
                </div>
              </Card>
            ))}
          </ul>
        </section>
      )}

      {d.expenses.length > 0 && (
        <section>
          <SectionTitle>Expenses ({d.expenses.length})</SectionTitle>
          <ul className="space-y-2">
            {d.expenses.map((x) => (
              <Card key={x.id} className="flex flex-wrap items-center gap-3">
                <div className="flex-1">
                  <p className="font-medium">{x.description}</p>
                  <p className="text-sm text-slate-500">{x.project.name}{x.budgetLine ? ` · ${x.budgetLine.category}` : ""} · {fmtDate(x.date)}</p>
                </div>
                <span className="font-semibold">{money(x.amount, x.project.currency)}</span>
                <Button disabled={expense.isPending} onClick={() => expense.mutate({ expenseId: x.id, approve: true })}>Approve</Button>
                <Button variant="danger" disabled={expense.isPending} onClick={() => expense.mutate({ expenseId: x.id, approve: false })}>Reject</Button>
              </Card>
            ))}
          </ul>
        </section>
      )}

      {d.reports.length > 0 && (
        <section>
          <SectionTitle>Donor reports submitted ({d.reports.length})</SectionTitle>
          <ul className="space-y-2">
            {d.reports.map((r) => (
              <Card key={r.id} className="flex flex-wrap items-center gap-3">
                <div className="flex-1">
                  <p className="font-medium">{r.title}</p>
                  <p className="text-sm text-slate-500">{r.project.name} · {fmtDate(r.periodStart)} to {fmtDate(r.periodEnd)}</p>
                </div>
                <Badge value="SUBMITTED" />
                <a href={`/api/export/donor-report/${r.id}`} target="_blank" rel="noreferrer" className="text-sm text-brand-600 hover:underline">Open</a>
                <Link href={link(r.project.id, "reports")} className="text-sm text-brand-600 hover:underline">Manage</Link>
              </Card>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
