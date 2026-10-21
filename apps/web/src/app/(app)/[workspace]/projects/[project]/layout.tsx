"use client";

import { use } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { buildProjectValue, ProjectContext } from "@/lib/contexts";
import { Badge, Loading } from "@/components/ui/kit";
import { Dropdown, MenuDivider, MenuItem } from "@/components/ui/dropdown";
import { PHASE_LABELS, type Phase } from "@/config";
import { cn } from "@/lib/utils";

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string; project: string }>;
}) {
  const { workspace, project: projectId } = use(params);
  const pathname = usePathname();
  const query = trpc.project.get.useQuery({ projectId });

  if (query.isLoading) return <Loading />;
  if (query.error || !query.data) {
    return <p className="text-red-600">{query.error?.message ?? "Project not found"}</p>;
  }
  const value = buildProjectValue(query.data);
  const p = value.project;
  const base = `/${workspace}/projects/${projectId}`;

  const tabs = [
    { path: "overview", text: "Overview" },
    { path: "board", text: "Board" },
    { path: "list", text: "List" },
    { path: "table", text: "Table" },
    { path: "timeline", text: "Timeline" },
    { path: "calendar", text: "Calendar" },
    ...(value.has("budget") ? [{ path: "budget", text: "Budget" }] : []),
    ...(value.has("time") ? [{ path: "time", text: "Time" }] : []),
    ...(value.has("risks") ? [{ path: "risks", text: "Risks & issues" }] : []),
    ...(value.has("changes") ? [{ path: "changes", text: "Changes" }] : []),
    ...(value.has("stakeholders") ? [{ path: "stakeholders", text: "Stakeholders" }] : []),
    ...(value.has("documents") ? [{ path: "documents", text: "Documents" }] : []),
    ...(value.has("ngo") ? [{ path: "logframe", text: "Logframe" }, { path: "indicators", text: "Indicators" }, { path: "reports", text: "Donor reports" }] : []),
    ...(value.has("evaluation") ? [{ path: "evaluation", text: "Evaluation" }] : []),
    { path: "closure", text: "Closure" },
    ...(value.can("project:update") ? [{ path: "settings", text: "Settings" }] : []),
  ];

  return (
    <ProjectContext.Provider value={value}>
      <div className="mb-5 space-y-3">
        <Link href={`/${workspace}/projects`} className="text-sm text-slate-500 transition hover:text-brand-600">
          ← All {value.term("project").toLowerCase()}s
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{p.name}</h1>
          {p.code && <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{p.code}</span>}
          <Badge value={p.status} />
          <Badge tone="indigo">{PHASE_LABELS[p.phase as Phase]}</Badge>
          <Badge value={p.health}>Health: {p.health.toLowerCase()}</Badge>
          <div className="ml-auto print:hidden">
            <Dropdown
              label="Project actions"
              width="w-60"
              triggerClassName="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300"
              trigger={<>Actions ▾</>}
            >
              {(close) => (
                <>
                  <MenuItem onClick={() => { navigator.clipboard.writeText(window.location.href); close(); }}>Copy link to this page</MenuItem>
                  <MenuItem onClick={() => { close(); window.print(); }}>Print this page</MenuItem>
                  <MenuItem href={`/api/export/tasks?projectId=${projectId}`} external onClick={close}>Download tasks (CSV)</MenuItem>
                  {value.has("ngo") && <MenuItem href={`${base}/reports`} onClick={close}>Donor reports</MenuItem>}
                  <MenuItem href={`${base}/closure`} onClick={close}>Closure checklist</MenuItem>
                  {value.can("project:update") && (
                    <>
                      <MenuDivider />
                      <MenuItem href={`${base}/settings`} onClick={close}>Project settings</MenuItem>
                    </>
                  )}
                </>
              )}
            </Dropdown>
          </div>
        </div>
      </div>
      <nav className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-slate-200/50 p-1">
        {tabs.map((t) => (
          <Link
            key={t.path}
            href={`${base}/${t.path}`}
            className={cn(
              "whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm transition",
              pathname.endsWith(`/${t.path}`)
                ? "bg-white font-medium text-brand-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            {t.text}
          </Link>
        ))}
      </nav>
      {children}
    </ProjectContext.Provider>
  );
}
