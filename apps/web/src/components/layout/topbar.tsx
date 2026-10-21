"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { trpc } from "@/lib/trpc";
import { Icon, Logo } from "@/components/ui/icons";
import { Dropdown, MenuDivider, MenuItem, MenuLabel } from "@/components/ui/dropdown";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const RESERVED = new Set(["home", "my-tasks", "inbox", "help", "recommend", "tasks", "invite", "sign-in", "sign-up", "api"]);

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const utils = trpc.useUtils();
  const first = pathname.split("/")[1] ?? "";
  const slug = first && !RESERVED.has(first) ? first : null; // are we inside an organization?

  const unread = trpc.notification.unreadCount.useQuery(undefined, { refetchInterval: 30000 });
  const recent = trpc.notification.list.useQuery({ unreadOnly: false, limit: 6 });
  const read = trpc.notification.markRead.useMutation({
    onSuccess: () => { utils.notification.list.invalidate(); utils.notification.unreadCount.invalidate(); },
  });
  const readAll = trpc.notification.markAllRead.useMutation({
    onSuccess: () => { utils.notification.list.invalidate(); utils.notification.unreadCount.invalidate(); },
  });

  return (
    <header className="glass sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200/70 px-4 print:hidden md:px-8">
      {/* phones have no sidebar, so show a mini menu */}
      <nav className="flex items-center gap-3 text-sm md:hidden">
        <Link href="/home" className="flex items-center gap-2 font-semibold"><Logo className="h-7 w-7" /></Link>
        <Link href="/my-tasks" className="text-slate-600">Tasks</Link>
        <Link href="/inbox" className="text-slate-600">Inbox</Link>
      </nav>

      {/* search / command palette */}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("orbit:palette"))}
        className="hidden max-w-md flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 text-left text-sm text-slate-400 shadow-sm transition hover:border-slate-300 md:flex"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
        <span className="flex-1">Search or jump to…</span>
        <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">Ctrl K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-1.5">
        {/* quick create */}
        <Dropdown
          label="Create new"
          width="w-60"
          triggerClassName="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-brand-500 to-brand-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm shadow-brand-700/30 transition hover:from-brand-600 hover:to-brand-700"
          trigger={<><Icon name="plus" className="h-4 w-4" /> New</>}
        >
          {(close) => (
            <>
              {slug && (
                <>
                  <MenuLabel>In this organization</MenuLabel>
                  <MenuItem href={`/${slug}/projects#new`} onClick={close}>New project</MenuItem>
                  <MenuItem href={`/${slug}/members`} onClick={close}>Invite a teammate</MenuItem>
                  <MenuDivider />
                </>
              )}
              <MenuItem href="/home#create" onClick={close}>New organization</MenuItem>
            </>
          )}
        </Dropdown>

        {/* notifications */}
        <Dropdown
          label="Notifications"
          width="w-80"
          triggerClassName="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-900/5"
          trigger={
            <>
              <Icon name="bell" />
              {!!unread.data && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-r from-brand-500 to-fuchsia-500 px-1 text-[10px] font-semibold text-white">
                  {unread.data > 9 ? "9+" : unread.data}
                </span>
              )}
            </>
          }
        >
          {(close) => (
            <>
              <div className="flex items-center justify-between px-3 py-2">
                <p className="text-sm font-semibold">Notifications</p>
                {!!unread.data && <button className="text-xs text-brand-600 hover:underline" onClick={() => readAll.mutate()}>Mark all read</button>}
              </div>
              {recent.data?.length === 0 && <p className="px-3 py-6 text-center text-sm text-slate-500">You are all caught up.</p>}
              <ul>
                {recent.data?.map((n) => (
                  <li key={n.id}>
                    <button
                      className={cn("w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100", !n.readAt && "bg-brand-50/60")}
                      onClick={() => { if (!n.readAt) read.mutate({ id: n.id }); close(); if (n.link) router.push(n.link); }}
                    >
                      <span className={cn("block", !n.readAt && "font-semibold")}>{n.title}</span>
                      <span className="block text-xs text-slate-400">{fmtDate(n.createdAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <MenuDivider />
              <MenuItem href="/inbox" onClick={close}>See all notifications</MenuItem>
            </>
          )}
        </Dropdown>

        {/* help */}
        <Dropdown
          label="Help"
          width="w-60"
          triggerClassName="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-900/5"
          trigger={<span className="text-base font-semibold">?</span>}
        >
          {(close) => (
            <>
              <MenuItem href="/help" onClick={close}>Help center</MenuItem>
              <MenuItem href="/help#shortcuts" onClick={close} hint="Ctrl K">Keyboard shortcuts</MenuItem>
              <MenuItem href="/help#roles" onClick={close}>Who can do what</MenuItem>
              <MenuDivider />
              <MenuItem href="/recommend" onClick={close}>Share Orbit with someone</MenuItem>
              <MenuItem href="mailto:?subject=Orbit%20feedback" external onClick={close}>Send feedback</MenuItem>
            </>
          )}
        </Dropdown>

        <UserButton />
      </div>
    </header>
  );
}
