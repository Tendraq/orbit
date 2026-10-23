import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Icon, Logo, type IconName } from "@/components/ui/icons";
import { MODULES } from "@/config";

// ───────── content (every line below describes something Orbit really does) ─────────
const MENUS: { label: string; items: [string, string, string][] }[] = [
  {
    label: "Product",
    items: [
      ["Stage gates", "#lifecycle", "Approvals between every phase"],
      ["Task views", "#features", "Board, list, table, Gantt, calendar"],
      ["Budget and risk", "#features", "Spending, risks, change requests"],
      ["Results and reports", "#ngo", "Indicators and donor reports"],
    ],
  },
  {
    label: "Who it is for",
    items: [
      ["NGOs and foundations", "#ngo", "The full NGO pack"],
      ["Agencies and consultancies", "#usecases", "Client-facing projects"],
      ["Public programmes", "#usecases", "Funded, audited work"],
      ["Delivery teams", "#usecases", "Engineering and IT projects"],
    ],
  },
  {
    label: "Resources",
    items: [
      ["How it works", "#how", "From setup to your first report"],
      ["Security and privacy", "#security", "Roles, audit trail, privacy"],
      ["Connects to your tools", "#integrations", "Excel, Project, calendars, chat"],
      ["Questions", "#faq", "Straight answers"],
    ],
  },
];

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  { icon: "flag", title: "Stage gates", text: "Each phase has a checklist and an approval. Projects only move forward when the work is truly ready." },
  { icon: "layers", title: "Every view you need", text: "Kanban board, list, spreadsheet table, Gantt timeline and calendar, all over the same live data." },
  { icon: "dollar", title: "Budget and expenses", text: "Plan by budget line, approve spending, and watch the burn rate before it becomes a problem." },
  { icon: "shield", title: "Risks and change control", text: "A scored risk register, issue log, and change requests with cost and schedule impact." },
  { icon: "target", title: "Results that count", text: "Logframes and indicators with baselines, targets and data over time, tied to your activities." },
  { icon: "file", title: "Donor reports in minutes", text: "Generate a first draft from live project data, refine it, submit it, and print a clean PDF." },
];

const STAGES: [string, string][] = [
  ["Initiation", "Is it worth doing? Charter, stakeholders, approval."],
  ["Planning", "Workplan, budget, logframe, roles, risks."],
  ["Execution", "Deliver the work with your team."],
  ["Monitoring", "Track progress, spending and change."],
  ["Closure", "Sign-off, lessons learned, evaluation."],
];

const AUDIENCES: [string, string][] = [
  ["NGOs and foundations", "Logframes, indicators, grants, partners and donor reports, with privacy-first beneficiary records. This is where Orbit goes deepest."],
  ["Agencies and consultancies", "Run client projects with budgets, approvals and a view-only role you can give clients."],
  ["Public and funded programmes", "Stage gates, an audit trail and change control for work that has to be accountable."],
  ["Delivery teams", "Sprints of work on a board, dependencies on a timeline, and risks tracked in the open."],
];

const TRUST: { icon: IconName; title: string; text: string }[] = [
  { icon: "users", title: "Four roles, checked every time", text: "Owner, Admin, Member and Guest. Permissions are enforced on the server for every request, not just hidden in the screen." },
  { icon: "file", title: "A trail for every change", text: "Important actions are written to an audit log with who did what and when." },
  { icon: "check", title: "Nothing lost by accident", text: "Deleted tasks, projects and comments are hidden rather than erased, so mistakes can be recovered." },
  { icon: "shield", title: "Privacy-first records", text: "The beneficiary register stores anonymous codes, never names, and is closed to guests." },
  { icon: "layers", title: "Switch features on and off", text: "Each organization chooses its modules, so people only see what they need." },
  { icon: "chart", title: "Proven foundations", text: "Built on PostgreSQL and Next.js, with secure sign-in handled by Clerk." },
];

