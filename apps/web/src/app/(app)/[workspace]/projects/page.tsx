"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useWorkspace } from "@/lib/contexts";
import { Badge, Card, Empty, ErrorText, Loading, ProgressBar } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { PHASE_LABELS, type Phase } from "@/config";
import { fromInput } from "@/lib/format";

export default function ProjectsPage() {
  const ws = useWorkspace();
  const utils = trpc.useUtils();
  const projects = trpc.project.list.useQuery({ workspaceSlug: ws.slug });
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const create = trpc.project.create.useMutation({
    onSuccess: () => { setName(""); setCode(""); setStart(""); setEnd(""); utils.project.list.invalidate({ workspaceSlug: ws.slug }); },
  });

  if (projects.isLoading) return <Loading />;

  return (
    <div className="space-y-8">
      <ErrorText error={projects.error} />
      {projects.data?.length === 0 && <Empty>No {ws.term("project").toLowerCase()}s yet. Create the first one below.</Empty>}

      <ul className="grid gap-3 md:grid-cols-2">
        {projects.data?.map((p) => {
          const pct = p.taskTotal ? Math.round((p.taskDone / p.taskTotal) * 100) : 0;
          return (
            <li key={p.id}>
              <Link href={`/${ws.slug}/projects/${p.id}/overview`} className="block">
                <Card className="hover:border-brand-500">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{p.name}</p>
                      {p.code && <p className="text-xs text-slate-500">{p.code}</p>}
                    </div>
                    <div className="flex flex-wrap justify-end gap-1">
                      <Badge tone="indigo">{PHASE_LABELS[p.phase as Phase]}</Badge>
                      <Badge value={p.health} />
                      {p.status !== "ACTIVE" && <Badge value={p.status} />}
                    </div>
                  </div>
                  <div className="mt-3"><ProgressBar pct={pct} tone="green" /></div>
                  <p className="mt-1 text-xs text-slate-500">{p.taskDone} of {p.taskTotal} tasks done ({pct}%)</p>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>

      {ws.can("project:create") && (
        <Card id="new">
          <h2 className="mb-3 font-semibold">New {ws.term("project").toLowerCase()}</h2>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate({ workspaceSlug: ws.slug, name: name.trim(), code: code || undefined, currency: currency.toUpperCase(), startDate: fromInput(start), endDate: fromInput(end) });
            }}
          >
            <Input className="min-w-[220px] flex-1" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input className="w-28" placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} />
            <Input className="w-20" maxLength={3} placeholder="USD" value={currency} onChange={(e) => setCurrency(e.target.value)} />
            <DateInput className="w-40" value={start} onChange={(e) => setStart(e.target.value)} title="Start date" />
            <DateInput className="w-40" value={end} onChange={(e) => setEnd(e.target.value)} title="End date" />
            <Button type="submit" disabled={name.trim().length < 2 || currency.length !== 3 || create.isPending}>Create</Button>
          </form>
          <ErrorText error={create.error} />
        </Card>
      )}
    </div>
  );
}
