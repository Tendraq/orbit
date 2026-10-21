"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useWorkspace } from "@/lib/contexts";
import { Badge, Empty, ErrorText, Loading, ProgressBar, Stat } from "@/components/ui/kit";
import { PHASE_LABELS, type Phase } from "@/config";
import { fmtDate, money } from "@/lib/format";

// All projects of the organization on one screen.
export default function PortfolioPage() {
  const ws = useWorkspace();
  const q = trpc.report.portfolio.useQuery({ workspaceSlug: ws.slug });

  if (q.isLoading) return <Loading />;
  const rows = q.data ?? [];
  const count = (h: string) => rows.filter((r) => r.health === h && r.status === "ACTIVE").length;

  return (
    <div className="space-y-6">
      <ErrorText error={q.error} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Projects" value={rows.length} />
        <Stat label="On track" value={count("GREEN")} />
        <Stat label="At risk" value={count("AMBER")} tone={count("AMBER") ? "amber" : undefined} />
        <Stat label="Off track" value={count("RED")} tone={count("RED") ? "red" : undefined} />
      </div>

      {rows.length === 0 ? <Empty>No projects yet.</Empty> : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/70 bg-white shadow-soft">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr><th className="p-2">Project</th><th className="p-2">Phase</th><th className="p-2">Health</th><th className="w-40 p-2">Progress</th><th className="p-2">Overdue</th><th className="w-44 p-2">Budget used</th><th className="p-2">Ends</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="p-2">
                    <Link href={`/${ws.slug}/projects/${r.id}/overview`} className="font-medium hover:text-brand-600">{r.name}</Link>
                    {r.status !== "ACTIVE" && <span className="ml-2"><Badge value={r.status} /></span>}
                  </td>
                  <td className="p-2"><Badge tone="indigo">{PHASE_LABELS[r.phase as Phase]}</Badge></td>
                  <td className="p-2"><Badge value={r.health} /></td>
                  <td className="p-2"><ProgressBar pct={r.progressPct} tone="green" /><span className="text-xs text-slate-500">{r.progressPct}% ({r.taskDone}/{r.taskTotal})</span></td>
                  <td className={`p-2 ${r.overdue ? "font-medium text-red-600" : "text-slate-500"}`}>{r.overdue}</td>
                  <td className="p-2">
                    {r.burnPct === null ? <span className="text-slate-400">no budget</span> : (
                      <>
                        <ProgressBar pct={r.burnPct} tone={r.burnPct > 100 ? "red" : r.burnPct > 85 ? "amber" : "green"} />
                        <span className="text-xs text-slate-500">{money(r.spent, r.currency)} ({r.burnPct}%)</span>
                      </>
                    )}
                  </td>
                  <td className="p-2 text-slate-500">{fmtDate(r.endDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
