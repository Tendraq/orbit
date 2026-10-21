"use client";

import { useState } from "react";
import { trpc, type Out } from "@/lib/trpc";
import { useProject } from "@/lib/contexts";
import { Badge, Empty, ErrorText, Loading } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Item = Out["logframe"]["list"][number];
type Level = Item["level"];
const NEXT: Record<Level, Level | null> = { GOAL: "OUTCOME", OUTCOME: "OUTPUT", OUTPUT: "ACTIVITY", ACTIVITY: null };
const TONE = { GOAL: "indigo", OUTCOME: "blue", OUTPUT: "green", ACTIVITY: "slate" } as const;

// Logframe: Goal > Outcomes > Outputs > Activities, each with assumptions and how it is verified.
export default function LogframePage() {
  const { project, can } = useProject();
  const projectId = project.id;
  const utils = trpc.useUtils();
  const q = trpc.logframe.list.useQuery({ projectId });
  const reload = () => { utils.logframe.list.invalidate({ projectId }); utils.indicator.list.invalidate({ projectId }); };
  const create = trpc.logframe.create.useMutation({ onSuccess: () => { setAdding(null); setCode(""); setStatement(""); setAssume(""); setMeans(""); reload(); } });
  const del = trpc.logframe.delete.useMutation({ onSuccess: reload });

  // which node's "add child" form is open ("root" = top-level goal)
  const [adding, setAdding] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [statement, setStatement] = useState("");
  const [assume, setAssume] = useState("");
  const [means, setMeans] = useState("");

  if (q.isLoading) return <Loading />;
  const items = q.data ?? [];
  const canEdit = can("ngo:manage");
  const childrenOf = (id: string | null) => items.filter((i) => i.parentId === id);

  const form = (parent: Item | null, level: Level) => (
    <form
      className="mt-2 space-y-2 rounded-lg bg-slate-100 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.trim() && statement.trim().length >= 2)
          create.mutate({ projectId, parentId: parent?.id ?? null, level, code: code.trim(), statement: statement.trim(), assumptions: assume || undefined, meansOfVerification: means || undefined });
      }}
    >
      <div className="flex gap-2">
        <Input className="w-24" placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} />
        <Input placeholder={`${level.toLowerCase()} statement`} value={statement} onChange={(e) => setStatement(e.target.value)} />
      </div>
      <Input placeholder="Assumptions / risks (optional)" value={assume} onChange={(e) => setAssume(e.target.value)} />
      <Input placeholder="Means of verification (optional)" value={means} onChange={(e) => setMeans(e.target.value)} />
      <div className="flex gap-2">
        <Button type="submit" disabled={create.isPending}>Add {level.toLowerCase()}</Button>
        <Button type="button" variant="ghost" onClick={() => setAdding(null)}>Cancel</Button>
      </div>
    </form>
  );

  const node = (item: Item, depth: number): React.ReactNode => {
    const next = NEXT[item.level];
    const kids = childrenOf(item.id);
    return (
      <li key={item.id} style={{ marginLeft: depth ? 24 : 0 }} className="mt-2">
        <div className="rounded-xl border border-slate-200/70 bg-white shadow-soft p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={TONE[item.level]}>{item.level.toLowerCase()}</Badge>
            <span className="text-sm font-bold text-slate-500">{item.code}</span>
            <span className="font-medium">{item.statement}</span>
            {item._count.indicators > 0 && <span className="text-xs text-slate-500">· {item._count.indicators} indicator(s)</span>}
            <span className="ml-auto flex gap-2">
              {canEdit && next && <button className="text-xs text-brand-600" onClick={() => { setAdding(item.id); setCode(`${item.code}.${kids.length + 1}`); }}>+ {next.toLowerCase()}</button>}
              {canEdit && <button className="text-xs text-red-600" onClick={() => window.confirm("Delete this and everything beneath it?") && del.mutate({ itemId: item.id })}>Delete</button>}
            </span>
          </div>
          {item.assumptions && <p className="mt-1 text-xs text-slate-500">Assumptions: {item.assumptions}</p>}
          {item.meansOfVerification && <p className="text-xs text-slate-500">Verified by: {item.meansOfVerification}</p>}
          {adding === item.id && next && form(item, next)}
        </div>
        {kids.length > 0 && <ul>{kids.map((k) => node(k, depth + 1))}</ul>}
      </li>
    );
  };

  const roots = childrenOf(null);

  return (
    <div className="space-y-4">
      <ErrorText error={q.error ?? create.error ?? del.error} />
      {roots.length === 0 && adding !== "root" && <Empty>No logframe yet. Start with the overall goal.</Empty>}
      <ul>{roots.map((r) => node(r, 0))}</ul>
      {canEdit && roots.length === 0 && (adding === "root" ? form(null, "GOAL") : <Button onClick={() => { setAdding("root"); setCode("1"); }}>+ Add goal</Button>)}
    </div>
  );
}
