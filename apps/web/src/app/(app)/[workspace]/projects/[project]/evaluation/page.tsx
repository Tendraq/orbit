"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useProject } from "@/lib/contexts";
import { Badge, Card, Empty, ErrorText, Loading, SectionTitle, Select, Textarea } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { fmtDate, fromInput } from "@/lib/format";

const KINDS = [
  { key: "WENT_WELL", title: "What went well" },
  { key: "TO_IMPROVE", title: "What to improve" },
  { key: "RECOMMENDATION", title: "Recommendations" },
] as const;

export default function EvaluationPage() {
  const { project, can } = useProject();
  const projectId = project.id;
  const utils = trpc.useUtils();
  const lessons = trpc.evaluation.lessons.list.useQuery({ projectId });
  const evals = trpc.evaluation.evaluations.list.useQuery({ projectId });

  const reloadL = () => utils.evaluation.lessons.list.invalidate({ projectId });
  const reloadE = () => utils.evaluation.evaluations.list.invalidate({ projectId });
  const addLesson = trpc.evaluation.lessons.create.useMutation({ onSuccess: () => { setLTitle(""); setLBody(""); reloadL(); } });
  const delLesson = trpc.evaluation.lessons.delete.useMutation({ onSuccess: reloadL });
  const addEval = trpc.evaluation.evaluations.create.useMutation({ onSuccess: () => { setETitle(""); setESummary(""); setEScore(""); reloadE(); } });
  const delEval = trpc.evaluation.evaluations.delete.useMutation({ onSuccess: reloadE });

  const [lKind, setLKind] = useState<(typeof KINDS)[number]["key"]>("WENT_WELL");
  const [lTitle, setLTitle] = useState("");
  const [lBody, setLBody] = useState("");
  const [eType, setEType] = useState<"MIDTERM" | "FINAL" | "OTHER">("MIDTERM");
  const [eTitle, setETitle] = useState("");
  const [eSummary, setESummary] = useState("");
  const [eScore, setEScore] = useState("");
  const [eDate, setEDate] = useState("");

  if (lessons.isLoading) return <Loading />;
  const canEdit = can("lesson:manage");

  return (
    <div className="space-y-10">
      <ErrorText error={addLesson.error ?? delLesson.error ?? addEval.error ?? delEval.error} />

      <section>
        <SectionTitle>Evaluations</SectionTitle>
        {evals.data?.length === 0 && <Empty>No evaluations recorded yet (midterm, final, or other reviews).</Empty>}
        <ul className="space-y-2">
          {evals.data?.map((e) => (
            <Card key={e.id}>
              <div className="flex items-center gap-2">
                <Badge tone="indigo">{e.type.toLowerCase()}</Badge>
                <span className="font-semibold">{e.title}</span>
                {e.score !== null && <span className="text-sm text-slate-600">Score {e.score}/100</span>}
                <span className="ml-auto text-xs text-slate-500">{fmtDate(e.date)}</span>
                {canEdit && <button className="text-xs text-red-600" onClick={() => delEval.mutate({ evaluationId: e.id })}>Delete</button>}
              </div>
              {e.summary && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{e.summary}</p>}
            </Card>
          ))}
        </ul>
        {canEdit && (
          <form className="mt-3 grid gap-2 rounded-xl bg-slate-100/70 p-3 md:grid-cols-4"
            onSubmit={(ev) => { ev.preventDefault(); if (eTitle.trim().length >= 2) addEval.mutate({ projectId, type: eType, title: eTitle.trim(), summary: eSummary || undefined, score: eScore === "" ? null : Number(eScore), date: fromInput(eDate) ?? new Date() }); }}>
            <Select value={eType} onChange={(e) => setEType(e.target.value as typeof eType)}><option value="MIDTERM">Midterm</option><option value="FINAL">Final</option><option value="OTHER">Other</option></Select>
            <Input className="md:col-span-2" placeholder="Title" value={eTitle} onChange={(e) => setETitle(e.target.value)} />
            <Input type="number" min={0} max={100} placeholder="Score 0-100 (optional)" value={eScore} onChange={(e) => setEScore(e.target.value)} />
            <Textarea className="md:col-span-3" placeholder="Summary of findings" value={eSummary} onChange={(e) => setESummary(e.target.value)} />
            <div className="space-y-2"><DateInput value={eDate} onChange={(e) => setEDate(e.target.value)} /><Button type="submit" disabled={eTitle.trim().length < 2 || addEval.isPending}>Add evaluation</Button></div>
          </form>
        )}
      </section>

      <section>
        <SectionTitle>Lessons learned</SectionTitle>
        <div className="grid gap-3 md:grid-cols-3">
          {KINDS.map((k) => (
            <Card key={k.key}>
              <h3 className="mb-2 font-semibold">{k.title}</h3>
              <ul className="space-y-2 text-sm">
                {lessons.data?.filter((l) => l.kind === k.key).map((l) => (
                  <li key={l.id} className="rounded border border-slate-100 p-2">
                    <div className="flex justify-between gap-2"><span className="font-medium">{l.title}</span>
                      {canEdit && <button className="text-xs text-red-600" onClick={() => delLesson.mutate({ lessonId: l.id })}>✕</button>}
                    </div>
                    {l.body && <p className="text-slate-600">{l.body}</p>}
                  </li>
                ))}
                {lessons.data?.filter((l) => l.kind === k.key).length === 0 && <li className="text-slate-400">Nothing yet</li>}
              </ul>
            </Card>
          ))}
        </div>
        {canEdit && (
          <form className="mt-3 flex flex-wrap gap-2 rounded-xl bg-slate-100/70 p-3"
            onSubmit={(e) => { e.preventDefault(); if (lTitle.trim().length >= 2) addLesson.mutate({ projectId, kind: lKind, title: lTitle.trim(), body: lBody || undefined }); }}>
            <Select className="w-48" value={lKind} onChange={(e) => setLKind(e.target.value as typeof lKind)}>{KINDS.map((k) => <option key={k.key} value={k.key}>{k.title}</option>)}</Select>
            <Input className="min-w-[200px] flex-1" placeholder="Lesson" value={lTitle} onChange={(e) => setLTitle(e.target.value)} />
            <Input className="min-w-[200px] flex-1" placeholder="Details (optional)" value={lBody} onChange={(e) => setLBody(e.target.value)} />
            <Button type="submit" disabled={lTitle.trim().length < 2 || addLesson.isPending}>Add lesson</Button>
          </form>
        )}
      </section>
    </div>
  );
}
