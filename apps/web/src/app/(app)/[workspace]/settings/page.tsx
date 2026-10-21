"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useWorkspace } from "@/lib/contexts";
import { Card, ErrorText, Field, Loading, SectionTitle, Select } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_TERMINOLOGY, MODULES, SECTORS } from "@/config";

export default function WorkspaceSettingsPage() {
  const ws = useWorkspace();
  const utils = trpc.useUtils();
  const q = trpc.workspace.get.useQuery({ slug: ws.slug });
  const labels = trpc.label.list.useQuery({ workspaceSlug: ws.slug });
  const fields = trpc.customField.list.useQuery({ workspaceSlug: ws.slug });

  const [name, setName] = useState<string | null>(null);
  const [sector, setSector] = useState<string | null>(null);
  const [mods, setMods] = useState<string[] | null>(null);
  const [terms, setTerms] = useState<Record<string, string> | null>(null);
  const [saved, setSaved] = useState(false);

  const [lName, setLName] = useState("");
  const [lColor, setLColor] = useState("#6366f1");
  const [fLabel, setFLabel] = useState("");
  const [fEntity, setFEntity] = useState<"TASK" | "PROJECT">("TASK");
  const [fType, setFType] = useState<"TEXT" | "NUMBER" | "DATE" | "SELECT">("TEXT");
  const [fOptions, setFOptions] = useState("");

  const save = trpc.workspace.updateSettings.useMutation({
    onSuccess: () => { utils.workspace.get.invalidate({ slug: ws.slug }); setSaved(true); },
  });
  const addLabel = trpc.label.create.useMutation({ onSuccess: () => { setLName(""); utils.label.list.invalidate(); } });
  const delLabel = trpc.label.delete.useMutation({ onSuccess: () => utils.label.list.invalidate() });
  const addField = trpc.customField.create.useMutation({ onSuccess: () => { setFLabel(""); setFOptions(""); utils.customField.list.invalidate(); } });
  const delField = trpc.customField.delete.useMutation({ onSuccess: () => utils.customField.list.invalidate() });

  if (q.isLoading || !q.data) return <Loading />;
  const cur = {
    name: name ?? q.data.name,
    sector: sector ?? q.data.sector,
    mods: mods ?? q.data.enabledModules,
    terms: terms ?? ((q.data.terminology ?? {}) as Record<string, string>),
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <SectionTitle>Organization</SectionTitle>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Name"><Input value={cur.name} onChange={(e) => { setName(e.target.value); setSaved(false); }} /></Field>
          <Field label="Sector"><Select value={cur.sector} onChange={(e) => { setSector(e.target.value); setSaved(false); }}>{SECTORS.map((s) => <option key={s} value={s}>{s.replace("_", " ").toLowerCase()}</option>)}</Select></Field>
        </div>

        <h3 className="mb-2 mt-5 text-sm font-semibold">Modules</h3>
        <p className="mb-2 text-xs text-slate-500">Switch features on or off for the whole organization. Data is kept when a module is off.</p>
        <ul className="grid gap-2 md:grid-cols-2">
          {Object.entries(MODULES).map(([key, m]) => (
            <li key={key}>
              <label className="flex gap-2 rounded-lg border border-slate-200 p-2 text-sm">
                <input type="checkbox" checked={cur.mods.includes(key)} disabled={m.alwaysOn}
                  onChange={(e) => { setMods(e.target.checked ? [...cur.mods, key] : cur.mods.filter((x) => x !== key)); setSaved(false); }} />
                <span><span className="font-medium">{m.label}</span><span className="block text-xs text-slate-500">{m.description}</span></span>
              </label>
            </li>
          ))}
        </ul>

        <h3 className="mb-2 mt-5 text-sm font-semibold">Your words</h3>
        <p className="mb-2 text-xs text-slate-500">Rename things to match how your organization talks. Leave blank to keep the default.</p>
        <div className="grid gap-3 md:grid-cols-3">
          {Object.entries(DEFAULT_TERMINOLOGY).map(([key, def]) => (
            <Field key={key} label={def}>
              <Input placeholder={def} value={cur.terms[key] ?? ""} onChange={(e) => { setTerms({ ...cur.terms, [key]: e.target.value }); setSaved(false); }} />
            </Field>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <Button disabled={save.isPending} onClick={() => save.mutate({
            slug: ws.slug, name: cur.name, sector: cur.sector as (typeof SECTORS)[number], enabledModules: cur.mods,
            terminology: Object.fromEntries(Object.entries(cur.terms).filter(([, v]) => v.trim())),
          })}>Save settings</Button>
          {saved && <span className="text-sm text-green-700">Saved.</span>}
        </div>
        <ErrorText error={save.error} />
      </Card>

      <Card>
        <SectionTitle>Labels</SectionTitle>
        <ul className="mb-3 flex flex-wrap gap-2">
          {labels.data?.map((l) => (
            <li key={l.id} className="flex items-center gap-1 rounded-full px-3 py-1 text-xs text-white" style={{ background: l.color }}>
              {l.name}
              {ws.can("label:manage") && <button onClick={() => delLabel.mutate({ workspaceSlug: ws.slug, labelId: l.id })}>✕</button>}
            </li>
          ))}
          {labels.data?.length === 0 && <li className="text-sm text-slate-500">No labels yet.</li>}
        </ul>
        {ws.can("label:manage") && (
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (lName.trim()) addLabel.mutate({ workspaceSlug: ws.slug, name: lName.trim(), color: lColor }); }}>
            <Input className="max-w-xs" placeholder="New label" value={lName} onChange={(e) => setLName(e.target.value)} />
            <input type="color" value={lColor} onChange={(e) => setLColor(e.target.value)} className="h-10 w-12 rounded border border-slate-300" />
            <Button type="submit" disabled={!lName.trim()}>Add</Button>
          </form>
        )}
        <ErrorText error={addLabel.error ?? delLabel.error} />
      </Card>

      <Card>
        <SectionTitle>Custom fields</SectionTitle>
        <p className="mb-3 text-xs text-slate-500">Extra columns for tasks (shown in the Table view and on each task) or for projects (shown in project settings).</p>
        <ul className="mb-3 space-y-1 text-sm">
          {fields.data?.map((f) => (
            <li key={f.id} className="flex items-center gap-2">
              <span className="font-medium">{f.label}</span>
              <span className="text-xs text-slate-500">{f.entity.toLowerCase()} · {f.type.toLowerCase()}{f.options.length ? ` · ${f.options.join(", ")}` : ""}</span>
              {ws.can("customfield:manage") && <button className="ml-auto text-xs text-red-600" onClick={() => delField.mutate({ workspaceSlug: ws.slug, fieldId: f.id })}>Delete</button>}
            </li>
          ))}
          {fields.data?.length === 0 && <li className="text-slate-500">No custom fields yet.</li>}
        </ul>
        {ws.can("customfield:manage") && (
          <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (fLabel.trim()) addField.mutate({ workspaceSlug: ws.slug, entity: fEntity, label: fLabel.trim(), type: fType, options: fType === "SELECT" ? fOptions.split(",").map((s) => s.trim()).filter(Boolean) : [] }); }}>
            <Input className="w-48" placeholder="Field name (e.g. District)" value={fLabel} onChange={(e) => setFLabel(e.target.value)} />
            <Select className="w-32" value={fEntity} onChange={(e) => setFEntity(e.target.value as typeof fEntity)}><option value="TASK">Tasks</option><option value="PROJECT">Projects</option></Select>
            <Select className="w-32" value={fType} onChange={(e) => setFType(e.target.value as typeof fType)}><option value="TEXT">Text</option><option value="NUMBER">Number</option><option value="DATE">Date</option><option value="SELECT">Choice</option></Select>
            {fType === "SELECT" && <Input className="w-56" placeholder="Choices, comma separated" value={fOptions} onChange={(e) => setFOptions(e.target.value)} />}
            <Button type="submit" disabled={!fLabel.trim()}>Add field</Button>
          </form>
        )}
        <ErrorText error={addField.error ?? delField.error} />
      </Card>
    </div>
  );
}
