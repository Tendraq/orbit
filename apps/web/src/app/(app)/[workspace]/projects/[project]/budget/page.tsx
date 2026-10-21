"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useProject } from "@/lib/contexts";
import { Badge, Empty, ErrorText, Loading, ProgressBar, SectionTitle, Select, Stat } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { fmtDate, fromInput, money } from "@/lib/format";

export default function BudgetPage() {
  const { project, can } = useProject();
  const projectId = project.id;
  const cur = project.currency;
  const utils = trpc.useUtils();
  const sum = trpc.budget.summary.useQuery({ projectId });
  const exps = trpc.budget.expenses.useQuery({ projectId });

  const refresh = () => {
    utils.budget.summary.invalidate({ projectId });
    utils.budget.expenses.invalidate({ projectId });
    utils.report.projectDashboard.invalidate({ projectId });
  };
  const addLine = trpc.budget.createLine.useMutation({ onSuccess: () => { setCat(""); setPlanned(""); refresh(); } });
  const updLine = trpc.budget.updateLine.useMutation({ onSuccess: refresh });
  const delLine = trpc.budget.deleteLine.useMutation({ onSuccess: refresh });
  const addExp = trpc.budget.createExpense.useMutation({ onSuccess: () => { setDesc(""); setAmount(""); refresh(); } });
  const decide = trpc.budget.decideExpense.useMutation({ onSuccess: refresh });
  const delExp = trpc.budget.deleteExpense.useMutation({ onSuccess: refresh });

  const [cat, setCat] = useState("");
  const [planned, setPlanned] = useState("");
  const [lineId, setLineId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [desc, setDesc] = useState("");

  if (sum.isLoading) return <Loading />;
  const s = sum.data;
  if (!s) return <ErrorText error={sum.error} />;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Planned" value={money(s.totalPlanned, cur)} />
        <Stat label="Spent (approved)" value={money(s.totalSpent, cur)} hint={`${s.burnPct}% of budget`} tone={s.burnPct > 100 ? "red" : s.burnPct > 85 ? "amber" : undefined} />
        <Stat label="Awaiting approval" value={money(s.totalPending, cur)} />
        <Stat label="Remaining" value={money(s.remaining, cur)} tone={s.remaining < 0 ? "red" : undefined} />
      </div>
      <ErrorText error={addLine.error ?? updLine.error ?? delLine.error ?? addExp.error ?? decide.error ?? delExp.error} />

      <section>
        <SectionTitle>Budget lines</SectionTitle>
        {s.lines.length === 0 ? <Empty>No budget lines yet.</Empty> : (
          <div className="overflow-x-auto rounded-xl border border-slate-200/70 bg-white shadow-soft">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr><th className="p-2">Category</th><th className="p-2">Planned</th><th className="p-2">Spent</th><th className="p-2">Pending</th><th className="p-2">Remaining</th><th className="w-40 p-2">Used</th><th /></tr>
              </thead>
              <tbody>
                {s.lines.map((l) => (
                  <tr key={l.id} className="border-t border-slate-100">
                    <td className="p-2 font-medium">{l.category}</td>
                    <td className="p-2">
                      {can("budget:manage") ? (
                        <input type="number" min={0} defaultValue={l.planned} className="w-28 rounded border border-transparent px-1 hover:border-slate-300"
                          onBlur={(e) => Number(e.target.value) !== l.planned && updLine.mutate({ lineId: l.id, planned: Number(e.target.value) })} />
                      ) : money(l.planned, cur)}
                    </td>
                    <td className="p-2">{money(l.spent, cur)}</td>
                    <td className="p-2 text-slate-500">{money(l.pending, cur)}</td>
                    <td className={`p-2 ${l.remaining < 0 ? "font-medium text-red-600" : ""}`}>{money(l.remaining, cur)}</td>
                    <td className="p-2"><ProgressBar pct={l.burnPct} tone={l.burnPct > 100 ? "red" : l.burnPct > 85 ? "amber" : "green"} /></td>
                    <td className="p-2 text-right">
                      {can("budget:manage") && <button className="text-xs text-red-600" onClick={() => delLine.mutate({ lineId: l.id })}>Delete</button>}
                    </td>
                  </tr>
                ))}
                {s.unassignedSpent > 0 && (
                  <tr className="border-t border-slate-100 text-slate-500"><td className="p-2" colSpan={7}>Plus {money(s.unassignedSpent, cur)} approved spending not linked to a line</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {can("budget:manage") && (
          <form className="mt-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (cat.trim()) addLine.mutate({ projectId, category: cat.trim(), planned: Number(planned) || 0 }); }}>
            <Input className="max-w-xs" placeholder="Category (e.g. Staff, Travel)" value={cat} onChange={(e) => setCat(e.target.value)} />
            <Input className="w-36" type="number" min={0} placeholder={`Planned (${cur})`} value={planned} onChange={(e) => setPlanned(e.target.value)} />
            <Button type="submit" disabled={!cat.trim() || addLine.isPending}>Add line</Button>
          </form>
        )}
      </section>

      <section>
        <SectionTitle>Expenses</SectionTitle>
        {exps.data?.length === 0 ? <Empty>No expenses recorded.</Empty> : (
          <div className="overflow-x-auto rounded-xl border border-slate-200/70 bg-white shadow-soft">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr><th className="p-2">Date</th><th className="p-2">Description</th><th className="p-2">Line</th><th className="p-2">Amount</th><th className="p-2">Status</th><th /></tr>
              </thead>
              <tbody>
                {exps.data?.map((x) => (
                  <tr key={x.id} className="border-t border-slate-100">
                    <td className="p-2 text-slate-500">{fmtDate(x.date)}</td>
                    <td className="p-2">{x.description}</td>
                    <td className="p-2 text-slate-500">{x.budgetLine?.category ?? "—"}</td>
                    <td className="p-2 font-medium">{money(x.amount, cur)}</td>
                    <td className="p-2"><Badge value={x.status} /></td>
                    <td className="space-x-2 p-2 text-right">
                      {x.status === "PENDING" && can("expense:approve") && (
                        <>
                          <button className="text-xs text-green-700" onClick={() => decide.mutate({ expenseId: x.id, approve: true })}>Approve</button>
                          <button className="text-xs text-red-600" onClick={() => decide.mutate({ expenseId: x.id, approve: false })}>Reject</button>
                        </>
                      )}
                      {can("expense:create") && <button className="text-xs text-slate-500" onClick={() => delExp.mutate({ expenseId: x.id })}>Delete</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {can("expense:create") && (
          <form
            className="mt-3 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (desc.trim() && Number(amount) > 0)
                addExp.mutate({ projectId, budgetLineId: lineId || null, amount: Number(amount), date: fromInput(date) ?? new Date(), description: desc.trim() });
            }}
          >
            <Input className="min-w-[200px] flex-1" placeholder="What was it for?" value={desc} onChange={(e) => setDesc(e.target.value)} />
            <Select className="w-44" value={lineId} onChange={(e) => setLineId(e.target.value)}>
              <option value="">No budget line</option>
              {s.lines.map((l) => <option key={l.id} value={l.id}>{l.category}</option>)}
            </Select>
            <Input className="w-32" type="number" min={0} step="0.01" placeholder={`Amount (${cur})`} value={amount} onChange={(e) => setAmount(e.target.value)} />
            <DateInput className="w-40" value={date} onChange={(e) => setDate(e.target.value)} />
            <Button type="submit" disabled={!desc.trim() || !(Number(amount) > 0) || addExp.isPending}>Record expense</Button>
          </form>
        )}
        <p className="mt-2 text-xs text-slate-500">New expenses wait for an owner or admin to approve them. Only approved spending counts as spent.</p>
      </section>
    </div>
  );
}
