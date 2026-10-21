"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useProject } from "@/lib/contexts";
import { Badge, Card, Empty, ErrorText, Field, Loading, SectionTitle, Select, Textarea } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { fmtDate, fromInput, toInput } from "@/lib/format";

// Donor reports: generate a first draft from real project data, edit it, submit it, print it.
export default function DonorReportsPage() {
  const { project, slug, can } = useProject();
  const projectId = project.id;
  const utils = trpc.useUtils();
  const list = trpc.donorReport.list.useQuery({ projectId });
  const grants = trpc.funding.grants.list.useQuery({ workspaceSlug: slug, projectId });

  const reload = () => utils.donorReport.list.invalidate({ projectId });
  const create = trpc.donorReport.create.useMutation({ onSuccess: () => { setTitle(""); setNarrative(""); reload(); } });
  const update = trpc.donorReport.update.useMutation({ onSuccess: () => { setEditing(null); reload(); } });
  const setStatus = trpc.donorReport.setStatus.useMutation({ onSuccess: reload });
  const del = trpc.donorReport.delete.useMutation({ onSuccess: reload });

  const [title, setTitle] = useState("");
  const [start, setStart] = useState(toInput(new Date(Date.now() - 90 * 86400000)));
  const [end, setEnd] = useState(toInput(new Date()));
  const [grantId, setGrantId] = useState("");
  const [narrative, setNarrative] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");

  async function generate() {
    const ps = fromInput(start); const pe = fromInput(end);
    if (!ps || !pe) return;
    setGenerating(true); setGenError(null);
    try {
      const r = await utils.donorReport.generate.fetch({ projectId, periodStart: ps, periodEnd: pe });
      setNarrative(r.narrative);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Could not generate");
    } finally { setGenerating(false); }
  }

  if (list.isLoading) return <Loading />;
  const canEdit = can("report:manage");

  return (
    <div className="space-y-8">
      <ErrorText error={create.error ?? update.error ?? setStatus.error ?? del.error} />

      <section>
        <SectionTitle>Reports</SectionTitle>
        {list.data?.length === 0 && <Empty>No reports yet. Create one below, starting from an auto-generated draft.</Empty>}
        <ul className="space-y-3">
          {list.data?.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{r.title}</h3>
                <Badge value={r.status} />
                <span className="text-xs text-slate-500">{fmtDate(r.periodStart)} to {fmtDate(r.periodEnd)}</span>
                <span className="ml-auto flex flex-wrap gap-3 text-xs">
                  <a className="text-brand-600 hover:underline" href={`/api/export/donor-report/${r.id}`} target="_blank" rel="noreferrer">Open / print</a>
                  {canEdit && r.status === "DRAFT" && (
                    <>
                      <button className="text-brand-600" onClick={() => { setEditing(editing === r.id ? null : r.id); setDraftText(r.narrative); }}>Edit</button>
                      <button className="text-indigo-700" onClick={() => setStatus.mutate({ reportId: r.id, status: "SUBMITTED" })}>Submit</button>
                      <button className="text-red-600" onClick={() => del.mutate({ reportId: r.id })}>Delete</button>
                    </>
                  )}
                  {canEdit && r.status === "SUBMITTED" && (
                    <>
                      <button className="text-green-700" onClick={() => setStatus.mutate({ reportId: r.id, status: "ACCEPTED" })}>Mark accepted</button>
                      <button className="text-slate-600" onClick={() => setStatus.mutate({ reportId: r.id, status: "DRAFT" })}>Back to draft</button>
                    </>
                  )}
                </span>
              </div>
              {editing === r.id ? (
                <div className="mt-3 space-y-2">
                  <Textarea rows={14} value={draftText} onChange={(e) => setDraftText(e.target.value)} className="font-mono" />
                  <div className="flex gap-2">
                    <Button onClick={() => update.mutate({ reportId: r.id, narrative: draftText })}>Save</Button>
                    <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <pre className="mt-2 max-h-40 overflow-hidden whitespace-pre-wrap text-sm text-slate-600">{r.narrative.slice(0, 400)}{r.narrative.length > 400 && "…"}</pre>
              )}
            </Card>
          ))}
        </ul>
      </section>

      {canEdit && (
        <Card>
          <SectionTitle>New report</SectionTitle>
          <div className="grid gap-2 md:grid-cols-4">
            <Field label="Title" className="md:col-span-2"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Q1 2026 progress report" /></Field>
            <Field label="Period start"><DateInput value={start} onChange={(e) => setStart(e.target.value)} /></Field>
            <Field label="Period end"><DateInput value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
            <Field label="Grant (optional)" className="md:col-span-2">
              <Select value={grantId} onChange={(e) => setGrantId(e.target.value)}>
                <option value="">No specific grant</option>
                {grants.data?.map((g) => <option key={g.id} value={g.id}>{g.donor.name} · {g.title}</option>)}
              </Select>
            </Field>
            <div className="flex items-end md:col-span-2">
              <Button variant="ghost" onClick={generate} disabled={generating}>{generating ? "Generating…" : "Generate draft from project data"}</Button>
            </div>
          </div>
          <ErrorText error={genError ? { message: genError } : null} />
          <Textarea rows={12} className="mt-3 font-mono" placeholder="Report text. Use “Generate draft” to start from your real numbers." value={narrative} onChange={(e) => setNarrative(e.target.value)} />
          <div className="mt-3">
            <Button
              disabled={title.trim().length < 2 || create.isPending}
              onClick={() => { const ps = fromInput(start); const pe = fromInput(end); if (ps && pe) create.mutate({ projectId, grantId: grantId || null, title: title.trim(), periodStart: ps, periodEnd: pe, narrative }); }}
            >
              Save report
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
