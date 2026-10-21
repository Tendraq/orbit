"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useProject } from "@/lib/contexts";
import { Card, Empty, ErrorText, Loading, SectionTitle, Select } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const levels = [1, 2, 3, 4, 5];

export default function StakeholdersPage() {
  const { project, can } = useProject();
  const projectId = project.id;
  const utils = trpc.useUtils();
  const q = trpc.stakeholder.list.useQuery({ projectId });
  const reload = () => utils.stakeholder.list.invalidate({ projectId });
  const create = trpc.stakeholder.create.useMutation({ onSuccess: () => { setName(""); setOrg(""); setRole(""); reload(); } });
  const update = trpc.stakeholder.update.useMutation({ onSuccess: reload });
  const del = trpc.stakeholder.delete.useMutation({ onSuccess: reload });

  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [role, setRole] = useState("");
  const [influence, setInfluence] = useState(3);
  const [interest, setInterest] = useState(3);

  if (q.isLoading) return <Loading />;
  const list = q.data ?? [];

  // Influence / interest grid: who to manage closely, keep satisfied, keep informed, or monitor
  const quadrants = [
    { title: "Keep satisfied", hint: "high influence, lower interest", pick: (s: (typeof list)[number]) => s.influence >= 3 && s.interest < 3 },
    { title: "Manage closely", hint: "high influence, high interest", pick: (s: (typeof list)[number]) => s.influence >= 3 && s.interest >= 3 },
    { title: "Monitor", hint: "lower influence, lower interest", pick: (s: (typeof list)[number]) => s.influence < 3 && s.interest < 3 },
    { title: "Keep informed", hint: "lower influence, high interest", pick: (s: (typeof list)[number]) => s.influence < 3 && s.interest >= 3 },
  ];

  return (
    <div className="space-y-6">
      <ErrorText error={create.error ?? update.error ?? del.error} />
      {list.length === 0 ? <Empty>No stakeholders yet. Add the people and groups affected by this project.</Empty> : (
        <div className="grid gap-3 md:grid-cols-2">
          {quadrants.map((qd) => (
            <Card key={qd.title}>
              <h3 className="font-semibold">{qd.title}</h3>
              <p className="mb-2 text-xs text-slate-500">{qd.hint}</p>
              <ul className="space-y-2 text-sm">
                {list.filter(qd.pick).map((s) => (
                  <li key={s.id} className="rounded border border-slate-100 p-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{s.name}</span>
                      {can("stakeholder:manage") && <button className="text-xs text-red-600" onClick={() => del.mutate({ stakeholderId: s.id })}>Remove</button>}
                    </div>
                    <p className="text-xs text-slate-500">{[s.role, s.organization].filter(Boolean).join(" · ")}</p>
                    <div className="mt-1 flex gap-2 text-xs">
                      <label>Influence <select disabled={!can("stakeholder:manage")} value={s.influence} onChange={(e) => update.mutate({ stakeholderId: s.id, influence: Number(e.target.value) })}>{levels.map((n) => <option key={n}>{n}</option>)}</select></label>
                      <label>Interest <select disabled={!can("stakeholder:manage")} value={s.interest} onChange={(e) => update.mutate({ stakeholderId: s.id, interest: Number(e.target.value) })}>{levels.map((n) => <option key={n}>{n}</option>)}</select></label>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      {can("stakeholder:manage") && (
        <Card>
          <SectionTitle>Add stakeholder</SectionTitle>
          <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate({ projectId, name: name.trim(), organization: org || undefined, role: role || undefined, influence, interest }); }}>
            <Input className="w-48" placeholder="Name or group" value={name} onChange={(e) => setName(e.target.value)} />
            <Input className="w-44" placeholder="Organization" value={org} onChange={(e) => setOrg(e.target.value)} />
            <Input className="w-40" placeholder="Role" value={role} onChange={(e) => setRole(e.target.value)} />
            <Select className="w-36" value={influence} onChange={(e) => setInfluence(Number(e.target.value))}>{levels.map((n) => <option key={n} value={n}>Influence {n}</option>)}</Select>
            <Select className="w-36" value={interest} onChange={(e) => setInterest(Number(e.target.value))}>{levels.map((n) => <option key={n} value={n}>Interest {n}</option>)}</Select>
            <Button type="submit" disabled={!name.trim() || create.isPending}>Add</Button>
          </form>
        </Card>
      )}
    </div>
  );
}
