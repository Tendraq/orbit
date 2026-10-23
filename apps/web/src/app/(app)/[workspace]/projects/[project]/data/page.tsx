"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useProject } from "@/lib/contexts";
import { Badge, Card, ErrorText, SectionTitle, Select } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { STATUS_LABELS } from "@/config";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Format = "csv" | "xlsx" | "msproject";
type Loaded = { name: string; format: Format; data: string };

const MAX_BYTES = 3 * 1024 * 1024;

const readFile = (file: File, format: Format): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("The file could not be read."));
    r.onload = () => resolve(format === "xlsx" ? String(r.result).split(",")[1] ?? "" : String(r.result));
    if (format === "xlsx") r.readAsDataURL(file); else r.readAsText(file);
  });

function detect(name: string): Format | { error: string } {
  const ext = name.toLowerCase().split(".").pop();
  if (ext === "csv" || ext === "txt") return "csv";
  if (ext === "xlsx" || ext === "xlsm") return "xlsx";
  if (ext === "xml") return "msproject";
  if (ext === "xls") return { error: "Old Excel files (.xls) are not supported. In Excel choose File, Save As, and pick “Excel Workbook (.xlsx)” or “CSV UTF-8”." };
  if (ext === "mpp") return { error: "Microsoft Project’s own .mpp format cannot be read. In Project choose File, Save As, and pick “XML Format”." };
  return { error: "Use a .xlsx, .csv or Microsoft Project .xml file." };
}

