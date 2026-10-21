import { db } from "../src/client";
// Same checklist the app uses for stage gates
import { GATE_REQUIREMENTS, PROJECT_PHASES } from "../../../apps/web/src/config";

// Loads a full demo NGO so every screen has something to show.
//
// 1. Run the app and sign in once (this creates your user).
// 2. Then:  SEED_EMAIL=you@example.com pnpm db:seed
//
// You become the OWNER of an organization called "Demo NGO" (/demo-ngo).

const day = (n: number) => new Date(Date.now() + n * 86400000);

async function main() {
  const email = process.env.SEED_EMAIL?.toLowerCase();
  if (!email) {
    console.error("Set SEED_EMAIL to the email you signed in with, e.g.\n  SEED_EMAIL=you@example.com pnpm db:seed");
    process.exit(1);
  }
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user with email ${email}. Start the app and sign in once first.`);
    process.exit(1);
  }
  if (await db.workspace.findUnique({ where: { slug: "demo-ngo" } })) {
    console.log("The demo organization already exists (/demo-ngo). Delete it first to seed again.");
    return;
  }

  // ── organization ──
  const ws = await db.workspace.create({
    data: {
      name: "Demo NGO",
      slug: "demo-ngo",
      sector: "NGO",
      enabledModules: ["core", "budget", "risks", "changes", "stakeholders", "documents", "evaluation", "time", "ngo"],
      memberships: { create: { userId: user.id, role: "OWNER" } },
    },
  });
  const [field, finance, me] = await Promise.all(
    [["Field work", "#16a34a"], ["Finance", "#d97706"], ["M&E", "#6366f1"]].map(([name, color]) =>
      db.label.create({ data: { workspaceId: ws.id, name, color } })
    )
  );
  await db.customFieldDef.create({
    data: { workspaceId: ws.id, entity: "TASK", key: "district", label: "District", type: "SELECT", options: ["North", "South", "East", "West"] },
  });

  // ── project in the Execution phase ──
  const project = await db.project.create({
    data: {
      workspaceId: ws.id, name: "Clean Water Programme", code: "WASH-01", currency: "USD",
      description: "Safe water access for rural communities: boreholes, water committees and hygiene training.",
      phase: "EXECUTING", health: "AMBER", startDate: day(-90), endDate: day(120),
    },
  });
  const pid = project.id;

  // stage gates: Initiation and Planning already approved
  await db.stageGate.createMany({
    data: PROJECT_PHASES.map((phase) => {
      const approved = phase === "INITIATING" || phase === "PLANNING";
      return {
        projectId: pid, phase,
        status: approved ? ("APPROVED" as const) : ("PENDING" as const),
        decidedById: approved ? user.id : null, decidedAt: approved ? day(-70) : null,
        requirements: GATE_REQUIREMENTS[phase].map((label, i) => ({ id: `${phase}-${i}`, label, done: approved || (phase === "EXECUTING" && i === 0) })),
      };
    }),
  });

  // ── tasks, subtasks, dependencies, labels ──
  const mk = (data: Parameters<typeof db.task.create>[0]["data"]) =>
    db.task.create({ data: { projectId: pid, reporterId: user.id, ...data } as never });
  const survey = await mk({ title: "Baseline household survey", status: "DONE", priority: "HIGH", assigneeId: user.id, startDate: day(-60), dueDate: day(-40), completedAt: day(-41), estimateHours: 80, position: 1000, customFields: { district: "North" } });
  const sites = await mk({ title: "Select borehole sites", status: "DONE", priority: "HIGH", assigneeId: user.id, startDate: day(-45), dueDate: day(-25), completedAt: day(-26), position: 2000, customFields: { district: "South" } });
  const procure = await mk({ title: "Procure drilling equipment", status: "IN_PROGRESS", priority: "URGENT", assigneeId: user.id, startDate: day(-20), dueDate: day(5), estimateHours: 40, position: 1000 });
  const drill = await mk({ title: "Drill 12 boreholes", status: "TODO", priority: "HIGH", startDate: day(6), dueDate: day(60), estimateHours: 400, position: 1000, customFields: { district: "East" } });
  const train = await mk({ title: "Train water committees", status: "BACKLOG", priority: "MEDIUM", startDate: day(40), dueDate: day(90), position: 1000 });
  const report = await mk({ title: "Quarterly donor report", status: "TODO", priority: "HIGH", assigneeId: user.id, dueDate: day(-3), position: 2000 });
  await mk({ title: "Get three supplier quotes", status: "DONE", parentId: procure.id });
  await mk({ title: "Sign supplier contract", status: "TODO", parentId: procure.id });

  await db.taskDependency.createMany({
    data: [
      { taskId: sites.id, dependsOnId: survey.id },
      { taskId: procure.id, dependsOnId: sites.id },
      { taskId: drill.id, dependsOnId: procure.id },
      { taskId: train.id, dependsOnId: drill.id, lagDays: 7 },
    ],
  });
  await db.taskLabel.createMany({
    data: [
      { taskId: survey.id, labelId: me.id }, { taskId: sites.id, labelId: field.id },
      { taskId: procure.id, labelId: finance.id }, { taskId: drill.id, labelId: field.id },
      { taskId: report.id, labelId: me.id },
    ],
  });
  await db.comment.create({ data: { taskId: procure.id, authorId: user.id, body: "Two suppliers quoted within budget. Waiting on the third before we sign." } });
  await db.timeEntry.createMany({
    data: [
      { projectId: pid, taskId: survey.id, userId: user.id, minutes: 480, date: day(-45), billable: true, note: "Field visits" },
      { projectId: pid, taskId: procure.id, userId: user.id, minutes: 180, date: day(-3), note: "Supplier calls" },
    ],
  });
  await db.milestone.createMany({
    data: [
      { projectId: pid, name: "Baseline complete", dueDate: day(-38), doneAt: day(-38) },
      { projectId: pid, name: "First 6 boreholes drilled", dueDate: day(35) },
      { projectId: pid, name: "Programme closure", dueDate: day(120) },
    ],
  });

  // ── money ──
  const [staff, equip, training, monitoring] = await Promise.all(
    [["Staff", 120000], ["Equipment", 180000], ["Training", 40000], ["Monitoring & evaluation", 25000]].map(([category, planned]) =>
      db.budgetLine.create({ data: { projectId: pid, category: category as string, planned: planned as number } })
    )
  );
  await db.expense.createMany({
    data: [
      { projectId: pid, budgetLineId: staff.id, amount: 90000, description: "Salaries, Jan to Jun", status: "APPROVED", createdById: user.id, date: day(-30) },
      { projectId: pid, budgetLineId: equip.id, amount: 120000, description: "Drilling rig deposit", status: "APPROVED", createdById: user.id, date: day(-15) },
      { projectId: pid, budgetLineId: equip.id, amount: 30000, description: "Pumps and fittings", status: "PENDING", createdById: user.id, date: day(-2) },
      { projectId: pid, budgetLineId: training.id, amount: 5000, description: "Trainer fees (pilot)", status: "APPROVED", createdById: user.id, date: day(-10) },
      { projectId: pid, budgetLineId: monitoring.id, amount: 3000, description: "Survey tablets", status: "APPROVED", createdById: user.id, date: day(-55) },
    ],
  });

  // ── risks, issues, change control, stakeholders, documents ──
  await db.risk.createMany({
    data: [
      { projectId: pid, title: "Drilling contractor delays", probability: 4, impact: 4, status: "MITIGATING", response: "Penalty clause and a backup contractor on standby", ownerId: user.id },
      { projectId: pid, title: "Seasonal flooding blocks site access", probability: 3, impact: 5, response: "Schedule remote sites in the dry season" },
      { projectId: pid, title: "Currency devaluation raises equipment cost", probability: 3, impact: 3 },
    ],
  });
  await db.issue.create({ data: { projectId: pid, title: "Supplier invoice dispute", severity: "HIGH", description: "Invoice total differs from the signed quote." } });
  await db.changeRequest.create({
    data: { projectId: pid, title: "Add 2 extra boreholes", description: "Two more villages qualified in the baseline survey.", reason: "Survey results", costImpact: 28000, scheduleImpactDays: 20, status: "SUBMITTED", requestedById: user.id },
  });
  await db.stakeholder.createMany({
    data: [
      { projectId: pid, name: "District water office", organization: "Local government", influence: 5, interest: 4, engagement: "Monthly briefing" },
      { projectId: pid, name: "Community leaders", organization: "Villages", influence: 3, interest: 5, engagement: "Village meetings" },
      { projectId: pid, name: "Programme officer", organization: "Global Water Fund", role: "Donor", influence: 5, interest: 5, engagement: "Quarterly reports" },
      { projectId: pid, name: "Local radio", influence: 2, interest: 2 },
    ],
  });
  await db.document.create({
    data: { projectId: pid, title: "Project charter", kind: "CHARTER", createdById: user.id, content: "PURPOSE\nSafe water for 5,000 households.\n\nSCOPE\n12 boreholes, 24 water committees.\n\nSUCCESS\nSee the Indicators tab." },
  });

  // ── NGO pack ──
  const goal = await db.logframeItem.create({ data: { projectId: pid, level: "GOAL", code: "G1", statement: "Improved health in rural communities through safe water" } });
  const outcome = await db.logframeItem.create({ data: { projectId: pid, parentId: goal.id, level: "OUTCOME", code: "1", statement: "Households use safe water sources", assumptions: "Communities maintain the boreholes" } });
  const out1 = await db.logframeItem.create({ data: { projectId: pid, parentId: outcome.id, level: "OUTPUT", code: "1.1", statement: "12 boreholes drilled and working", meansOfVerification: "Site inspection reports" } });
  const out2 = await db.logframeItem.create({ data: { projectId: pid, parentId: outcome.id, level: "OUTPUT", code: "1.2", statement: "24 water committees trained" } });
  await db.logframeItem.createMany({
    data: [
      { projectId: pid, parentId: out1.id, level: "ACTIVITY", code: "1.1.1", statement: "Select sites" },
      { projectId: pid, parentId: out1.id, level: "ACTIVITY", code: "1.1.2", statement: "Drill and test boreholes" },
      { projectId: pid, parentId: out2.id, level: "ACTIVITY", code: "1.2.1", statement: "Run committee training" },
    ],
  });
  const households = await db.indicator.create({ data: { projectId: pid, logframeItemId: outcome.id, name: "Households with access to safe water", unit: "households", baseline: 0, target: 5000, frequency: "QUARTERLY", dataSource: "Household survey", disaggregateBy: ["gender of head"] } });
  const committees = await db.indicator.create({ data: { projectId: pid, logframeItemId: out2.id, name: "Water committees trained", unit: "committees", baseline: 0, target: 24, frequency: "QUARTERLY", dataSource: "Training records" } });
  await db.indicatorValue.createMany({
    data: [
      { indicatorId: households.id, period: "2026-Q1", periodStart: day(-180), value: 800, recordedById: user.id, disaggregation: { female: 450, male: 350 } },
      { indicatorId: households.id, period: "2026-Q2", periodStart: day(-90), value: 1900, recordedById: user.id, disaggregation: { female: 1100, male: 800 } },
      { indicatorId: committees.id, period: "2026-Q2", periodStart: day(-90), value: 6, recordedById: user.id },
    ],
  });
  const donor = await db.donor.create({ data: { workspaceId: ws.id, name: "Global Water Fund", contactEmail: "grants@example.org" } });
  await db.grant.create({ data: { workspaceId: ws.id, donorId: donor.id, projectId: pid, title: "WASH Phase 1", amount: 400000, currency: "USD", startDate: day(-90), endDate: day(120), conditions: "Quarterly narrative and financial reports within 30 days of quarter end." } });
  await db.partner.create({ data: { workspaceId: ws.id, name: "Rural Aid Partners", type: "Sub-grantee", country: "Kenya", contactEmail: "info@example.org" } });
  await db.beneficiary.createMany({
    data: [
      ["H-0001", "Female", "35-59", "North", false], ["H-0002", "Male", "18-34", "North", false],
      ["H-0003", "Female", "60+", "South", true], ["H-0004", "Female", "18-34", "South", false],
      ["H-0005", "Male", "35-59", "East", false], ["H-0006", "Female", "5-17", "East", false],
    ].map(([code, gender, ageGroup, location, disability]) => ({
      workspaceId: ws.id, projectId: pid, code: code as string, gender: gender as string,
      ageGroup: ageGroup as string, location: location as string, disability: disability as boolean, consentGiven: true,
    })),
  });
  await db.donorReport.create({
    data: { projectId: pid, title: "Q2 2026 progress report", periodStart: day(-90), periodEnd: day(-1), narrative: "Open the Donor reports tab and use “Generate draft” for a version built from live data.", createdById: user.id },
  });

  await db.notification.create({
    data: { userId: user.id, workspaceId: ws.id, type: "change", title: "Change request to review: Add 2 extra boreholes", body: "Clean Water Programme", link: `/demo-ngo/projects/${pid}/changes` },
  });

  console.log(`Seeded the demo NGO. Open /demo-ngo/projects/${pid}/overview`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
