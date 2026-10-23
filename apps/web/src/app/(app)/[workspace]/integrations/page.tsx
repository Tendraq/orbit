"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useWorkspace } from "@/lib/contexts";
import { Badge, Card, Empty, ErrorText, Field, Loading, SectionTitle, Select } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WEBHOOK_EVENTS } from "@/config";
import { cn } from "@/lib/utils";

const when = (d: Date | string) => new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const KIND_LABEL = { SLACK: "Slack", TEAMS: "Microsoft Teams", GENERIC: "Web address" } as const;
const DEFAULT_EVENTS = ["task.completed", "gate.submitted", "gate.approved", "change.submitted", "expense.created"];

const ENDPOINTS: [string, string, string][] = [
  ["GET", "/projects", "List projects"],
  ["GET", "/projects/{id}/tasks", "List tasks (filter with ?status= or ?assigneeEmail=)"],
  ["POST", "/projects/{id}/tasks", "Create a task"],
  ["GET", "/tasks/{id}", "Get one task"],
  ["PATCH", "/tasks/{id}", "Change a task"],
  ["GET", "/projects/{id}/indicators", "Indicators with progress"],
  ["POST", "/indicators/{id}/values", "Record a result (for field-data tools)"],
  ["GET", "/projects/{id}/budget", "Budget summary"],
  ["GET", "/projects/{id}/risks", "Risk register"],
];

