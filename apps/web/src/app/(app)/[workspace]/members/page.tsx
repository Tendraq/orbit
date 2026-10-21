"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useWorkspace } from "@/lib/contexts";
import { Avatar, Badge, Card, Empty, ErrorText, Loading, SectionTitle, Select } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtDate } from "@/lib/format";

const ROLES = ["ADMIN", "MEMBER", "GUEST"] as const;
const ROLE_HELP: Record<string, string> = {
  ADMIN: "Everything except changing organization settings",
  MEMBER: "Create and edit work; cannot approve or delete",
  GUEST: "View only (donors, partners, clients)",
};

export default function MembersPage() {
  const ws = useWorkspace();
  const utils = trpc.useUtils();
  const members = trpc.workspace.members.useQuery({ slug: ws.slug });
  const invites = trpc.workspace.invitations.useQuery({ slug: ws.slug }, { enabled: ws.can("member:manage") });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("MEMBER");
  const [copied, setCopied] = useState<string | null>(null);

  const reload = () => { utils.workspace.members.invalidate({ slug: ws.slug }); utils.workspace.invitations.invalidate({ slug: ws.slug }); };
  const invite = trpc.workspace.invite.useMutation({ onSuccess: () => { setEmail(""); reload(); } });
  const revoke = trpc.workspace.revokeInvite.useMutation({ onSuccess: reload });
  const setRoleM = trpc.workspace.updateRole.useMutation({ onSuccess: reload });
  const remove = trpc.workspace.removeMember.useMutation({ onSuccess: reload });

  if (members.isLoading) return <Loading />;
  const manage = ws.can("member:manage");
  const linkFor = (token: string) => `${window.location.origin}/invite/${token}`;

  return (
    <div className="max-w-3xl space-y-8">
      <ErrorText error={invite.error ?? revoke.error ?? setRoleM.error ?? remove.error} />
      <section>
        <SectionTitle>Members ({members.data?.length ?? 0})</SectionTitle>
        <ul className="space-y-2">
          {members.data?.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-xl border border-slate-200/70 bg-white shadow-soft p-3">
              <Avatar name={m.user.name ?? m.user.email} size={32} />
              <div className="flex-1">
                <p className="text-sm font-medium">{m.user.name ?? m.user.email}</p>
                <p className="text-xs text-slate-500">{m.user.email} · joined {fmtDate(m.createdAt)}</p>
              </div>
              {m.role === "OWNER" || !manage ? <Badge tone="indigo">{m.role.toLowerCase()}</Badge> : (
                <>
                  <Select className="w-32" value={m.role} onChange={(e) => setRoleM.mutate({ slug: ws.slug, membershipId: m.id, role: e.target.value as (typeof ROLES)[number] })}>
                    {ROLES.map((r) => <option key={r} value={r}>{r.toLowerCase()}</option>)}
                  </Select>
                  <button className="text-xs text-red-600" onClick={() => window.confirm("Remove this member?") && remove.mutate({ slug: ws.slug, membershipId: m.id })}>Remove</button>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      {manage && (
        <>
          <Card>
            <SectionTitle>Invite someone</SectionTitle>
            <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); invite.mutate({ slug: ws.slug, email, role }); }}>
              <Input className="min-w-[220px] flex-1" type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Select className="w-36" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>{ROLES.map((r) => <option key={r} value={r}>{r.toLowerCase()}</option>)}</Select>
              <Button type="submit" disabled={!email || invite.isPending}>Create invite</Button>
            </form>
            <p className="mt-2 text-xs text-slate-500">{ROLE_HELP[role]}. You get a link to send them; email sending comes in a later stage.</p>
          </Card>

          <section>
            <SectionTitle>Pending invitations</SectionTitle>
            {invites.data?.length === 0 && <Empty>No pending invitations.</Empty>}
            <ul className="space-y-2">
              {invites.data?.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/70 bg-white shadow-soft p-3 text-sm">
                  <span className="font-medium">{i.email}</span><Badge value={i.role} />
                  <span className="ml-auto flex gap-3 text-xs">
                    <button className="text-brand-600" onClick={async () => { await navigator.clipboard.writeText(linkFor(i.token)); setCopied(i.id); }}>
                      {copied === i.id ? "Copied!" : "Copy invite link"}
                    </button>
                    <button className="text-red-600" onClick={() => revoke.mutate({ slug: ws.slug, invitationId: i.id })}>Revoke</button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
