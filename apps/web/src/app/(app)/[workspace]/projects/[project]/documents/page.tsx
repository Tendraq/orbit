"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useProject } from "@/lib/contexts";
import { Badge, Empty, ErrorText, Loading, Select, Textarea } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const KINDS = ["NOTE", "MEETING", "DECISION", "CHARTER", "OTHER"] as const;

// Charters, meeting notes and decision logs, kept next to the work.
export default function DocumentsPage() {
  const { project, can } = useProject();
  const projectId = project.id;
  const utils = trpc.useUtils();
  const list = trpc.document.list.useQuery({ projectId });
  const [selected, setSelected] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("NOTE");
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(true);

  const doc = list.data?.find((d) => d.id === selected);
  // load the chosen document into the editor
  useEffect(() => {
    if (doc) { setTitle(doc.title); setKind(doc.kind); setContent(doc.content); setSaved(true); }
  }, [doc?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const reload = () => utils.document.list.invalidate({ projectId });
  const create = trpc.document.create.useMutation({ onSuccess: (d) => { reload(); setSelected(d.id); } });
  const update = trpc.document.update.useMutation({ onSuccess: () => { reload(); setSaved(true); } });
  const del = trpc.document.delete.useMutation({ onSuccess: () => { setSelected(null); reload(); } });

  if (list.isLoading) return <Loading />;
  const editable = can("document:manage");

  return (
    <div className="grid gap-6 md:grid-cols-[260px_1fr]">
      <div className="space-y-2">
        {editable && (
          <Button className="w-full" onClick={() => create.mutate({ projectId, title: "Untitled", kind: "NOTE", content: "" })}>
            + New document
          </Button>
        )}
        {list.data?.length === 0 && <Empty>No documents yet.</Empty>}
        <ul className="space-y-1">
          {list.data?.map((d) => (
            <li key={d.id}>
              <button
                onClick={() => setSelected(d.id)}
                className={cn("w-full rounded-lg border p-2 text-left text-sm hover:border-brand-500", selected === d.id ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-white")}
              >
                <span className="block truncate font-medium">{d.title}</span>
                <span className="flex items-center gap-2 text-xs text-slate-500"><Badge value={d.kind} /> {fmtDate(d.updatedAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <ErrorText error={create.error ?? update.error ?? del.error} />
        {!doc ? <Empty>Select a document, or create a new one.</Empty> : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input value={title} disabled={!editable} onChange={(e) => { setTitle(e.target.value); setSaved(false); }} className="text-lg font-semibold" />
              <Select className="w-36" value={kind} disabled={!editable} onChange={(e) => { setKind(e.target.value as typeof kind); setSaved(false); }}>
                {KINDS.map((k) => <option key={k} value={k}>{k.toLowerCase()}</option>)}
              </Select>
            </div>
            <Textarea rows={18} value={content} disabled={!editable} placeholder="Write here…" className="font-mono"
              onChange={(e) => { setContent(e.target.value); setSaved(false); }} />
            {editable && (
              <div className="flex items-center gap-2">
                <Button disabled={saved || update.isPending} onClick={() => update.mutate({ documentId: doc.id, title, kind, content })}>Save</Button>
                <Button variant="danger" onClick={() => window.confirm("Delete this document?") && del.mutate({ documentId: doc.id })}>Delete</Button>
                <span className="text-xs text-slate-500">{saved ? "Saved" : "Unsaved changes"}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
