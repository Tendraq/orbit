"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type Item = { id: string; label: string; hint: string; href: string; group: string };

const PAGES: Item[] = [
  { id: "p-home", label: "Home", hint: "Dashboard and what needs you", href: "/home", group: "Go to" },
  { id: "p-tasks", label: "My tasks", hint: "Everything assigned to you", href: "/my-tasks", group: "Go to" },
  { id: "p-inbox", label: "Inbox", hint: "Notifications", href: "/inbox", group: "Go to" },
  { id: "p-share", label: "Share Orbit", hint: "Recommend it to a colleague or partner", href: "/recommend", group: "Go to" },
  { id: "p-help", label: "Help center", hint: "Guides, roles, shortcuts", href: "/help", group: "Go to" },
  { id: "p-new-org", label: "Create an organization", hint: "Start a new workspace", href: "/home#create", group: "Actions" },
];

// Press Ctrl+K (or Cmd+K) anywhere to jump to a page, organization or project.
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const workspaces = trpc.workspace.list.useQuery(undefined, { enabled: open });
  const projects = trpc.search.palette.useQuery(undefined, { enabled: open });

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
    };
    const show = () => setOpen(true);
    window.addEventListener("keydown", key);
    window.addEventListener("orbit:palette", show);
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("orbit:palette", show); };
  }, []);

  useEffect(() => { if (open) { setQ(""); setIdx(0); } }, [open]);

  const all = useMemo<Item[]>(() => {
    const orgs: Item[] = (workspaces.data ?? []).flatMap((w) => [
      { id: `${w.id}-p`, label: `${w.name}: Projects`, hint: "Organization", href: `/${w.slug}/projects`, group: "Organizations" },
      { id: `${w.id}-pf`, label: `${w.name}: Portfolio`, hint: "All projects at a glance", href: `/${w.slug}/portfolio`, group: "Organizations" },
      { id: `${w.id}-m`, label: `${w.name}: Members`, hint: "People and invitations", href: `/${w.slug}/members`, group: "Organizations" },
      { id: `${w.id}-a`, label: `${w.name}: Activity`, hint: "Who did what", href: `/${w.slug}/activity`, group: "Organizations" },
      { id: `${w.id}-i`, label: `${w.name}: Integrations`, hint: "Calendar, Slack, Teams, API", href: `/${w.slug}/integrations`, group: "Organizations" },
    ]);
    const projs: Item[] = (projects.data ?? []).map((p) => ({
      id: p.id, label: p.name, hint: `${p.workspaceName}${p.code ? ` · ${p.code}` : ""}`,
      href: `/${p.slug}/projects/${p.id}/overview`, group: "Projects",
    }));
    return [...PAGES, ...projs, ...orgs];
  }, [workspaces.data, projects.data]);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (t ? all.filter((i) => `${i.label} ${i.hint}`.toLowerCase().includes(t)) : all).slice(0, 30);
  }, [all, q]);

  function go(item?: Item) {
    if (!item) return;
    setOpen(false);
    router.push(item.href);
  }

  if (!open) return null;
  let lastGroup = "";

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-950/50 px-4 pt-[14vh] backdrop-blur-sm" onMouseDown={() => setOpen(false)}>
      <div className="animate-fade-up w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lift" onMouseDown={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={q}
          onChange={(e) => { setQ(e.target.value); setIdx(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
            if (e.key === "Enter") go(results[idx]);
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Search pages, organizations and projects…"
          className="w-full border-b border-slate-100 px-5 py-4 text-base outline-none placeholder:text-slate-400"
        />
        <ul className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-500">Nothing found.</li>}
          {results.map((r, i) => {
            const header = r.group !== lastGroup ? r.group : null;
            lastGroup = r.group;
            return (
              <li key={r.id}>
                {header && <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{header}</p>}
                <button
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => go(r)}
                  className={cn("flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm", i === idx ? "bg-brand-50 text-brand-800" : "text-slate-700")}
                >
                  <span className="truncate font-medium">{r.label}</span>
                  <span className="truncate text-xs text-slate-400">{r.hint}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-4 border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
          <span>↑↓ to move</span><span>Enter to open</span><span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}
