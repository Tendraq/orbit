import { createHmac, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import type { PrismaClient, Webhook } from "@orbit/db";
import { assertPublicUrl, isPrivateAddress } from "./safe-url";

type Data = Record<string, unknown>;
export type Envelope = {
  id: string; event: string; createdAt: string;
  workspace: { id: string; slug: string; name: string };
  data: Data;
};

const appUrl = () => (process.env.APP_URL ?? "").replace(/\/$/, "");

/** One readable sentence for chat apps. */
export function eventLine(event: string, d: Data, bold: (s: string) => string): string {
  const s = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : "");
  const who = s("by") ? ` by ${s("by")}` : "";
  const where = s("project") ? ` (${s("project")})` : "";
  const money = typeof d.amount === "number" ? ` ${d.amount} ${s("currency")}`.trimEnd() : "";
  switch (event) {
    case "task.created": return `New task: ${bold(s("title"))}${where}${who}`;
    case "task.completed": return `Task completed: ${bold(s("title"))}${where}${who}`;
    case "task.updated": return `Task changed: ${bold(s("title"))}${where}${who}`;
    case "comment.created": return `New comment on ${bold(s("title"))}${where}${who}: ${s("note")}`;
    case "gate.submitted": return `Waiting for approval: ${bold(s("project"))}, ready to leave ${s("phase")}${who}`;
    case "gate.approved": return `Stage gate approved: ${bold(s("project"))}, finished ${s("phase")}${who}`;
    case "gate.rejected": return `Stage gate sent back: ${bold(s("project"))} (${s("phase")})${who}${s("note") ? `. ${s("note")}` : ""}`;
    case "change.submitted": return `Change request to review: ${bold(s("title"))}${where}${who}`;
    case "change.approved": return `Change request approved: ${bold(s("title"))}${where}${who}`;
    case "change.rejected": return `Change request rejected: ${bold(s("title"))}${where}${who}`;
    case "expense.created": return `Expense recorded: ${bold(s("title"))}${money ? ` (${money.trim()})` : ""}${where}${who}`;
    case "expense.approved": return `Expense approved: ${bold(s("title"))}${money ? ` (${money.trim()})` : ""}${where}${who}`;
    case "expense.rejected": return `Expense rejected: ${bold(s("title"))}${money ? ` (${money.trim()})` : ""}${where}${who}`;
    case "report.submitted": return `Donor report submitted: ${bold(s("title"))}${where}${who}`;
    case "import.completed": return `Data imported into ${bold(s("project"))}: ${s("note")}${who}`;
    case "webhook.test": return "Test message from Orbit. Your connection works.";
    default: return `${event}${where}`;
  }
}

export function buildBody(hook: Webhook, env: Envelope): { body: string; headers: Record<string, string> } {
  const link = typeof env.data.path === "string" && appUrl() ? `${appUrl()}${env.data.path}` : "";
  const headers: Record<string, string> = { "Content-Type": "application/json", "User-Agent": "Orbit-Webhooks/1.0" };

  if (hook.kind === "SLACK") {
    const line = eventLine(env.event, env.data, (t) => `*${t}*`) + (link ? `\n<${link}|Open in Orbit>` : "");
    return { body: JSON.stringify({ text: line }), headers };
  }
  if (hook.kind === "TEAMS") {
    // Teams "Workflows" webhooks take an Adaptive Card wrapped in a message
    const line = eventLine(env.event, env.data, (t) => `**${t}**`);
    const card = {
      type: "message",
      attachments: [{
        contentType: "application/vnd.microsoft.card.adaptive", contentUrl: null,
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json", type: "AdaptiveCard", version: "1.4",
          body: [{ type: "TextBlock", text: line, wrap: true }],
          ...(link ? { actions: [{ type: "Action.OpenUrl", title: "Open in Orbit", url: link }] } : {}),
        },
      }],
    };
    return { body: JSON.stringify(card), headers };
  }
  const body = JSON.stringify(env);
  headers["X-Orbit-Event"] = env.event;
  headers["X-Orbit-Delivery"] = env.id;
  headers["X-Orbit-Signature"] = "sha256=" + createHmac("sha256", hook.secret).update(body).digest("hex");
  return { body, headers };
}

async function assertResolvesPublic(host: string) {
  const bare = host.replace(/^\[|\]$/g, "");
  const addrs = await lookup(bare, { all: true });
  if (addrs.length === 0 || addrs.some((a) => isPrivateAddress(a.address))) {
    throw new Error("That address points to a private network, which is not allowed.");
  }
}

/** Sends one event to one webhook and records the result. Never throws. */
export async function deliver(db: PrismaClient, hook: Webhook, env: Envelope) {
  const started = Date.now();
  let status: number | undefined;
  let error: string | undefined;
  try {
    const url = assertPublicUrl(hook.url);
    await assertResolvesPublic(url.hostname);
    const { body, headers } = buildBody(hook, env);
    const res = await fetch(url, { method: "POST", headers, body, redirect: "manual", signal: AbortSignal.timeout(5000) });
    status = res.status;
    if (!res.ok) error = `The other side answered with status ${res.status}.`;
  } catch (e) {
    error = e instanceof Error ? (e.name === "TimeoutError" ? "No answer within 5 seconds." : e.message) : "Delivery failed.";
  }
  try {
    await db.webhookDelivery.create({
      data: { webhookId: hook.id, event: env.event, ok: !error, statusCode: status, error: error?.slice(0, 300), durationMs: Date.now() - started },
    });
    const old = await db.webhookDelivery.findMany({ where: { webhookId: hook.id }, orderBy: { createdAt: "desc" }, skip: 50, take: 1, select: { createdAt: true } });
    if (old[0]) await db.webhookDelivery.deleteMany({ where: { webhookId: hook.id, createdAt: { lte: old[0].createdAt } } });
  } catch { /* logging must never break delivery */ }
  return { ok: !error, status, error };
}

export async function envelope(db: PrismaClient, workspaceId: string, event: string, data: Data): Promise<Envelope | null> {
  const ws = await db.workspace.findUnique({ where: { id: workspaceId }, select: { id: true, slug: true, name: true } });
  return ws ? { id: randomUUID(), event, createdAt: new Date().toISOString(), workspace: ws, data } : null;
}

/** Tells every Slack, Teams or web-address connection that subscribed to this event. Safe to call anywhere. */
export async function emit(db: PrismaClient, workspaceId: string, event: string, data: Data) {
  try {
    const hooks = await db.webhook.findMany({ where: { workspaceId, active: true, events: { has: event } } });
    if (hooks.length === 0) return;
    const env = await envelope(db, workspaceId, event, data);
    if (!env) return;
    await Promise.allSettled(hooks.map((h) => deliver(db, h, env)));
  } catch { /* an alert problem must never break the action that caused it */ }
}
