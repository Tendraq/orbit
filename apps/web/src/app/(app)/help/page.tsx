import { Card, SectionTitle } from "@/components/ui/kit";
import { can, type Action, type RoleName } from "@/config/permissions";
import { GATE_REQUIREMENTS, MODULES, PHASE_LABELS, PROJECT_PHASES } from "@/config";

const ROLES: RoleName[] = ["OWNER", "ADMIN", "MEMBER", "GUEST"];
// The table below is built from the real permission rules, so it can never be out of date.
const ABILITIES: [string, Action][] = [
  ["View everything", "workspace:read"],
  ["Create projects", "project:create"],
  ["Create and edit tasks", "task:update"],
  ["Delete tasks", "task:delete"],
  ["Comment and log time", "comment:create"],
  ["Manage risks and issues", "risk:manage"],
  ["Raise change requests", "change:create"],
  ["Record expenses", "expense:create"],
  ["Approve expenses", "expense:approve"],
  ["Manage budget lines", "budget:manage"],
  ["Decide change requests", "change:decide"],
  ["Approve stage gates", "gate:approve"],
  ["Set up logframe, grants, partners", "ngo:manage"],
  ["Enter indicator data", "ngo:data"],
  ["View beneficiary records", "beneficiary:read"],
  ["Invite and manage members", "member:manage"],
  ["Change organization settings", "workspace:update"],
];

const FAQ: [string, string][] = [
  ["How do I invite someone?", "Open your organization, go to Members, enter their email and choose a role, then copy the invite link and send it to them. They open the link while signed in with that email. Email sending is not built in yet."],
  ["What does the Guest role mean?", "Guests can view but not change anything. It is meant for donors, partners and clients who need to see progress. Guests cannot open beneficiary records."],
  ["Are beneficiary names stored?", "No. The register uses an anonymous code that only your team can link back to a person, plus a few non-identifying details such as age group and location."],
  ["What happens when I delete a task or project?", "It is hidden, not erased. Tasks, projects and comments are soft-deleted so nothing is lost by accident."],
  ["How is project health decided?", "You set it yourself. Orbit also shows a suggestion based on overdue tasks, budget use and open risks, with the reasons listed."],
  ["Can I rename “Beneficiary” or “Donor”?", "Yes. Open Settings in your organization and change the words under “Your words”."],
  ["How do donor reports work?", "In a project, open Donor reports, choose a period and click Generate draft. Orbit writes a first version from your indicators, budget, tasks and risks. You edit it, submit it, and print it as a PDF."],
  ["How do I bring in a plan from Excel or Microsoft Project?", "Open a project, choose Import / export, and drop in an Excel (.xlsx), CSV or Microsoft Project XML file. Orbit shows you what it found before anything is saved. In Project use File, Save As, XML Format."],
  ["Can I see due dates in Outlook or Google Calendar?", "Yes. Open your organization, go to Integrations, and copy your private calendar link into Outlook, Google Calendar or your phone. It works once Orbit is online at a public address."],
  ["How do I get alerts in Slack or Microsoft Teams?", "Owners and admins can add a connection under Integrations. Paste a Slack incoming-webhook address, or a Teams Workflows webhook address (the old Teams connectors were retired), choose the events, and use Send test."],
  ["Can another program read or update my data?", "Yes, through the API. Under Integrations create a key, then connect tools such as Zapier, Make, Power Automate or a script. Read-only keys cannot change anything."],
  ["Why can I not see some menus?", "Some menus depend on your role and on which modules your organization switched on. Owners can change modules in Settings."],
];

