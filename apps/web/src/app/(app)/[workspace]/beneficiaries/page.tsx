"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useWorkspace } from "@/lib/contexts";
import { Card, Empty, ErrorText, Loading, SectionTitle, Select, Stat } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtDate } from "@/lib/format";

const GENDERS = ["Female", "Male", "Other", "Not stated"];
const AGES = ["0-4", "5-17", "18-34", "35-59", "60+"];

// Privacy by design: we store a CODE, never a name. Guests (donors, partners) cannot open this page.
export default function BeneficiariesPage() {
  const ws = useWorkspace();
  const utils = trpc.useUtils();
  const list = trpc.beneficiary.list.useQuery({ workspaceSlug: ws.slug });
  const sum = trpc.beneficiary.summary.useQuery({ workspaceSlug: ws.slug });
  const projects = trpc.project.list.useQuery({ workspaceSlug: ws.slug });

  const reload = () => { utils.beneficiary.list.invalidate(); utils.beneficiary.summary.invalidate(); };
  const create = trpc.beneficiary.create.useMutation({ onSuccess: () => { setCode(""); setLoc(""); reload(); } });
  const del = trpc.beneficiary.delete.useMutation({ onSuccess: reload });

  const [code, setCode] = useState("");
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [loc, setLoc] = useState("");
  const [projectId, setProjectId] = useState("");
  const [disability, setDisability] = useState(false);
  const [consent, setConsent] = useState(true);

  if (list.isLoading) return <Loading />;
  const label = ws.term("beneficiary");

  return (
    <div className="space-y-8">
      <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
        Do not enter names or contact details. Use an anonymous code (for example H-0042) that only your team can link back to a person.
      </p>
      <ErrorText error={list.error ?? create.error ?? del.error} />

      {sum.data && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label={`Total ${label.toLowerCase()}s`} value={sum.data.total} />
          <Stat label="With disability" value={sum.data.withDisability} />
          {sum.data.byGender.slice(0, 2).map((g) => <Stat key={g.label} label={g.label} value={g.count} />)}
        </div>
      )}

      <section>
        <SectionTitle>Register</SectionTitle>
        {list.data?.length === 0 ? <Empty>No records yet.</Empty> : (
          <div className="overflow-x-auto rounded-xl border border-slate-200/70 bg-white shadow-soft">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-2">Code</th><th className="p-2">Gender</th><th className="p-2">Age</th><th className="p-2">Location</th><th className="p-2">Project</th><th className="p-2">Consent</th><th className="p-2">Added</th><th /></tr></thead>
              <tbody>
                {list.data?.map((b) => (
                  <tr key={b.id} className="border-t border-slate-100">
                    <td className="p-2 font-medium">{b.code}</td><td className="p-2">{b.gender ?? "—"}</td><td className="p-2">{b.ageGroup ?? "—"}</td>
                    <td className="p-2">{b.location ?? "—"}</td><td className="p-2">{b.project?.name ?? "—"}</td>
                    <td className="p-2">{b.consentGiven ? "Yes" : <span className="text-red-600">No</span>}</td>
                    <td className="p-2 text-xs text-slate-500">{fmtDate(b.createdAt)}</td>
                    <td className="p-2 text-right">{ws.can("ngo:manage") && <button className="text-xs text-red-600" onClick={() => window.confirm("Delete this record?") && del.mutate({ workspaceSlug: ws.slug, beneficiaryId: b.id })}>Delete</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {ws.can("ngo:data") && (
        <Card>
          <SectionTitle>Add a record</SectionTitle>
          <form className="grid gap-2 md:grid-cols-4"
            onSubmit={(e) => { e.preventDefault(); if (code.trim()) create.mutate({ workspaceSlug: ws.slug, projectId: projectId || null, code: code.trim(), gender: gender || undefined, ageGroup: age || undefined, location: loc || undefined, disability, consentGiven: consent }); }}>
            <Input placeholder="Anonymous code" value={code} onChange={(e) => setCode(e.target.value)} />
            <Select value={gender} onChange={(e) => setGender(e.target.value)}><option value="">Gender…</option>{GENDERS.map((g) => <option key={g}>{g}</option>)}</Select>
            <Select value={age} onChange={(e) => setAge(e.target.value)}><option value="">Age group…</option>{AGES.map((g) => <option key={g}>{g}</option>)}</Select>
            <Input placeholder="Location (village, district)" value={loc} onChange={(e) => setLoc(e.target.value)} />
            <Select className="md:col-span-2" value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">Not linked to a project</option>{projects.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={disability} onChange={(e) => setDisability(e.target.checked)} /> Person with disability</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> Consent given</label>
            <div className="md:col-span-4"><Button type="submit" disabled={!code.trim() || create.isPending}>Add record</Button></div>
          </form>
        </Card>
      )}
    </div>
  );
}
