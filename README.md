# Orbit

Project management for the **whole project lifecycle**: initiation, planning,
execution, monitoring and control, closure and evaluation. First market: NGOs.
Built as a modular core so other sectors can be added later.

## What is in this version

**Core**
- Sign up / log in (Clerk), organizations (workspaces), invitations by link, roles: Owner / Admin / Member / Guest
- Projects with a lifecycle phase, status and health (green / amber / red)
- Tasks, subtasks, priorities, assignees, dates, estimates, labels, custom fields
- Six views: **Board** (drag and drop), **List**, **Table** (edit in place), **Timeline** (Gantt), **Calendar**, plus **Overview** dashboard
- Task dependencies (4 types, with lag, circular chains blocked), milestones
- Comments, link attachments, in-app notifications (inbox), search, CSV export
- Portfolio view across all projects, activity feed (audit log)

**Lifecycle**
- **Stage gates**: each phase has a checklist and an approval before the project moves on; approving the closure gate completes the project
- Budget lines, expenses with approval, variance and burn
- Risk register with heat map, issue log
- Change requests with cost and schedule impact, submit / approve / implement
- Stakeholder register with influence / interest grid
- Documents (charters, meeting notes, decisions)
- Time tracking (billable / non-billable)
- Evaluations and lessons learned, closure readiness check
- Suggested project health from overdue tasks, budget and risks

**NGO pack** (switch on per organization)
- Logframe (goal, outcomes, outputs, activities)
- Indicators with baseline, target, results over time and breakdowns
- Donors and grants, partners, beneficiary register (codes only, no names)
- Donor reports: generate a draft from live project data, edit, submit, print

**Menus and navigation**
- Quick search / command palette: press **Ctrl + K** anywhere to jump to a page, organization or project
- Top bar: **New** menu, notification dropdown, help menu
- Project **Actions** menu: copy link, print, CSV download, settings
- **Approvals** tab for owners and admins with a live count (stage gates, change requests, expenses, donor reports)
- Home shows **Needs your attention** (approvals, overdue tasks, upcoming milestones, red projects) and a Get-started checklist
- **Help center** (guides, roles table built from the real rules, shortcuts, FAQ) and **Share Orbit** (ready-made messages for recommending it)
- Public landing page with dropdown menus, security section and FAQ

**Connections to other tools**
- **Excel / CSV**: import tasks (preview first, nothing saved until you confirm); download tasks, budget, expenses, indicators, risks and time
- **Microsoft Project**: import a plan saved as XML, or export a plan to open in Project (a file exchange, not a live link)
- **Calendar feed**: a private link for Outlook, Google Calendar and phones; plus a one-off .ics download per project
- **Slack and Microsoft Teams alerts** and generic signed webhooks, with a delivery log and a test button
- **Public REST API** with keys, plus an OpenAPI description at `/api/v1/openapi.json`, for Zapier, Make, Power Automate and field-data tools

**Flexibility**
- Modules switch on / off per organization; custom words ("Beneficiary" becomes "Client"); custom fields
- Permission matrix in one file: `apps/web/src/config/permissions.ts`
- Audit log and soft deletes everywhere important

## Setup (one time)

1. Install Node.js (LTS), Git, and pnpm: `npm install -g pnpm`
2. Create free accounts: **Neon** (neon.tech, database) and **Clerk** (clerk.com, login)
3. In Neon, create a project and copy the two connection strings.
   In Clerk, create an application and copy the two API keys.
4. Copy the settings file and fill it in:
   ```bash
   cp .env.example .env
   ```
5. Install and create the database tables:
   ```bash
   pnpm install
   pnpm db:generate
   pnpm db:migrate        # name the first migration "init"
   ```
6. Start the app and sign up:
   ```bash
   pnpm dev
   ```
   Open http://localhost:3000, create an account.
7. Load the demo NGO (use the email you signed up with):
   ```bash
   SEED_EMAIL=you@example.com pnpm db:seed
   ```
   On Windows PowerShell: `$env:SEED_EMAIL="you@example.com"; pnpm db:seed`

Handy: `pnpm db:studio` opens a visual database browser.

## Where things are

| Path | What it holds |
|---|---|
| `apps/web/src/app` | Pages (each folder = a web address) |
| `apps/web/src/modules` | One folder per feature: its API router and rules |
| `apps/web/src/modules/ngo` | The NGO pack |
| `apps/web/src/server` | API setup, permission checks (`api/guard.ts`), audit, notifications |
| `apps/web/src/config` | Permissions, modules, lifecycle phases and gate checklists |
| `apps/web/src/components` | Shared screen pieces (`ui/kit.tsx`, gate panel) |
| `packages/db` | Database schema, connection, demo data |

## Adding a feature later

1. Add tables to `packages/db/prisma/schema.prisma`, run `pnpm db:migrate`
2. Create `apps/web/src/modules/<name>/router.ts` (copy a small one like `stakeholders`)
3. Register it in `server/api/root.ts` and add a switch in `config/index.ts` (MODULES)
4. Add a page under `app/(app)/[workspace]/projects/[project]/<name>/page.tsx` and a tab in that folder's `layout.tsx`

## Honest status

- This code was checked for syntax errors and for mismatches between pages and the API, but it has **not been run** (no internet in the build environment). Expect small fixes on first run, mostly from library version differences. Send the exact error message and it can be fixed quickly.
- Money amounts are stored as plain numbers. Before real financial use, switch to integer cents.
- Not tested against the real products: the Microsoft Project file was built to the published XML format and checked against my own reader, not opened in Microsoft Project itself; Slack and Teams delivery was built to their documented formats but not sent to real channels. Test each with a small example first.
- Not built yet: email sending (invites are links), real file uploads (attachments are links), real-time updates and presence, offline field forms, automations, resource and capacity planning, AI features, billing, a live two-way Microsoft Project sync, real .xlsx export (downloads are CSV, which Excel opens), a one-click full backup, a mobile app, automated tests.

## Never commit

The `.env` file holds secrets. It is already listed in `.gitignore`.
