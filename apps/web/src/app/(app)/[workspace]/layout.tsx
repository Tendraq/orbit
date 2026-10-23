"use client";

import { use, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { buildWorkspaceValue, WorkspaceContext } from "@/lib/contexts";
import { Loading, OrgAvatar } from "@/components/ui/kit";
import { can } from "@/config/permissions";
import { cn } from "@/lib/utils";

export default function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = use(params);
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");
  const query = trpc.workspace.get.useQuery({ slug });
  // owners and admins see an Approvals tab with a live count
  const approvals = trpc.report.approvals.useQuery(
    { workspaceSlug: slug },
    { enabled: !!query.data && can(query.data.role, "gate:approve"), refetchInterval: 60000 }
  );

  if (query.isLoading) return <Loading />;
  if (query.error || !query.data) {
    return <p className="text-red-600">{query.error?.message ?? "Organization not found"}</p>;
  }
  const ws = buildWorkspaceValue(query.data);

  const tabs = [
    { href: `/${slug}/projects`, text: ws.term("project") + "s" },
    { href: `/${slug}/portfolio`, text: "Portfolio" },
    ...(ws.can("gate:approve") ? [{ href: `/${slug}/approvals`, text: "Approvals", badge: approvals.data?.total }] : []),
    ...(ws.has("ngo")
      ? [
          { href: `/${slug}/grants`, text: "Grants" },
          { href: `/${slug}/partners`, text: ws.term("partner") + "s" },
          ...(ws.can("beneficiary:read") ? [{ href: `/${slug}/beneficiaries`, text: ws.term("beneficiary") + "s" }] : []),
        ]
      : []),
    { href: `/${slug}/members`, text: "Members" },
    { href: `/${slug}/activity`, text: "Activity" },
    { href: `/${slug}/integrations`, text: "Integrations" },
    ...(ws.can("workspace:update") ? [{ href: `/${slug}/settings`, text: "Settings" }] : []),
  ];

  return (
    <WorkspaceContext.Provider value={ws}>
      <div className="mb-8 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <OrgAvatar name={ws.name} size={40} />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{ws.name}</h1>
            <p className="text-xs capitalize text-slate-500">{ws.sector.replace("_", " ").toLowerCase()} organization</p>
          </div>
          <form
            className="ml-auto w-full md:w-64"
            onSubmit={(e) => {
              e.preventDefault();
              if (q.trim().length >= 2) router.push(`/${slug}/search?q=${encodeURIComponent(q.trim())}`);
            }}
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tasks, projects, documents…"
              className="w-full rounded-xl border border-slate-200/70 bg-white shadow-soft px-3 py-2 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
            />
          </form>
        </div>
        <nav className="flex gap-1 overflow-x-auto rounded-xl bg-slate-200/50 p-1">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm transition",
                pathname.startsWith(t.href)
                  ? "bg-white font-medium text-brand-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              {t.text}
              {"badge" in t && !!t.badge && (
                <span className="ml-1.5 rounded-full bg-gradient-to-r from-brand-500 to-fuchsia-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">{t.badge}</span>
              )}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </WorkspaceContext.Provider>
  );
}
