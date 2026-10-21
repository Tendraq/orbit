"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useProject } from "@/lib/contexts";
import { Card, ErrorText, Field, SectionTitle, Select, Textarea } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { fromInput, toInput } from "@/lib/format";

export default function ProjectSettingsPage() {
  const { project, slug, can } = useProject();
  const router = useRouter();
  const utils = trpc.useUtils();
  const fields = trpc.customField.list.useQuery({ workspaceSlug: slug, entity: "PROJECT" });

  const [name, setName] = useState(project.name);
  const [code, setCode] = useState(project.code ?? "");
  const [desc, setDesc] = useState(project.description ?? "");
  const [currency, setCurrency] = useState(project.currency);
  const [start, setStart] = useState(toInput(project.startDate));
  const [end, setEnd] = useState(toInput(project.endDate));
  const [status, setStatus] = useState(project.status);
  const [cf, setCf] = useState<Record<string, string>>((project.customFields ?? {}) as Record<string, string>);
  const [saved, setSaved] = useState(false);
  useEffect(() => setSaved(false), [name, code, desc, currency, start, end, status, cf]);

  const update = trpc.project.update.useMutation({
    onSuccess: () => { utils.project.get.invalidate({ projectId: project.id }); setSaved(true); },
  });
  const archive = trpc.project.archive.useMutation({ onSuccess: () => router.push(`/${slug}/projects`) });

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <SectionTitle>Project details</SectionTitle>
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate({
              projectId: project.id, name, code: code || null, description: desc || null,
              currency: currency.toUpperCase(), startDate: fromInput(start), endDate: fromInput(end),
              status, customFields: cf,
            });
          }}
        >
          <Field label="Name" className="md:col-span-2"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Code"><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. WASH-01" /></Field>
          <Field label="Currency"><Input value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value)} /></Field>
          <Field label="Start date"><DateInput value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="End date"><DateInput value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              {["ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"].map((s) => <option key={s} value={s}>{s.replace("_", " ").toLowerCase()}</option>)}
            </Select>
          </Field>
          <Field label="Description" className="md:col-span-2"><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>

          {fields.data?.map((f) => (
            <Field key={f.id} label={f.label}>
              {f.type === "SELECT" ? (
                <Select value={cf[f.key] ?? ""} onChange={(e) => setCf((c) => ({ ...c, [f.key]: e.target.value }))}>
                  <option value="">—</option>{f.options.map((o) => <option key={o}>{o}</option>)}
                </Select>
              ) : (
                <Input type={f.type === "NUMBER" ? "number" : f.type === "DATE" ? "date" : "text"} value={cf[f.key] ?? ""} onChange={(e) => setCf((c) => ({ ...c, [f.key]: e.target.value }))} />
              )}
            </Field>
          ))}

          <div className="flex items-center gap-3 md:col-span-2">
            <Button type="submit" disabled={update.isPending || name.trim().length < 2}>Save changes</Button>
            {saved && <span className="text-sm text-green-700">Saved</span>}
          </div>
        </form>
        <ErrorText error={update.error} />
      </Card>

      {can("project:update") && (
        <Card>
          <SectionTitle>Archive</SectionTitle>
          <p className="mb-3 text-sm text-slate-600">Archiving hides the project from the list. Its data is kept.</p>
          <Button variant="danger" onClick={() => window.confirm("Archive this project?") && archive.mutate({ projectId: project.id })}>Archive project</Button>
          <ErrorText error={archive.error} />
        </Card>
      )}
    </div>
  );
}
