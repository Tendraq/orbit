"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useProject } from "@/lib/contexts";
import { Badge, Card, Empty, ErrorText, Loading, SectionTitle, Textarea } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtDate, money } from "@/lib/format";

export default function ChangesPage() {
  const { project, can } = useProject();
  const projectId = project.id;
  const cur = project.currency;
  const utils = trpc.useUtils();
  const q = trpc.change.list.useQuery({ projectId });
  const reload = () => { utils.change.list.invalidate({ projectId }); utils.report.projectDashboard.invalidate({ projectId }); };

  const create = trpc.change.create.useMutation({ onSuccess: () => { setTitle(""); setDesc(""); setReason(""); setCost(""); setDays(""); reload(); } });
  const submit = trpc.change.submit.useMutation({ onSuccess: reload });
  const decide = trpc.change.decide.useMutation({ onSuccess: reload });
  const done = trpc.change.markImplemented.useMutation({ onSuccess: reload });
  const del = trpc.change.delete.useMutation({ onSuccess: reload });

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [reason, setReason] = useState("");
  const [cost, setCost] = useState("");
  const [days, setDays] = useState("");
  const [note, setNote] = useState<Record<string, string>>({});

  if (q.isLoading) return <Loading />;

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Any change to scope, budget or schedule goes through a request: describe the impact, submit it, and an owner or admin decides.
      </p>
      <ErrorText error={create.error ?? submit.error ?? decide.error ?? done.error ?? del.error} />

      {q.data?.length === 0 && <Empty>No change requests yet.</Empty>}
      <ul className="space-y-3">
        {q.data?.map((c) => (
          <Card key={c.id}>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{c.title}</h3>
              <Badge value={c.status} />
              <span className="ml-auto text-xs text-slate-500">{fmtDate(c.createdAt)}</span>
            </div>
            {c.description && <p className="mt-1 text-sm text-slate-700">{c.description}</p>}
            {c.reason && <p className="mt-1 text-sm text-slate-500">Reason: {c.reason}</p>}
            <p className="mt-2 text-sm">
              Cost impact: <b>{money(c.costImpact, cur)}</b> · Schedule impact: <b>{c.scheduleImpactDays} days</b>
            </p>
            {c.decisionNote && <p className="mt-1 text-sm italic text-slate-600">Decision note: {c.decisionNote}</p>}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {c.status === "DRAFT" && can("change:create") && (
                <>
                  <Button onClick={() => submit.mutate({ changeId: c.id })}>Submit for decision</Button>
                  <Button variant="danger" onClick={() => del.mutate({ changeId: c.id })}>Delete</Button>
                </>
              )}
              {c.status === "SUBMITTED" && can("change:decide") && (
                <>
                  <Input className="max-w-xs" placeholder="Decision note (optional)" value={note[c.id] ?? ""} onChange={(e) => setNote((n) => ({ ...n, [c.id]: e.target.value }))} />
                  <Button onClick={() => decide.mutate({ changeId: c.id, approve: true, note: note[c.id] })}>Approve</Button>
                  <Button variant="danger" onClick={() => decide.mutate({ changeId: c.id, approve: false, note: note[c.id] })}>Reject</Button>
                </>
              )}
              {c.status === "SUBMITTED" && !can("change:decide") && <span className="text-sm text-indigo-700">Waiting for a decision.</span>}
              {c.status === "APPROVED" && can("change:decide") && (
                <Button variant="ghost" onClick={() => done.mutate({ changeId: c.id })}>Mark as implemented</Button>
              )}
            </div>
          </Card>
        ))}
      </ul>

      {can("change:create") && (
        <Card>
          <SectionTitle>New change request</SectionTitle>
          <form
            className="grid gap-2 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (title.trim().length >= 2)
                create.mutate({ projectId, title: title.trim(), description: desc || undefined, reason: reason || undefined, costImpact: Number(cost) || 0, scheduleImpactDays: Math.round(Number(days)) || 0 });
            }}
          >
            <Input className="md:col-span-2" placeholder="What needs to change?" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea placeholder="Describe the change" value={desc} onChange={(e) => setDesc(e.target.value)} />
            <Textarea placeholder="Why is it needed?" value={reason} onChange={(e) => setReason(e.target.value)} />
            <Input type="number" placeholder={`Cost impact (${cur}, can be negative)`} value={cost} onChange={(e) => setCost(e.target.value)} />
            <Input type="number" placeholder="Schedule impact (days)" value={days} onChange={(e) => setDays(e.target.value)} />
            <div className="md:col-span-2"><Button type="submit" disabled={title.trim().length < 2 || create.isPending}>Save as draft</Button></div>
          </form>
        </Card>
      )}
    </div>
  );
}
