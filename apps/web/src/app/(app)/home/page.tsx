"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { slugify } from "@/lib/utils";
import { Badge, Card, Empty, ErrorText, Loading, OrgAvatar, ProgressBar, SectionTitle, Select } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icons";
import { SECTORS } from "@/config";
import { fmtDate, money } from "@/lib/format";

export default function HomePage() {
  const utils = trpc.useUtils();
  const workspaces = trpc.workspace.list.useQuery();
  const mine = trpc.task.mine.useQuery();
  const att = trpc.report.attention.useQuery();
  const [name, setName] = useState("");
  const [sector, setSector] = useState<(typeof SECTORS)[number]>("NGO");

  const create = trpc.workspace.create.useMutation({
    onSuccess: () => { setName(""); utils.workspace.list.invalidate(); utils.report.attention.invalidate(); },
  });

  if (workspaces.isLoading) return <Loading />;
  const open = mine.data?.length ?? 0;
  const overdueMine = att.data?.overdue.length ?? 0;
  const a = att.data;
  const total = a ? a.gates.length + a.changes.length + a.expenses.length + a.overdue.length + a.milestones.length + a.atRisk.length : 0;
  const L = (slug: string, id: string, tab: string) => `/${slug}/projects/${id}/${tab}`;

  const steps = a
    ? [
        { done: a.steps.organization, text: "Create your organization", href: "#create" },
        { done: a.steps.project, text: "Create your first project", href: a.firstSlug ? `/${a.firstSlug}/projects#new` : "#create" },
        { done: a.steps.tasks, text: "Add some tasks", href: a.firstSlug ? `/${a.firstSlug}/projects` : "#create" },
        { done: a.steps.teammate, text: "Invite a teammate", href: a.firstSlug ? `/${a.firstSlug}/members` : "#create" },
        { done: a.steps.gate, text: "Approve your first stage gate", href: a.firstSlug ? `/${a.firstSlug}/projects` : "#create" },
      ]
    : [];
  const doneSteps = steps.filter((s) => s.done).length;

  return (
    <div className="space-y-10">
      {/* welcome banner */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-brand-700 to-fuchsia-600 p-8 text-white shadow-glow">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <h1 className="relative text-3xl font-semibold tracking-tight">Welcome back</h1>
        <p className="relative mt-1 text-white/80">Here is where you stand today.</p>
        <div className="relative mt-6 grid max-w-xl grid-cols-3 gap-3">
          {[["Organizations", workspaces.data?.length ?? 0], ["Open tasks", open], ["Overdue", overdueMine]].map(([l, v]) => (
            <div key={l as string} className="rounded-xl bg-white/10 p-3 ring-1 ring-white/15 backdrop-blur">
              <p className="text-2xl font-semibold">{v}</p>
              <p className="text-xs text-white/75">{l}</p>
            </div>
          ))}
        </div>
        {open > 0 && (
          <Link href="/my-tasks" className="relative mt-5 inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline">
            Open my tasks <Icon name="arrow" className="h-4 w-4" />
          </Link>
        )}
      </section>

      {/* getting started */}
      {a && doneSteps < steps.length && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold tracking-tight">Get started</h2>
            <span className="text-sm text-slate-500">{doneSteps} of {steps.length} done</span>
          </div>
          <ProgressBar pct={(doneSteps / steps.length) * 100} />
          <ul className="mt-4 grid gap-2 md:grid-cols-2">
            {steps.map((s) => (
              <li key={s.text}>
                <Link href={s.href} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-sm transition hover:border-brand-300 hover:bg-brand-50/40">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full ${s.done ? "bg-emerald-500 text-white" : "border-2 border-slate-300"}`}>
                    {s.done && <Icon name="check" className="h-3 w-3" />}
                  </span>
                  <span className={s.done ? "text-slate-400 line-through" : "font-medium"}>{s.text}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* needs your attention */}
      {a && (
        <section>
          <SectionTitle right={total > 0 ? <Badge tone="amber">{total} item(s)</Badge> : undefined}>Needs your attention</SectionTitle>
          {total === 0 ? (
            <Empty>You are all caught up. Nothing is waiting for you right now.</Empty>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {(a.gates.length + a.changes.length + a.expenses.length) > 0 && (
                <Card>
                  <h3 className="mb-2 font-semibold">Waiting for your approval</h3>
                  <ul className="space-y-1.5 text-sm">
                    {a.gates.map((g) => <li key={g.id}><Link className="hover:text-brand-600" href={L(g.slug, g.project.id, "overview")}>Stage gate: <b>{g.project.name}</b></Link></li>)}
                    {a.changes.map((c) => <li key={c.id}><Link className="hover:text-brand-600" href={L(c.slug, c.project.id, "changes")}>Change: <b>{c.title}</b> <span className="text-slate-400">· {c.project.name}</span></Link></li>)}
                    {a.expenses.map((x) => <li key={x.id}><Link className="hover:text-brand-600" href={L(x.slug, x.project.id, "budget")}>Expense: <b>{x.description}</b> <span className="text-slate-400">· {money(x.amount, x.project.currency)}</span></Link></li>)}
                  </ul>
                </Card>
              )}
              {a.overdue.length > 0 && (
                <Card>
                  <h3 className="mb-2 font-semibold text-red-700">Your overdue tasks</h3>
                  <ul className="space-y-1.5 text-sm">
                    {a.overdue.map((t) => <li key={t.id}><Link className="hover:text-brand-600" href={`/tasks/${t.id}`}>{t.title} <span className="text-slate-400">· {t.project.name} · due {fmtDate(t.dueDate)}</span></Link></li>)}
                  </ul>
                </Card>
              )}
              {a.milestones.length > 0 && (
                <Card>
                  <h3 className="mb-2 font-semibold">Milestones in the next 14 days</h3>
                  <ul className="space-y-1.5 text-sm">
                    {a.milestones.map((m) => <li key={m.id}><Link className="hover:text-brand-600" href={L(m.slug, m.project.id, "overview")}>{m.name} <span className="text-slate-400">· {m.project.name} · {fmtDate(m.dueDate)}</span></Link></li>)}
                  </ul>
                </Card>
              )}
              {a.atRisk.length > 0 && (
                <Card>
                  <h3 className="mb-2 font-semibold text-red-700">Projects marked red</h3>
                  <ul className="space-y-1.5 text-sm">
                    {a.atRisk.map((p) => <li key={p.id}><Link className="hover:text-brand-600" href={L(p.slug, p.id, "overview")}>{p.name}</Link></li>)}
                  </ul>
                </Card>
              )}
            </div>
          )}
        </section>
      )}
      <ErrorText error={att.error} />

      <section>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Your organizations</h2>
        {workspaces.data?.length === 0 && <Empty>You have no organization yet. Create one below to get started.</Empty>}
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workspaces.data?.map((w) => (
            <li key={w.id}>
              <Link href={`/${w.slug}/projects`} className="block">
                <Card className="group flex items-center gap-4 hover:-translate-y-0.5 hover:shadow-lift">
                  <OrgAvatar name={w.name} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold tracking-tight">{w.name}</p>
                    <p className="truncate text-xs text-slate-500">/{w.slug}</p>
                  </div>
                  <Badge tone="slate">{w.sector.replace("_", " ").toLowerCase()}</Badge>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Card id="create" className="max-w-3xl">
        <h2 className="font-semibold tracking-tight">Create an organization</h2>
        <form className="mt-4 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); create.mutate({ name, slug: slugify(name), sector }); }}>
          <Input className="min-w-[220px] flex-1" placeholder="Organization name" value={name} onChange={(e) => setName(e.target.value)} />
          <Select className="w-44" value={sector} onChange={(e) => setSector(e.target.value as typeof sector)}>
            {SECTORS.map((s) => <option key={s} value={s}>{s.replace("_", " ").toLowerCase()}</option>)}
          </Select>
          <Button type="submit" disabled={name.trim().length < 2 || create.isPending}>Create</Button>
        </form>
        <p className="mt-3 text-xs text-slate-500">Choosing NGO switches on the logframe, indicators, grants, partners, beneficiaries and donor reports.</p>
        <div className="mt-3"><ErrorText error={create.error} /></div>
      </Card>
    </div>
  );
}
