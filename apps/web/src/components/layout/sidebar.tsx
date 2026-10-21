"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Icon, Logo, type IconName } from "@/components/ui/icons";
import { OrgAvatar } from "@/components/ui/kit";

export function Sidebar() {
  const pathname = usePathname();
  const workspaces = trpc.workspace.list.useQuery();
  const unread = trpc.notification.unreadCount.useQuery(undefined, { refetchInterval: 30000 });

  const item = (href: string, text: string, icon: IconName, badge?: number) => {
    const active = pathname === href;
    return (
      <Link
        key={href}
        href={href}
        className={cn(
          "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
          active ? "bg-white/10 font-medium text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
        )}
      >
        <Icon name={icon} className={cn("h-[18px] w-[18px]", active ? "text-brand-300" : "text-slate-500 group-hover:text-slate-300")} />
        <span className="flex-1">{text}</span>
        {!!badge && (
          <span className="rounded-full bg-gradient-to-r from-brand-500 to-fuchsia-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">{badge}</span>
        )}
      </Link>
    );
  };

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto bg-slate-950 p-4 print:hidden md:flex">
      <Link href="/home" className="mb-8 flex items-center gap-2.5 px-2 pt-1">
        <Logo />
        <span className="text-lg font-semibold tracking-tight text-white">Orbit</span>
      </Link>

      <nav className="space-y-1">
        {item("/home", "Home", "home")}
        {item("/my-tasks", "My tasks", "tasks")}
        {item("/inbox", "Inbox", "bell", unread.data)}
      </nav>

      <p className="mb-2 mt-8 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Organizations</p>
      <nav className="space-y-1">
        {workspaces.data?.map((w) => {
          const active = pathname.startsWith(`/${w.slug}/`);
          return (
            <Link
              key={w.id}
              href={`/${w.slug}/projects`}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition",
                active ? "bg-white/10 font-medium text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <OrgAvatar name={w.name} size={22} />
              <span className="truncate">{w.name}</span>
            </Link>
          );
        })}
        {workspaces.data?.length === 0 && <p className="px-3 text-xs text-slate-500">None yet</p>}
      </nav>

      <p className="mb-2 mt-8 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Support</p>
      <nav className="space-y-1">
        {item("/help", "Help center", "file")}
        {item("/recommend", "Share Orbit", "users")}
      </nav>

      <div className="mt-auto pt-6">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("orbit:palette"))}
          className="flex w-full items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-400 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
        >
          Quick search <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">Ctrl K</kbd>
        </button>
      </div>
    </aside>
  );
}
