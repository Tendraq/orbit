"use client";

import { trpc } from "@/lib/trpc";
import { useWorkspace } from "@/lib/contexts";
import { Empty, ErrorText, Loading } from "@/components/ui/kit";
import { label } from "@/lib/format";

// The audit log, readable: who did what, and when.
export default function ActivityPage() {
  const ws = useWorkspace();
  const q = trpc.workspace.activity.useQuery({ slug: ws.slug, limit: 100 });
  if (q.isLoading) return <Loading />;

  return (
    <div className="max-w-3xl space-y-3">
      <ErrorText error={q.error} />
      {q.data?.length === 0 && <Empty>Nothing has happened yet.</Empty>}
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200/70 bg-white shadow-soft">
        {q.data?.map((a) => (
          <li key={a.id} className="flex items-baseline gap-3 px-4 py-2 text-sm">
            <span className="w-40 shrink-0 text-xs text-slate-400">{new Date(a.createdAt).toLocaleString("en-GB")}</span>
            <span><b>{a.userName}</b> · {label(a.action.replace(/[._]/g, " "))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
