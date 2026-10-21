"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useWorkspace } from "@/lib/contexts";
import { Badge, Card, Empty, ErrorText, Loading } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function PartnersPage() {
  const ws = useWorkspace();
  const utils = trpc.useUtils();
  const q = trpc.partner.list.useQuery({ workspaceSlug: ws.slug });
  const reload = () => utils.partner.list.invalidate({ workspaceSlug: ws.slug });
  const create = trpc.partner.create.useMutation({ onSuccess: () => { setName(""); setType(""); setCountry(""); setEmail(""); reload(); } });
  const setStatus = trpc.partner.setStatus.useMutation({ onSuccess: reload });
  const del = trpc.partner.delete.useMutation({ onSuccess: reload });
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [country, setCountry] = useState("");
  const [email, setEmail] = useState("");
  const manage = ws.can("ngo:manage");

  if (q.isLoading) return <Loading />;

  return (
    <div className="space-y-6">
      <ErrorText error={create.error ?? setStatus.error ?? del.error} />
      {q.data?.length === 0 && <Empty>No {ws.term("partner").toLowerCase()}s yet.</Empty>}
      <ul className="grid gap-3 md:grid-cols-3">
        {q.data?.map((p) => (
          <Card key={p.id}>
            <div className="flex items-start justify-between"><span className="font-semibold">{p.name}</span><Badge value={p.status === "ACTIVE" ? "GREEN" : "SLATE"}>{p.status.toLowerCase()}</Badge></div>
            <p className="text-xs text-slate-500">{[p.type, p.country].filter(Boolean).join(" · ") || "—"}</p>
            {p.contactEmail && <p className="text-xs text-slate-500">{p.contactEmail}</p>}
            {manage && (
              <div className="mt-2 flex gap-3 text-xs">
                <button className="text-brand-600" onClick={() => setStatus.mutate({ workspaceSlug: ws.slug, partnerId: p.id, status: p.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })}>{p.status === "ACTIVE" ? "Deactivate" : "Activate"}</button>
                <button className="text-red-600" onClick={() => window.confirm("Delete this partner?") && del.mutate({ workspaceSlug: ws.slug, partnerId: p.id })}>Delete</button>
              </div>
            )}
          </Card>
        ))}
      </ul>
      {manage && (
        <Card>
          <h3 className="mb-2 font-semibold">Add {ws.term("partner").toLowerCase()}</h3>
          <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim().length >= 2) create.mutate({ workspaceSlug: ws.slug, name: name.trim(), type: type || undefined, country: country || undefined, contactEmail: email }); }}>
            <Input className="w-56" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input className="w-44" placeholder="Type (e.g. Sub-grantee)" value={type} onChange={(e) => setType(e.target.value)} />
            <Input className="w-36" placeholder="Country" value={country} onChange={(e) => setCountry(e.target.value)} />
            <Input className="w-56" type="email" placeholder="Contact email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button type="submit" disabled={name.trim().length < 2 || create.isPending}>Add</Button>
          </form>
        </Card>
      )}
    </div>
  );
}