export default function IntegrationsPage() {
  const ws = useWorkspace();
  const utils = trpc.useUtils();
  const manage = ws.can("integration:manage");
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const local = origin.includes("localhost") || origin.includes("127.0.0.1");
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (key: string, text: string) => { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1800); };

  // ───── calendar ─────
  const cal = trpc.integration.calendar.get.useQuery();
  const resetCal = trpc.integration.calendar.regenerate.useMutation({ onSuccess: () => utils.integration.calendar.get.invalidate() });
  const [scope, setScope] = useState<"me" | "all">("me");
  const feed = cal.data ? `${origin}/api/calendar/${cal.data.token}.ics${scope === "all" ? "?scope=all" : ""}` : "";

  // ───── alerts ─────
  const hooks = trpc.integration.webhooks.list.useQuery({ workspaceSlug: ws.slug }, { enabled: manage });
  const reloadHooks = () => utils.integration.webhooks.list.invalidate({ workspaceSlug: ws.slug });
  const addHook = trpc.integration.webhooks.create.useMutation({ onSuccess: () => { setName(""); setUrl(""); reloadHooks(); } });
  const updHook = trpc.integration.webhooks.update.useMutation({ onSuccess: reloadHooks });
  const delHook = trpc.integration.webhooks.delete.useMutation({ onSuccess: reloadHooks });
  const testHook = trpc.integration.webhooks.test.useMutation({ onSuccess: reloadHooks });
  const [tested, setTested] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [name, setName] = useState("");
  const [kind, setKind] = useState<keyof typeof KIND_LABEL>("SLACK");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(DEFAULT_EVENTS);

  // ───── API keys ─────
  const keys = trpc.integration.apiKeys.list.useQuery({ workspaceSlug: ws.slug }, { enabled: manage });
  const reloadKeys = () => utils.integration.apiKeys.list.invalidate({ workspaceSlug: ws.slug });
  const addKey = trpc.integration.apiKeys.create.useMutation({ onSuccess: (k) => { setNewKey(k.key); setKeyName(""); reloadKeys(); } });
  const revoke = trpc.integration.apiKeys.revoke.useMutation({ onSuccess: reloadKeys });
  const [keyName, setKeyName] = useState("");
  const [keyScope, setKeyScope] = useState<"READ" | "WRITE">("READ");
  const [newKey, setNewKey] = useState<string | null>(null);

  const projects = trpc.project.list.useQuery({ workspaceSlug: ws.slug });

  const hint: Record<string, string> = {
    SLACK: "In Slack, create an “Incoming Webhook” for the channel you want, then paste its address here.",
    TEAMS: "Microsoft retired the old Teams connectors. In Teams, create a Workflow that starts with “When a Teams webhook request is received” and posts a card to your channel, then paste the address it gives you.",
    GENERIC: "Orbit sends a JSON message to this address and signs it with the secret shown after you save, so your system can check it really came from Orbit.",
  };

  return (
    <div className="max-w-4xl space-y-12">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Integrations</h2>
        <p className="text-sm text-slate-500">Connect Orbit to the calendar, chat, spreadsheets and tools your team already uses.</p>
      </div>

      {/* ───────── import & export ───────── */}
      <section>
        <SectionTitle>Spreadsheets and Microsoft Project</SectionTitle>
        <Card>
          <p className="text-sm text-slate-600">
            Bring a plan in from <b>Excel</b> or <b>Microsoft Project</b>, and take tasks, budgets, indicators, risks and time back out. Open a project and choose its <b>Data</b> tab.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {projects.data?.slice(0, 8).map((p) => (
              <Link key={p.id} href={`/${ws.slug}/projects/${p.id}/data`} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm transition hover:border-brand-300 hover:text-brand-700">{p.name}</Link>
            ))}
            {projects.data?.length === 0 && <span className="text-sm text-slate-500">Create a project first.</span>}
          </div>
        </Card>
      </section>

      {/* ───────── calendar ───────── */}
      <section>
        <SectionTitle>Your calendar</SectionTitle>
        <Card className="space-y-4">
          <p className="text-sm text-slate-600">Subscribe in Outlook, Google Calendar or your phone and your due dates and milestones appear next to your other appointments. This link is private to you.</p>
          <div className="flex gap-2">
            {([["me", "My tasks and milestones"], ["all", "Everything in my organizations"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setScope(k)} className={cn("rounded-lg border px-3 py-1.5 text-sm transition", scope === k ? "border-brand-500 bg-brand-50 font-medium text-brand-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300")}>{l}</button>
            ))}
          </div>
          {cal.isLoading ? <Loading /> : (
            <>
              <div className="flex gap-2">
                <input readOnly value={feed} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs" />
                <Button onClick={() => copy("cal", feed)}>{copied === "cal" ? "Copied!" : "Copy"}</Button>
                <a href={feed.replace(/^https?:/, "webcal:")} className="inline-flex items-center whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">Open in calendar</a>
              </div>
              {local && <p className="text-xs text-amber-700">This address only works on your own computer right now. Calendar apps need a public address, so subscribing works once Orbit is online. Until then, download a one-off calendar file from a project’s Data tab.</p>}
              <details className="text-sm text-slate-600">
                <summary className="cursor-pointer font-medium text-slate-700">How to subscribe</summary>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li><b>Outlook:</b> Add calendar, Subscribe from web, paste the link.</li>
                  <li><b>Google Calendar:</b> Other calendars (+), From URL, paste the link.</li>
                  <li><b>iPhone:</b> Settings, Calendar, Accounts, Add Account, Other, Add Subscribed Calendar.</li>
                </ul>
                <p className="mt-2 text-xs text-slate-500">Calendar apps refresh subscribed calendars on their own schedule, often every few hours, so changes are not instant.</p>
              </details>
              <div className="flex items-center gap-3 text-xs">
                <button className="text-red-600 hover:underline" onClick={() => window.confirm("This stops the old link from working. Continue?") && resetCal.mutate()}>Reset my link</button>
                <span className="text-slate-400">Do this if you shared the link by mistake.</span>
              </div>
            </>
          )}
        </Card>
      </section>

      {/* ───────── alerts ───────── */}
      <section>
        <SectionTitle>Chat alerts and webhooks</SectionTitle>
        {!manage ? <Empty>Only owners and admins can set up alerts.</Empty> : (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Send a message to Slack, Microsoft Teams, or any system when something happens, such as an approval waiting or a task completed.</p>
            <ErrorText error={hooks.error ?? addHook.error ?? updHook.error ?? delHook.error ?? testHook.error} />

            {hooks.data?.map((h) => (
              <Card key={h.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{h.name}</span>
                  <Badge tone="indigo">{KIND_LABEL[h.kind as keyof typeof KIND_LABEL]}</Badge>
                  {!h.active && <Badge tone="amber">Paused</Badge>}
                  <span className="text-xs text-slate-400">{h.url}</span>
                  <span className="ml-auto flex gap-3 text-xs">
                    <button className="text-brand-600 hover:underline" onClick={async () => { const r = await testHook.mutateAsync({ workspaceSlug: ws.slug, webhookId: h.id }); setTested((t) => ({ ...t, [h.id]: { ok: r.ok, text: r.ok ? "Delivered. Check your channel." : r.error ?? "Failed" } })); }}>Send test</button>
                    <button className="text-slate-600 hover:underline" onClick={() => updHook.mutate({ workspaceSlug: ws.slug, webhookId: h.id, active: !h.active })}>{h.active ? "Pause" : "Resume"}</button>
                    <button className="text-red-600 hover:underline" onClick={() => window.confirm("Delete this connection?") && delHook.mutate({ workspaceSlug: ws.slug, webhookId: h.id })}>Delete</button>
                  </span>
                </div>
                {tested[h.id] && <p className={cn("mt-2 text-sm", tested[h.id].ok ? "text-emerald-700" : "text-red-600")}>{tested[h.id].text}</p>}
                <p className="mt-2 text-xs text-slate-500">Sends: {h.events.map((e) => WEBHOOK_EVENTS.find((x) => x.key === e)?.label ?? e).join(", ")}</p>
                {h.secret && (
                  <p className="mt-2 text-xs text-slate-500">Signing secret: <code className="rounded bg-slate-100 px-1.5 py-0.5">{h.secret}</code>{" "}
                    <button className="text-brand-600 hover:underline" onClick={() => copy(`s${h.id}`, h.secret!)}>{copied === `s${h.id}` ? "Copied!" : "Copy"}</button>
                    <span className="block">Every message carries an <code>X-Orbit-Signature</code> header: a SHA-256 HMAC of the body made with this secret.</span>
                  </p>
                )}
                {h.deliveries.length > 0 && (
                  <ul className="mt-3 space-y-0.5 border-t border-slate-100 pt-2 text-xs text-slate-500">
                    {h.deliveries.map((d) => (
                      <li key={d.id}><span className={d.ok ? "text-emerald-600" : "text-red-600"}>{d.ok ? "✓" : "✗"}</span> {when(d.createdAt)} · {d.event}{d.error ? ` · ${d.error}` : ""}</li>
                    ))}
                  </ul>
                )}
              </Card>
            ))}

            <Card>
              <h3 className="mb-3 font-semibold">Add a connection</h3>
              <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); addHook.mutate({ workspaceSlug: ws.slug, name: name.trim(), kind, url: url.trim(), events }); }}>
                <div className="grid gap-3 md:grid-cols-3">
                  <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Programme team channel" /></Field>
                  <Field label="Send to">
                    <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
                      {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </Select>
                  </Field>
                  <Field label="Address (https://…)"><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></Field>
                </div>
                <p className="text-xs text-slate-500">{hint[kind]}</p>
                <div>
                  <p className="mb-1.5 text-xs font-medium text-slate-600">What should it tell you about?</p>
                  <div className="grid gap-1.5 md:grid-cols-2">
                    {WEBHOOK_EVENTS.map((ev) => (
                      <label key={ev.key} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={events.includes(ev.key)} onChange={(e) => setEvents(e.target.checked ? [...events, ev.key] : events.filter((x) => x !== ev.key))} />
                        {ev.label}
                      </label>
                    ))}
                  </div>
                </div>
                <Button type="submit" disabled={name.trim().length < 2 || url.length < 8 || events.length === 0 || addHook.isPending}>Save connection</Button>
              </form>
            </Card>
          </div>
        )}
      </section>

      {/* ───────── API ───────── */}
      <section>
        <SectionTitle>API access</SectionTitle>
        {!manage ? <Empty>Only owners and admins can manage API keys.</Empty> : (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Let other software read and update your data. Zapier, Make, Power Automate, KoboToolbox hooks and your own scripts can all use it.</p>
            <ErrorText error={keys.error ?? addKey.error ?? revoke.error} />

            {newKey && (
              <Card className="border-emerald-300 bg-emerald-50">
                <p className="text-sm font-semibold text-emerald-800">Your new key. Copy it now: it will never be shown again.</p>
                <div className="mt-2 flex gap-2">
                  <input readOnly value={newKey} className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 font-mono text-xs" />
                  <Button onClick={() => copy("key", newKey)}>{copied === "key" ? "Copied!" : "Copy"}</Button>
                  <Button variant="secondary" onClick={() => setNewKey(null)}>Done</Button>
                </div>
              </Card>
            )}

            <div className="overflow-x-auto rounded-xl border border-slate-200/70 bg-white shadow-soft">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-3">Name</th><th className="p-3">Key starts with</th><th className="p-3">Access</th><th className="p-3">Last used</th><th /></tr></thead>
                <tbody>
                  {keys.data?.map((k) => (
                    <tr key={k.id} className="border-t border-slate-100">
                      <td className="p-3 font-medium">{k.name}</td>
                      <td className="p-3 font-mono text-xs">{k.prefix}…</td>
                      <td className="p-3">{k.revokedAt ? <Badge tone="red">Revoked</Badge> : <Badge tone={k.scope === "WRITE" ? "amber" : "green"}>{k.scope === "WRITE" ? "Read and write" : "Read only"}</Badge>}</td>
                      <td className="p-3 text-xs text-slate-500">{k.lastUsedAt ? when(k.lastUsedAt) : "Never"}</td>
                      <td className="p-3 text-right">{!k.revokedAt && <button className="text-xs text-red-600 hover:underline" onClick={() => window.confirm("Revoke this key? Anything using it will stop working.") && revoke.mutate({ workspaceSlug: ws.slug, keyId: k.id })}>Revoke</button>}</td>
                    </tr>
                  ))}
                  {keys.data?.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-500">No keys yet.</td></tr>}
                </tbody>
              </table>
            </div>

            <Card>
              <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); addKey.mutate({ workspaceSlug: ws.slug, name: keyName.trim(), scope: keyScope }); }}>
                <Field label="Key name" className="min-w-[220px] flex-1"><Input value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="e.g. Kobo sync" /></Field>
                <Field label="Access"><Select value={keyScope} onChange={(e) => setKeyScope(e.target.value as typeof keyScope)}><option value="READ">Read only</option><option value="WRITE">Read and write</option></Select></Field>
                <Button type="submit" disabled={keyName.trim().length < 2 || addKey.isPending}>Create key</Button>
              </form>
            </Card>

            <Card>
              <h3 className="mb-2 font-semibold">Getting started</h3>
              <p className="mb-2 text-sm text-slate-600">Base address: <code className="rounded bg-slate-100 px-1.5 py-0.5">{origin}/api/v1</code>. Send your key in the <code>Authorization</code> header.</p>
              <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">{`curl ${origin}/api/v1/projects \\
  -H "Authorization: Bearer orbit_YOUR_KEY"

curl -X POST ${origin}/api/v1/projects/PROJECT_ID/tasks \\
  -H "Authorization: Bearer orbit_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Visit village 4","dueDate":"2026-03-20","priority":"HIGH"}'`}</pre>
              <table className="mt-4 w-full text-sm">
                <tbody>
                  {ENDPOINTS.map(([m, p, d]) => (
                    <tr key={m + p} className="border-t border-slate-100">
                      <td className="w-16 py-1.5"><span className={cn("rounded px-1.5 py-0.5 text-[11px] font-semibold", m === "GET" ? "bg-sky-50 text-sky-700" : "bg-amber-50 text-amber-800")}>{m}</span></td>
                      <td className="py-1.5 font-mono text-xs">{p}</td>
                      <td className="py-1.5 text-slate-600">{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-slate-500">
                Machine-readable description for Zapier, Make, Power Automate and Postman:{" "}
                <a className="text-brand-600 hover:underline" href="/api/v1/openapi.json" target="_blank" rel="noreferrer">/api/v1/openapi.json</a>. Limit: 120 requests a minute per key.
              </p>
            </Card>
          </div>
        )}
      </section>
    </div>
  );
}