const FAQ: [string, string][] = [
  ["What is Orbit?", "A project management platform that follows a project through all five stages, from initiation to closure and evaluation, with approvals, budgets, risks and reporting built in."],
  ["Who is it built for?", "Teams that answer to someone: NGOs and their donors, agencies and their clients, programmes and their funders. The NGO pack is the most complete today."],
  ["Can donors and partners see our progress?", "Yes. Invite them with the Guest role. They can view progress without being able to change anything, and they cannot open beneficiary records."],
  ["Can we use our own words?", "Yes. An organization can rename terms such as Beneficiary or Donor, and add its own fields to tasks and projects."],
  ["Does it work on a phone?", "It works in a phone browser. A dedicated mobile app and offline data collection are not available yet."],
  ["Can I take my data out?", "Much of it. Tasks, budgets, expenses, indicator results, risks and time download as spreadsheets, plans export to Microsoft Project, and calendar files work in any calendar app. Reports print to PDF. A one-click full backup is not built yet."],
  ["Does it work with Microsoft Project?", "You can exchange plans through Project’s XML format: bring a Project plan into Orbit, or export an Orbit plan to open in Project. A live two-way sync is not available."],
  ["Can it send alerts to Slack or Teams?", "Yes. Owners and admins can connect a Slack or Microsoft Teams channel and choose which events to send, such as approvals waiting or tasks completed."],
];

