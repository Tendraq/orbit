"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useProject } from "@/lib/contexts";
import { Badge, Card, ErrorText, Loading } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PROJECT_PHASES, PHASE_LABELS, type Phase } from "@/config";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

// The lifecycle: 5 phases, each closed by a stage gate (checklist + approval).
export function GatePanel({ projectId }: { projectId: string }) {
  const { can } = useProject();
  const utils = trpc.useUtils();
  const q = trpc.workflow.gates.useQuery({ projectId });
  const [newItem, setNewItem] = useState("");
  const [note, setNote] = useState("");

  const refresh = () => {
    utils.workflow.gates.invalidate({ projectId });
    utils.project.get.invalidate({ projectId });
    utils.report.projectDashboard.invalidate({ projectId });
  };
  const toggle = trpc.workflow.toggleRequirement.useMutation({ onSuccess: refresh });
  const addReq = trpc.workflow.addRequirement.useMutation({ onSuccess: () => { setNewItem(""); refresh(); } });
  const submit = trpc.workflow.submit.useMutation({ onSuccess: refresh });
  const decide = trpc.workflow.decide.useMutation({ onSuccess: () => { setNote(""); refresh(); } });

  if (q.isLoading) return <Loading />;
  if (!q.data) return <ErrorText error={q.error} />;

  const { gates, currentPhase, status } = q.data;
  const current = gates.find((g) => g.phase === currentPhase)!;
  const completed = status === "COMPLETED";
  const doneCount = current.requirements.filter((r) => r.done).length;
  const allDone = doneCount === current.requirements.length;

  return (
    <Card>
      {/* phase stepper */}
      <ol className="mb-5 flex flex-wrap gap-2">
        {PROJECT_PHASES.map((ph, i) => {
          const gate = gates.find((g) => g.phase === ph)!;
          const isCurrent = ph === currentPhase && !completed;
          const done = gate.status === "APPROVED";
          return (
            <li
              key={ph}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1 text-xs",
                done && "border-green-300 bg-green-50 text-green-700",
                isCurrent && "border-brand-500 bg-brand-50 font-semibold text-brand-700",
                !done && !isCurrent && "border-slate-200 text-slate-500"
              )}
            >
              <span>{done ? "✓" : i + 1}</span>
              {PHASE_LABELS[ph as Phase]}
            </li>
          );
        })}
      </ol>

      {completed ? (
        <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
          This project is completed. All five stage gates were approved.
        </p>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">
              Gate to leave: {PHASE_LABELS[currentPhase as Phase]}{" "}
              <span className="text-sm font-normal text-slate-500">({doneCount}/{current.requirements.length})</span>
            </h3>
            <Badge value={current.status} />
          </div>

          <ul className="space-y-1.5">
            {current.requirements.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={r.done}
                  disabled={!can("gate:edit") || current.status === "SUBMITTED"}
                  onChange={(e) =>
                    toggle.mutate({ projectId, phase: current.phase, itemId: r.id, done: e.target.checked })
                  }
                />
                <span className={r.done ? "text-slate-500 line-through" : ""}>{r.label}</span>
              </li>
            ))}
          </ul>

          {can("gate:edit") && current.status !== "SUBMITTED" && (
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (newItem.trim().length >= 2) addReq.mutate({ projectId, phase: current.phase, label: newItem.trim() });
              }}
            >
              <Input placeholder="Add your own checklist item" value={newItem} onChange={(e) => setNewItem(e.target.value)} />
              <Button type="submit" variant="ghost">Add</Button>
            </form>
          )}

          {current.status === "REJECTED" && current.decisionNote && (
            <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              Sent back ({fmtDate(current.decidedAt)}): {current.decisionNote}
            </p>
          )}

          <div className="mt-4 space-y-3">
            {current.status !== "SUBMITTED" && can("gate:edit") && (
              <Button disabled={!allDone || submit.isPending} onClick={() => submit.mutate({ projectId })}>
                Submit for approval
              </Button>
            )}
            {current.status === "SUBMITTED" && (
              <p className="text-sm text-indigo-700">Waiting for an owner or admin to approve.</p>
            )}
            {current.status === "SUBMITTED" && can("gate:approve") && (
              <div className="space-y-2 rounded-lg bg-slate-50 p-3">
                <Input placeholder="Decision note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
                <div className="flex gap-2">
                  <Button disabled={decide.isPending} onClick={() => decide.mutate({ projectId, approve: true, note })}>
                    Approve and move on
                  </Button>
                  <Button variant="danger" disabled={decide.isPending} onClick={() => decide.mutate({ projectId, approve: false, note })}>
                    Send back
                  </Button>
                </div>
              </div>
            )}
            <ErrorText error={toggle.error ?? addReq.error ?? submit.error ?? decide.error} />
          </div>
        </>
      )}
    </Card>
  );
}
