"use client";

import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Empty, ErrorText, Loading } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function InboxPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const q = trpc.notification.list.useQuery({ unreadOnly: false, limit: 100 });
  const reload = () => { utils.notification.list.invalidate(); utils.notification.unreadCount.invalidate(); };
  const read = trpc.notification.markRead.useMutation({ onSuccess: reload });
  const readAll = trpc.notification.markAllRead.useMutation({ onSuccess: reload });

  if (q.isLoading) return <Loading />;
  const unread = q.data?.filter((n) => !n.readAt).length ?? 0;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inbox {unread > 0 && <span className="text-base font-normal text-slate-500">({unread} unread)</span>}</h1>
        {unread > 0 && <Button variant="ghost" onClick={() => readAll.mutate()}>Mark all read</Button>}
      </div>
      <ErrorText error={q.error ?? read.error} />
      {q.data?.length === 0 && <Empty>No notifications yet. You will see assignments, comments and approvals here.</Empty>}
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-soft">
        {q.data?.map((n) => (
          <li key={n.id}>
            <button
              className={cn("w-full px-4 py-3 text-left text-sm hover:bg-slate-50", !n.readAt && "bg-indigo-50/60")}
              onClick={() => { if (!n.readAt) read.mutate({ id: n.id }); if (n.link) router.push(n.link); }}
            >
              <span className={cn(!n.readAt && "font-semibold")}>{n.title}</span>
              {n.body && <span className="block text-slate-500">{n.body}</span>}
              <span className="block text-xs text-slate-400">{new Date(n.createdAt).toLocaleString("en-GB")}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