export default function HelpPage() {
  return (
    <div className="max-w-4xl space-y-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Help center</h1>
        <p className="mt-1 text-slate-600">Short guides to get the most out of Orbit.</p>
      </div>

      <section>
        <SectionTitle>Start here</SectionTitle>
        <ol className="grid gap-3 md:grid-cols-2">
          {[
            ["Create an organization", "On Home, name it and pick a sector. Choose NGO to switch on the logframe, grants and donor reports."],
            ["Create a project", "Give it a name, currency and dates. It starts in the Initiation phase."],
            ["Add tasks and milestones", "Use the Board, List or Table. Give tasks dates and they appear on the Timeline and Calendar."],
            ["Move through the stage gates", "Complete each phase's checklist, submit it, and an owner or admin approves it to move on."],
          ].map(([t, d], i) => (
            <Card key={t} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-fuchsia-500 text-sm font-semibold text-white">{i + 1}</span>
              <div><p className="font-medium">{t}</p><p className="text-sm text-slate-600">{d}</p></div>
            </Card>
          ))}
        </ol>
      </section>

      <section>
        <SectionTitle>The project lifecycle</SectionTitle>
        <p className="mb-3 text-sm text-slate-600">Every project passes five stages. To leave a stage, its checklist must be complete and approved.</p>
        <div className="grid gap-3 md:grid-cols-5">
          {PROJECT_PHASES.map((ph, i) => (
            <Card key={ph}>
              <p className="text-xs font-semibold text-brand-600">Stage {i + 1}</p>
              <p className="font-semibold">{PHASE_LABELS[ph]}</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-600">
                {GATE_REQUIREMENTS[ph].slice(0, 3).map((r) => <li key={r}>{r}</li>)}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      <section id="roles">
        <SectionTitle>Who can do what</SectionTitle>
        <div className="overflow-x-auto rounded-xl border border-slate-200/70 bg-white shadow-soft">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr><th className="p-3">Action</th>{ROLES.map((r) => <th key={r} className="p-3 text-center">{r.charAt(0) + r.slice(1).toLowerCase()}</th>)}</tr>
            </thead>
            <tbody>
              {ABILITIES.map(([label, action]) => (
                <tr key={action} className="border-t border-slate-100">
                  <td className="p-3">{label}</td>
                  {ROLES.map((r) => (
                    <td key={r} className="p-3 text-center">{can(r, action) ? <span className="font-semibold text-emerald-600">✓</span> : <span className="text-slate-300">—</span>}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <SectionTitle>Modules</SectionTitle>
        <p className="mb-3 text-sm text-slate-600">Owners switch these on or off in Settings. Data is kept when a module is off.</p>
        <ul className="grid gap-2 md:grid-cols-3">
          {Object.entries(MODULES).map(([k, m]) => (
            <li key={k} className="rounded-lg border border-slate-200/70 bg-white px-3 py-2 text-sm shadow-soft"><b>{m.label}</b><span className="block text-xs text-slate-500">{m.description}</span></li>
          ))}
        </ul>
      </section>

      <section>
        <SectionTitle>Connect your other tools</SectionTitle>
        <div className="grid gap-3 md:grid-cols-2">
          {[
            ["Excel and CSV", "Import tasks from a spreadsheet; download tasks, budgets, expenses, indicators, risks and time. Project, Import / export tab."],
            ["Microsoft Project", "Import a plan saved as XML, or export an Orbit plan to open in Project. This is a file exchange, not a live link."],
            ["Calendars", "A private link that shows your due dates and milestones in Outlook, Google Calendar or your phone. Organization, Integrations."],
            ["Slack and Teams", "Messages for approvals, completed tasks, expenses and more. Owners and admins set this up under Integrations."],
            ["API and webhooks", "Let Zapier, Make, Power Automate or your own scripts read and update Orbit. Field-data tools can push indicator results in."],
          ].map(([t, d]) => (
            <Card key={t}><p className="font-medium">{t}</p><p className="text-sm text-slate-600">{d}</p></Card>
          ))}
        </div>
      </section>

      <section id="shortcuts">
        <SectionTitle>Keyboard shortcuts</SectionTitle>
        <Card>
          <ul className="space-y-2 text-sm">
            {[["Ctrl + K (or Cmd + K)", "Open quick search from anywhere"], ["↑ and ↓", "Move through the results"], ["Enter", "Open the highlighted result"], ["Esc", "Close a menu or the search"]].map(([k, d]) => (
              <li key={k} className="flex items-center gap-3"><kbd className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium">{k}</kbd><span className="text-slate-600">{d}</span></li>
            ))}
          </ul>
        </Card>
      </section>

      <section>
        <SectionTitle>Questions</SectionTitle>
        <div className="space-y-2">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group rounded-xl border border-slate-200/70 bg-white px-4 py-3 shadow-soft">
              <summary className="cursor-pointer list-none font-medium marker:hidden">
                <span className="flex items-center justify-between gap-3">{q}<span className="text-slate-400 transition group-open:rotate-45">+</span></span>
              </summary>
              <p className="mt-2 text-sm text-slate-600">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