export default function DataPage() {
  const { project, can, has } = useProject();
  const projectId = project.id;
  const utils = trpc.useUtils();
  const allowed = can("task:create");

  const [file, setFile] = useState<Loaded | null>(null);
  const [dayFirst, setDayFirst] = useState(true);
  const [skipExisting, setSkipExisting] = useState(true);
  const [milestones, setMilestones] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const preview = trpc.exchange.preview.useMutation();
  const commit = trpc.exchange.commit.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate({ projectId });
      utils.task.listAll.invalidate({ projectId });
      utils.milestone.list.invalidate({ projectId });
      utils.report.projectDashboard.invalidate({ projectId });
    },
  });

  const run = (f: Loaded, opts: { dayFirst: boolean; skipExisting: boolean }) =>
    preview.mutate({ projectId, format: f.format, data: f.data, dayFirst: opts.dayFirst, skipExisting: opts.skipExisting });

  async function choose(f: File | undefined) {
    setProblem(null); commit.reset(); preview.reset(); setFile(null);
    if (!f) return;
    const format = detect(f.name);
    if (typeof format !== "string") return setProblem(format.error);
    if (f.size > MAX_BYTES) return setProblem("This file is larger than 3 MB. Split it into smaller files.");
    try {
      const loaded = { name: f.name, format, data: await readFile(f, format) };
      setFile(loaded);
      run(loaded, { dayFirst, skipExisting });
    } catch (e) { setProblem(e instanceof Error ? e.message : "The file could not be read."); }
  }

  const reset = () => { setFile(null); setProblem(null); preview.reset(); commit.reset(); if (input.current) input.current.value = ""; };
  const p = preview.data;
  const result = commit.data;
  const willAdd = p ? p.counts.tasks + p.counts.subtasks - p.counts.alreadyThere : 0;
  const q = `?projectId=${projectId}`;

  const downloads: { kind: string; title: string; text: string; type: string; show: boolean }[] = [
    { kind: "tasks", title: "Tasks", text: "Every task with status, dates, owner, labels and links.", type: "Excel / CSV", show: true },
    { kind: "msproject", title: "Microsoft Project plan", text: "Tasks, subtasks, dates, dependencies and milestones.", type: "XML", show: true },
    { kind: "ics", title: "Calendar file", text: "Due dates and milestones for any calendar app (a snapshot).", type: ".ics", show: true },
    { kind: "budget", title: "Budget", text: "Planned, spent and remaining by budget line.", type: "Excel / CSV", show: has("budget") },
    { kind: "expenses", title: "Expenses", text: "Every expense with its status.", type: "Excel / CSV", show: has("budget") },
    { kind: "indicators", title: "Indicator results", text: "Baselines, targets and every recorded value.", type: "Excel / CSV", show: has("ngo") },
    { kind: "risks", title: "Risk register", text: "Scores, status and planned responses.", type: "Excel / CSV", show: has("risks") },
    { kind: "time", title: "Time entries", text: "Hours by person and task, billable or not.", type: "Excel / CSV", show: has("time") },
  ];

  return (
    <div className="space-y-10">
      {/* ───────── import ───────── */}
      <section>
        <SectionTitle>Import tasks</SectionTitle>
        {!allowed ? (
          <Card className="text-sm text-slate-600">You can view this project, but only members, admins and owners can import.</Card>
        ) : result ? (
          <Card className="space-y-3 border-emerald-300 bg-emerald-50">
            <p className="text-lg font-semibold text-emerald-800">Import finished</p>
            <ul className="text-sm text-emerald-900">
              <li>{result.created} task(s) added{result.skipped ? `, ${result.skipped} skipped because they already exist` : ""}</li>
              {result.milestones > 0 && <li>{result.milestones} milestone(s) added</li>}
              {result.dependencies > 0 && <li>{result.dependencies} dependency link(s) added</li>}
              {result.labelsCreated > 0 && <li>{result.labelsCreated} new label(s) created</li>}
            </ul>
            {result.unmatchedAssignees.length > 0 && (
              <p className="text-sm text-amber-800">These people are not members of the organization, so their tasks are unassigned: {result.unmatchedAssignees.join(", ")}.</p>
            )}
            <div className="flex gap-2">
              <Link href={`/${project.workspace.slug}/projects/${projectId}/list`} className="rounded-lg bg-gradient-to-b from-brand-500 to-brand-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm">See the tasks</Link>
              <Button variant="secondary" onClick={reset}>Import another file</Button>
            </div>
          </Card>
        ) : (
          <Card className="space-y-5">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); choose(e.dataTransfer.files[0]); }}
              className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-8 text-center"
            >
              <p className="font-medium">Drop a file here, or choose one</p>
              <p className="mt-1 text-sm text-slate-500">Excel (.xlsx), CSV, or a Microsoft Project XML file</p>
              <input ref={input} type="file" accept=".xlsx,.xlsm,.csv,.txt,.xml" className="mt-4 text-sm" onChange={(e) => choose(e.target.files?.[0])} />
              <p className="mt-3 text-xs text-slate-500">
                New to this? <a className="text-brand-600 hover:underline" href="/api/import-template">Download a ready-made template</a>.
                From Microsoft Project use File, Save As, XML Format.
              </p>
            </div>

            {problem && <ErrorText error={{ message: problem }} />}
            {preview.isPending && <p className="text-sm text-slate-500">Reading {file?.name}…</p>}
            <ErrorText error={preview.error ?? commit.error} />

            {p && file && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{file.name}</span>
                  <Badge tone="indigo">{p.counts.tasks} tasks</Badge>
                  {p.counts.subtasks > 0 && <Badge tone="indigo">{p.counts.subtasks} subtasks</Badge>}
                  {p.counts.dependencies > 0 && <Badge tone="slate">{p.counts.dependencies} links</Badge>}
                  {p.counts.milestones > 0 && <Badge tone="slate">{p.counts.milestones} milestones</Badge>}
                  {p.counts.alreadyThere > 0 && <Badge tone="amber">{p.counts.alreadyThere} already here</Badge>}
                </div>

                {p.columns.length > 0 && <p className="text-xs text-slate-500">Columns we recognised: {p.columns.join(", ")}</p>}

                <div className="grid gap-3 md:grid-cols-3">
                  {file.format === "csv" && (
                    <label className="text-sm">
                      <span className="mb-1 block text-xs font-medium text-slate-600">A date like 03/04/2026 means</span>
                      <Select value={dayFirst ? "d" : "m"} onChange={(e) => { const v = e.target.value === "d"; setDayFirst(v); run(file, { dayFirst: v, skipExisting }); }}>
                        <option value="d">3 April (day first)</option>
                        <option value="m">4 March (month first)</option>
                      </Select>
                    </label>
                  )}
                  <label className="flex items-center gap-2 self-end text-sm">
                    <input type="checkbox" checked={skipExisting} onChange={(e) => { setSkipExisting(e.target.checked); run(file, { dayFirst, skipExisting: e.target.checked }); }} />
                    Skip tasks that already exist (same title)
                  </label>
                  {p.counts.milestones > 0 && (
                    <label className="flex items-center gap-2 self-end text-sm">
                      <input type="checkbox" checked={milestones} onChange={(e) => setMilestones(e.target.checked)} /> Import milestones
                    </label>
                  )}
                </div>

                {p.warnings.length > 0 && (
                  <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
                    <p className="font-medium">Please check</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5">{p.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
                    {p.moreWarnings > 0 && <p className="mt-1 text-xs">…and {p.moreWarnings} more.</p>}
                  </div>
                )}
                {p.unmatchedAssignees.length > 0 && (
                  <p className="text-sm text-amber-800">These people are not members yet, so their tasks will be unassigned: {p.unmatchedAssignees.join(", ")}.</p>
                )}

                {p.sample.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-2">Title</th><th className="p-2">Status</th><th className="p-2">Priority</th><th className="p-2">Due</th><th className="p-2">Person</th></tr></thead>
                      <tbody>
                        {p.sample.map((t, i) => (
                          <tr key={i} className="border-t border-slate-100">
                            <td className={cn("p-2", t.parent && "pl-6 text-slate-600")}>{t.parent && "↳ "}{t.title}</td>
                            <td className="p-2">{STATUS_LABELS[t.status]}</td>
                            <td className="p-2">{t.priority.toLowerCase()}</td>
                            <td className="p-2">{t.dueDate ? fmtDate(t.dueDate) : "—"}</td>
                            <td className="p-2 text-slate-500">{t.assignee ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="bg-slate-50 px-3 py-1.5 text-xs text-slate-500">Showing the first {p.sample.length} tasks.</p>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Button
                    disabled={commit.isPending || (willAdd <= 0 && !(milestones && p.counts.milestones > 0))}
                    onClick={() => commit.mutate({ projectId, format: file.format, data: file.data, dayFirst, skipExisting, importMilestones: milestones })}
                  >
                    {commit.isPending ? "Importing…" : `Import ${Math.max(0, willAdd)} task(s)`}
                  </Button>
                  <Button variant="ghost" onClick={reset}>Cancel</Button>
                  <span className="text-xs text-slate-500">Nothing is saved until you click Import.</span>
                </div>
              </div>
            )}
          </Card>
        )}
      </section>

      {/* ───────── export ───────── */}
      <section>
        <SectionTitle>Download</SectionTitle>
        <div className="grid gap-3 md:grid-cols-2">
          {downloads.filter((d) => d.show).map((d) => (
            <a key={d.kind} href={`/api/export/${d.kind}${q}`} className="group">
              <Card className="flex h-full items-start justify-between gap-3 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift">
                <div>
                  <p className="font-medium">{d.title}</p>
                  <p className="text-sm text-slate-500">{d.text}</p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 group-hover:bg-brand-50 group-hover:text-brand-700">{d.type}</span>
              </Card>
            </a>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          CSV files open directly in Excel. The Microsoft Project file has dates and dependencies; Project re-schedules working days when it opens, and people assigned to a task appear in its notes.
        </p>
      </section>
    </div>
  );
}
