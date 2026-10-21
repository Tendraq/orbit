"use client";

import { useEffect, useState } from "react";
import { Card, SectionTitle } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/kit";

const TEMPLATES = [
  { who: "A colleague or peer", text: "I run my projects in Orbit now: stage approvals, budgets, risks and reports in one place instead of spreadsheets and email. Have a look: {link}" },
  { who: "A donor, partner or board member", text: "We now track our programmes in Orbit, so you can see progress, spending and results in one place, any time. Here is the link: {link}" },
  { who: "A manager or director", text: "Orbit would give us one clear view of every project, what needs approval, and where the money is going. Worth five minutes: {link}" },
];

// Helps happy users tell the right people about Orbit.
export default function RecommendPage() {
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [texts, setTexts] = useState<string[]>(TEMPLATES.map((t) => t.text));
  useEffect(() => setLink(window.location.origin), []);

  const filled = (t: string) => t.replace("{link}", link);
  const copy = async (key: string, value: string) => { await navigator.clipboard.writeText(value); setCopied(key); setTimeout(() => setCopied(null), 1800); };
  const local = link.includes("localhost");

  return (
    <div className="max-w-3xl space-y-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Share Orbit</h1>
        <p className="mt-1 text-slate-600">The best recommendation is a personal one. Pick a message, make it yours, and send it to someone who would benefit.</p>
      </div>

      <Card>
        <SectionTitle>Your link</SectionTitle>
        <div className="flex gap-2">
          <input readOnly value={link} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
          <Button onClick={() => copy("link", link)}>{copied === "link" ? "Copied!" : "Copy"}</Button>
        </div>
        {local && <p className="mt-2 text-xs text-amber-700">This link only works on your computer for now. Once Orbit is online at a real web address, this page will show that address instead.</p>}
      </Card>

      <section className="space-y-4">
        <SectionTitle>Ready-made messages</SectionTitle>
        {TEMPLATES.map((t, i) => {
          const msg = filled(texts[i]);
          return (
            <Card key={t.who}>
              <p className="mb-2 text-sm font-semibold">For {t.who.toLowerCase()}</p>
              <Textarea rows={3} value={texts[i]} onChange={(e) => setTexts((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))} />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => copy(`t${i}`, msg)}>{copied === `t${i}` ? "Copied!" : "Copy message"}</Button>
                <a className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(msg)}`}>WhatsApp</a>
                <a className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50" href={`mailto:?subject=${encodeURIComponent("Orbit for our projects")}&body=${encodeURIComponent(msg)}`}>Email</a>
                <a className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50" target="_blank" rel="noreferrer" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`}>LinkedIn</a>
              </div>
            </Card>
          );
        })}
      </section>

      <Card>
        <SectionTitle>Tell us what would make it better</SectionTitle>
        <p className="mb-3 text-sm text-slate-600">Missing something? Suggestions from real users decide what gets built next.</p>
        <a className="inline-flex items-center rounded-lg bg-gradient-to-b from-brand-500 to-brand-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm" href="mailto:?subject=Orbit%20suggestion">Send a suggestion</a>
      </Card>
    </div>
  );
}