export default async function Landing() {
  const { userId } = await auth();
  if (userId) redirect("/home");
  const moduleCount = Object.keys(MODULES).length;

  return (
    <div className="overflow-x-hidden bg-white text-slate-900">
      {/* ───── nav with dropdown menus ───── */}
      <header className="glass sticky top-0 z-40 border-b border-slate-200/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo />
            <span className="text-lg font-semibold tracking-tight">Orbit</span>
          </Link>

          <nav className="hidden items-center gap-1 text-sm text-slate-600 md:flex">
            {MENUS.map((m) => (
              <div key={m.label} className="group relative">
                <button className="flex items-center gap-1 rounded-lg px-3 py-2 transition hover:bg-slate-900/5 hover:text-slate-900 focus:outline-none">
                  {m.label} <span className="text-[10px] text-slate-400">▾</span>
                </button>
                <div className="invisible absolute left-0 top-full z-50 w-72 translate-y-1 pt-2 opacity-0 transition group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                  <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-lift">
                    {m.items.map(([t, href, d]) => (
                      <a key={t} href={href} className="block rounded-xl px-3 py-2.5 transition hover:bg-brand-50">
                        <span className="block font-medium text-slate-900">{t}</span>
                        <span className="block text-xs text-slate-500">{d}</span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/sign-in" className="hidden rounded-lg px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 sm:block">Sign in</Link>
            <Link href="/sign-up" className="rounded-lg bg-gradient-to-b from-brand-500 to-brand-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm shadow-brand-700/30 transition hover:from-brand-600 hover:to-brand-700">Get started</Link>
            {/* phone menu */}
            <details className="relative md:hidden">
              <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-slate-200 text-slate-700 marker:hidden">☰</summary>
              <div className="absolute right-0 top-12 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-lift">
                {MENUS.flatMap((m) => m.items).map(([t, href]) => (
                  <a key={t} href={href} className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">{t}</a>
                ))}
                <Link href="/sign-in" className="block rounded-lg px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50">Sign in</Link>
              </div>
            </details>
          </div>
        </div>
      </header>

      {/* ───── hero ───── */}
      <section className="relative">
        <div className="pointer-events-none absolute left-1/2 top-[-120px] h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-r from-brand-300/50 via-fuchsia-300/40 to-orange-200/40 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-5 pb-10 pt-20 text-center md:pt-28">
          <span className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3.5 py-1 text-xs font-medium text-brand-700">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> Built for NGOs and project-driven teams
          </span>
          <h1 className="animate-fade-up mx-auto mt-6 max-w-4xl text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
            Run every project from first idea to <span className="text-gradient">final report</span>
          </h1>
          <p className="animate-fade-up mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            Orbit takes a project through initiation, planning, execution, monitoring and closure, with approvals, budgets, risks and donor reporting built in.
          </p>
          <div className="animate-fade-up mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/sign-up" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-brand-500 to-brand-600 px-6 py-3 text-base font-medium text-white shadow-glow transition hover:from-brand-600 hover:to-brand-700">
              Create your organization <Icon name="arrow" className="h-4 w-4" />
            </Link>
            <a href="#how" className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-base font-medium text-slate-700 shadow-sm transition hover:border-slate-300">See how it works</a>
          </div>
        </div>

        {/* what is inside, in real numbers */}
        <div className="relative mx-auto mb-14 grid max-w-3xl grid-cols-2 gap-6 px-5 text-center md:grid-cols-4">
          {[["5", "lifecycle stages"], ["6", "ways to see your work"], ["4", "access roles"], [String(moduleCount), "switchable modules"]].map(([n, l]) => (
            <div key={l}>
              <p className="text-4xl font-semibold tracking-tight text-gradient">{n}</p>
              <p className="text-sm text-slate-500">{l}</p>
            </div>
          ))}
        </div>

        {/* product preview built from plain CSS */}
        <div className="relative mx-auto max-w-5xl px-5 pb-20">
          <div className="animate-float overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lift">
            <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-red-300" /><span className="h-2.5 w-2.5 rounded-full bg-amber-300" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
              <span className="ml-3 text-xs text-slate-400">Clean Water Programme (sample)</span>
            </div>
            <div className="grid md:grid-cols-[170px_1fr]">
              <div className="hidden bg-slate-950 p-4 md:block">
                {["Overview", "Board", "Timeline", "Budget", "Risks", "Indicators"].map((t, i) => (
                  <div key={t} className={`mb-1 rounded-md px-2.5 py-1.5 text-xs ${i === 0 ? "bg-white/10 text-white" : "text-slate-400"}`}>{t}</div>
                ))}
              </div>
              <div className="space-y-4 p-5 text-left">
                <div className="flex flex-wrap gap-2">
                  {["Initiation", "Planning", "Execution", "Monitoring", "Closure"].map((s, i) => (
                    <span key={s} className={`rounded-full border px-3 py-1 text-xs ${i < 2 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : i === 2 ? "border-brand-300 bg-brand-50 font-semibold text-brand-700" : "border-slate-200 text-slate-400"}`}>{i < 2 ? "✓ " : ""}{s}</span>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[["Progress", "62%"], ["Overdue", "2"], ["Budget used", "58%"], ["Indicators", "74%"]].map(([l, v], i) => (
                    <div key={l} className="relative overflow-hidden rounded-xl border border-slate-200/70 p-3 shadow-soft">
                      <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${i === 1 ? "from-amber-400 to-orange-500" : "from-brand-400 to-fuchsia-500"}`} />
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{l}</p>
                      <p className="mt-1 text-2xl font-semibold">{v}</p>
                    </div>
                  ))}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200/70 p-4 shadow-soft">
                    <p className="mb-3 text-sm font-semibold">Tasks by status</p>
                    {[["Done", 62, "from-emerald-400 to-emerald-500"], ["In progress", 24, "from-brand-400 to-fuchsia-500"], ["To do", 14, "from-slate-300 to-slate-400"]].map(([l, w, g]) => (
                      <div key={l as string} className="mb-2">
                        <div className="mb-1 flex justify-between text-xs text-slate-500"><span>{l}</span><span>{w}%</span></div>
                        <div className="h-2 rounded-full bg-slate-100"><div className={`h-2 rounded-full bg-gradient-to-r ${g}`} style={{ width: `${w}%` }} /></div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl border border-slate-200/70 p-4 shadow-soft">
                    <p className="mb-3 text-sm font-semibold">Top risks</p>
                    {[["Contractor delays", "20", "bg-red-50 text-red-700 ring-red-200"], ["Seasonal flooding", "15", "bg-amber-50 text-amber-800 ring-amber-200"], ["Currency swings", "9", "bg-amber-50 text-amber-800 ring-amber-200"]].map(([l, s, c]) => (
                      <div key={l} className="mb-2 flex items-center justify-between text-sm"><span>{l}</span><span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${c}`}>Score {s}</span></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-slate-400">Sample data, shown for illustration</p>
        </div>
      </section>

      {/* ───── features ───── */}
      <section id="features" className="scroll-mt-16 bg-slate-50 py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Everything in one place</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">Stop juggling spreadsheets and email</h2>
            <p className="mt-4 text-lg text-slate-600">Planning, delivery, money, risk and reporting live together, so your team and your donors see the same truth.</p>
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-soft transition hover:-translate-y-1 hover:shadow-lift">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-fuchsia-500 text-white shadow-md shadow-brand-600/30"><Icon name={f.icon} /></span>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">{f.title}</h3>
                <p className="mt-2 text-slate-600">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── connects to your tools ───── */}
      <section id="integrations" className="scroll-mt-16 py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Plays well with others</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">Connects to the tools you already use</h2>
            <p className="mt-4 text-lg text-slate-600">No need to switch everything at once. Bring your plans in, and send information out.</p>
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {([
              ["file", "Excel and CSV", "Import tasks from a spreadsheet and download tasks, budgets, indicators and more."],
              ["briefcase", "Microsoft Project", "Exchange plans with Project through its XML format, with dates, subtasks and dependencies."],
              ["tasks", "Calendars", "A private feed for Outlook, Google Calendar and your phone, with your due dates and milestones."],
              ["bell", "Slack and Teams", "Get a message when an approval is waiting or a task is completed."],
              ["layers", "API and webhooks", "Connect Zapier, Make or Power Automate, or write your own scripts."],
              ["chart", "Field data", "Push survey results into your indicators from the tools your field teams use."],
            ] as [IconName, string, string][]).map(([icon, t, d]) => (
              <div key={t} className="flex gap-4 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-soft">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon name={icon} /></span>
                <div><h3 className="font-semibold tracking-tight">{t}</h3><p className="mt-1 text-sm text-slate-600">{d}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── how it works ───── */}
      <section id="how" className="scroll-mt-16 py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">How it works</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">From setup to your first report</h2>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              ["Set up your organization", "Choose your sector and switch on the modules you need. NGOs get the logframe, grants and donor reports."],
              ["Plan and run the work", "Create a project, add tasks and a budget, and watch progress on the board, timeline and dashboard."],
              ["Approve and report", "Pass each stage gate, track results against targets, and generate the report your donor expects."],
            ].map(([t, d], i) => (
              <div key={t} className="relative rounded-2xl border border-slate-200/70 bg-white p-6 shadow-soft">
                <span className="text-5xl font-semibold text-gradient">{i + 1}</span>
                <h3 className="mt-3 text-lg font-semibold tracking-tight">{t}</h3>
                <p className="mt-2 text-slate-600">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── lifecycle ───── */}
      <section id="lifecycle" className="scroll-mt-16 bg-slate-50 py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">The full lifecycle</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">Five stages. One approved path.</h2>
          </div>
          <ol className="mt-14 grid gap-4 md:grid-cols-5">
            {STAGES.map(([name, text], i) => (
              <li key={name} className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-soft">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-fuchsia-500 text-sm font-semibold text-white">{i + 1}</span>
                <h3 className="mt-4 font-semibold tracking-tight">{name}</h3>
                <p className="mt-1 text-sm text-slate-600">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ───── who it is for ───── */}
      <section id="usecases" className="scroll-mt-16 py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Who it is for</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">Made for work that has to be accountable</h2>
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-2">
            {AUDIENCES.map(([t, d]) => (
              <div key={t} className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-soft">
                <h3 className="text-lg font-semibold tracking-tight">{t}</h3>
                <p className="mt-2 text-slate-600">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── NGO ───── */}
      <section id="ngo" className="scroll-mt-16 bg-slate-950 py-24 text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 md:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-300">For NGOs</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">Built around how donors ask you to report</h2>
            <ul className="mt-8 space-y-4 text-slate-300">
              {["Logframe and indicators with baselines and targets", "Grants, donors and sub-grantee partners", "Privacy-first beneficiary register: codes, not names", "View-only access for donors and partners", "Reports drafted from your real numbers"].map((t) => (
                <li key={t} className="flex gap-3"><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-brand-300"><Icon name="check" className="h-3.5 w-3.5" /></span>{t}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
            <p className="mb-4 text-sm font-semibold text-slate-200">Indicator progress</p>
            {[["Households with safe water", 38], ["Water committees trained", 25], ["Boreholes working", 50]].map(([l, p]) => (
              <div key={l as string} className="mb-5">
                <div className="mb-1.5 flex justify-between text-sm"><span className="text-slate-300">{l}</span><span className="font-medium text-white">{p}%</span></div>
                <div className="h-2 rounded-full bg-white/10"><div className="h-2 rounded-full bg-gradient-to-r from-brand-400 to-fuchsia-500" style={{ width: `${p}%` }} /></div>
              </div>
            ))}
            <p className="text-xs text-slate-500">Illustration</p>
          </div>
        </div>
      </section>

      {/* ───── security & trust ───── */}
      <section id="security" className="scroll-mt-16 py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Security and trust</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">Careful with your data, by design</h2>
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {TRUST.map((t) => (
              <div key={t.title} className="flex gap-4 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-soft">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon name={t.icon} /></span>
                <div><h3 className="font-semibold tracking-tight">{t.title}</h3><p className="mt-1 text-sm text-slate-600">{t.text}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── FAQ ───── */}
      <section id="faq" className="scroll-mt-16 bg-slate-50 py-24">
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="text-center text-4xl font-semibold tracking-tight md:text-5xl">Questions, answered</h2>
          <div className="mt-12 space-y-3">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group rounded-2xl border border-slate-200/70 bg-white px-5 py-4 shadow-soft">
                <summary className="cursor-pointer list-none text-lg font-medium marker:hidden">
                  <span className="flex items-center justify-between gap-4">{q}<span className="text-2xl text-slate-400 transition group-open:rotate-45">+</span></span>
                </summary>
                <p className="mt-3 text-slate-600">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ───── call to action ───── */}
      <section className="px-5 py-24">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-fuchsia-600 px-8 py-16 text-center text-white shadow-glow">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
          <h2 className="relative text-4xl font-semibold tracking-tight md:text-5xl">Bring order to your next project</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-lg text-white/80">Create your organization and walk your first project through all five stages.</p>
          <Link href="/sign-up" className="relative mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-semibold text-brand-700 shadow-lg transition hover:bg-brand-50">
            Get started <Icon name="arrow" className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ───── footer ───── */}
      <footer className="border-t border-slate-200 bg-white py-12">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 md:grid-cols-4">
          <div>
            <span className="flex items-center gap-2 font-semibold"><Logo className="h-7 w-7" /> Orbit</span>
            <p className="mt-3 text-sm text-slate-500">Project management from idea to closure.</p>
          </div>
          {MENUS.map((m) => (
            <div key={m.label}>
              <p className="text-sm font-semibold">{m.label}</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-500">
                {m.items.map(([t, href]) => <li key={t}><a href={href} className="transition hover:text-slate-900">{t}</a></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-10 flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 pt-6 text-sm text-slate-400">
          <span>© Orbit</span>
          <span className="flex gap-5"><Link href="/sign-in" className="hover:text-slate-700">Sign in</Link><Link href="/sign-up" className="hover:text-slate-700">Create account</Link></span>
        </div>
      </footer>
    </div>
  );
}
