"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useWorkspace } from "@/lib/contexts";
import { Badge, Empty, ErrorText, Loading, SectionTitle } from "@/components/ui/kit";

function Results() {
  const ws = useWorkspace();
  const q = (useSearchParams().get("q") ?? "").trim();
  const res = trpc.search.query.useQuery({ workspaceSlug: ws.slug, q }, { enabled: q.length >= 2 });

  if (q.length < 2) return <Empty>Type at least 2 letters in the search box.</Empty>;
  if (res.isLoading) return <Loading />;
  const r = res.data;
  if (!r) return <ErrorText error={res.error} />;
  const none = !r.projects.length && !r.tasks.length && !r.documents.length;

  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="text-lg font-semibold">Results for “{q}”</h2>
      {none && <Empty>Nothing found.</Empty>}
      {r.projects.length > 0 && (
        <section><SectionTitle>Projects</SectionTitle>
          <ul className="space-y-1 text-sm">{r.projects.map((p) => <li key={p.id}><Link className="hover:text-brand-600" href={`/${ws.slug}/projects/${p.id}/overview`}>{p.name}</Link></li>)}</ul>
        </section>
      )}
      {r.tasks.length > 0 && (
        <section><SectionTitle>Tasks</SectionTitle>
          <ul className="space-y-1 text-sm">{r.tasks.map((t) => <li key={t.id} className="flex gap-2"><Link className="hover:text-brand-600" href={`/tasks/${t.id}`}>{t.title}</Link><Badge value={t.status} /><span className="text-xs text-slate-500">{t.project.name}</span></li>)}</ul>
        </section>
      )}
      {r.documents.length > 0 && (
        <section><SectionTitle>Documents</SectionTitle>
          <ul className="space-y-1 text-sm">{r.documents.map((d) => <li key={d.id}><Link className="hover:text-brand-600" href={`/${ws.slug}/projects/${d.project.id}/documents`}>{d.title}</Link> <span className="text-xs text-slate-500">{d.project.name}</span></li>)}</ul>
        </section>
      )}
    </div>
  );
}

export default function SearchPage() {
  return <Suspense fallback={<Loading />}><Results /></Suspense>;
}
