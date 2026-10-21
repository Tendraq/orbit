"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useWorkspace } from "@/lib/contexts";
import { Card, Empty, ErrorText, Loading, SectionTitle, Select, Textarea } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { fmtDate, fromInput, money } from "@/lib/format";

export default function GrantsPage() {
  const ws = useWorkspace();
  const utils = trpc.useUtils();
  const donors = trpc.funding.donors.list.useQuery({ workspaceSlug: ws.slug });
  const grants = trpc.funding.grants.list.useQuery({ workspaceSlug: ws.slug });
  const projects = trpc.project.list.useQuery({ workspaceSlug: ws.slug });
  const manage = ws.can("ngo:manage");

  const reload = () => { utils.funding.donors.list.invalidate(); utils.funding.grants.list.invalidate(); };
  const addDonor = trpc.funding.donors.create.useMutation({ onSuccess: () => { setDName(""); setDEmail(""); reload(); } });
  const delDonor = trpc.funding.donors.delete.useMutation({ onSuccess: reload });
  const addGrant = trpc.funding.grants.create.useMutation({ onSuccess: () => { setGTitle(""); setGAmount(""); setGCond(""); reload(); } });
  const delGrant = trpc.funding.grants.delete.useMutation({ onSuccess: reload });

  const [dName, setDName] = useState("");
  const [dEmail, setDEmail] = useState("");
  const [donorId, setDonorId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [gTitle, setGTitle] = useState("");
  const [gAmount, setGAmount] = useState("");
  const [gCur, setGCur] = useState("USD");
  const [gStart, setGStart] = useState("");
  const [gEnd, setGEnd] = useState("");
  const [gCond, setGCond] = useState("");

  if (donors.isLoading) return <Loading />;

  return (
    <div className="space-y-10">
      <ErrorText error={addDonor.error ?? delDonor.error ?? addGrant.error ?? delGrant.error} />

      <section>
        <SectionTitle>{ws.term("donor")}s</SectionTitle>
        {donors.data?.length === 0 && <Empty>No {ws.term("donor").toLowerCase()}s yet.</Empty>}
        <ul className="grid gap-2 md:grid-cols-3">
          {donors.data?.map((d) => (
            <Card key={d.id}>
              <div className="flex justify-between"><span className="font-semibold">{d.name}</span>
                {manage && <button className="text-xs text-red-600" onClick={() => window.confirm("Delete this donor and its grants?") && delDonor.mutate({ workspaceSlug: ws.slug, donorId: d.id })}>✕</button>}
              </div>
              <p className="text-xs text-slate-500">{d.contactEmail ?? "no contact"} · {d._count.grants} grant(s)</p>
            </Card>
          ))}
        </ul>
        {manage && (
          <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (dName.trim().length >= 2) addDonor.mutate({ workspaceSlug: ws.slug, name: dName.trim(), contactEmail: dEmail }); }}>
            <Input className="max-w-xs" placeholder={`${ws.term("donor")} name`} value={dName} onChange={(e) => setDName(e.target.value)} />
            <Input className="max-w-xs" type="email" placeholder="Contact email (optional)" value={dEmail} onChange={(e) => setDEmail(e.target.value)} />
            <Button type="submit" disabled={dName.trim().length < 2}>Add</Button>
          </form>
        )}
      </section>

      <section>
        <SectionTitle>Grants</SectionTitle>
        {grants.data?.length === 0 ? <Empty>No grants recorded.</Empty> : (
          <div className="overflow-x-auto rounded-xl border border-slate-200/70 bg-white shadow-soft">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-2">Grant</th><th className="p-2">{ws.term("donor")}</th><th className="p-2">Amount</th><th className="p-2">Period</th><th className="p-2">Project</th><th /></tr></thead>
              <tbody>
                {grants.data?.map((g) => (
                  <tr key={g.id} className="border-t border-slate-100 align-top">
                    <td className="p-2"><span className="font-medium">{g.title}</span>{g.conditions && <p className="max-w-xs text-xs text-slate-500">{g.conditions}</p>}</td>
                    <td className="p-2">{g.donor.name}</td>
                    <td className="p-2">{money(g.amount, g.currency)}</td>
                    <td className="p-2 text-xs text-slate-500">{fmtDate(g.startDate)} → {fmtDate(g.endDate)}</td>
                    <td className="p-2">{g.project ? <Link className="hover:text-brand-600" href={`/${ws.slug}/projects/${g.project.id}/overview`}>{g.project.name}</Link> : "—"}</td>
                    <td className="p-2 text-right">{manage && <button className="text-xs text-red-600" onClick={() => delGrant.mutate({ workspaceSlug: ws.slug, grantId: g.id })}>Delete</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {manage && (
          <Card className="mt-3">
            <h3 className="mb-2 font-semibold">New grant</h3>
            <form className="grid gap-2 md:grid-cols-4"
              onSubmit={(e) => { e.preventDefault(); if (donorId && gTitle.trim().length >= 2 && Number(gAmount) > 0) addGrant.mutate({ workspaceSlug: ws.slug, donorId, projectId: projectId || null, title: gTitle.trim(), amount: Number(gAmount), currency: gCur.toUpperCase(), startDate: fromInput(gStart), endDate: fromInput(gEnd), conditions: gCond || undefined }); }}>
              <Select value={donorId} onChange={(e) => setDonorId(e.target.value)}><option value="">Choose {ws.term("donor").toLowerCase()}…</option>{donors.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
              <Input className="md:col-span-2" placeholder="Grant title" value={gTitle} onChange={(e) => setGTitle(e.target.value)} />
              <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">Not linked to a project</option>{projects.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
              <Input type="number" min={0} placeholder="Amount" value={gAmount} onChange={(e) => setGAmount(e.target.value)} />
              <Input maxLength={3} placeholder="USD" value={gCur} onChange={(e) => setGCur(e.target.value)} />
              <DateInput value={gStart} onChange={(e) => setGStart(e.target.value)} title="Start" />
              <DateInput value={gEnd} onChange={(e) => setGEnd(e.target.value)} title="End" />
              <Textarea className="md:col-span-3" placeholder="Conditions and reporting requirements" value={gCond} onChange={(e) => setGCond(e.target.value)} />
              <div className="flex items-end"><Button type="submit" disabled={!donorId || gTitle.trim().length < 2 || !(Number(gAmount) > 0) || gCur.length !== 3 || addGrant.isPending}>Add grant</Button></div>
            </form>
          </Card>
        )}
      </section>
    </div>
  );
}
