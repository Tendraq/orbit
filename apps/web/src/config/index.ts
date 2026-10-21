// Words the app uses. Each workspace can override these
// (an NGO says "Beneficiary", an agency says "Client").
export const DEFAULT_TERMINOLOGY: Record<string, string> = {
  workspace: "Organization",
  project: "Project",
  task: "Task",
  beneficiary: "Beneficiary",
  donor: "Donor",
  partner: "Partner",
};

// Modules that can be switched on or off per workspace.
export const MODULES: Record<string, { label: string; description: string; alwaysOn?: boolean }> = {
  core: { label: "Core", description: "Projects, tasks, comments, notifications", alwaysOn: true },
  budget: { label: "Budget", description: "Budget lines, expenses, variance" },
  risks: { label: "Risks & issues", description: "Risk register and issue log" },
  changes: { label: "Change control", description: "Change requests with impact and approval" },
  stakeholders: { label: "Stakeholders", description: "Register and influence/interest grid" },
  documents: { label: "Documents", description: "Charters, meeting notes, decisions" },
  evaluation: { label: "Evaluation & closure", description: "Evaluations and lessons learned" },
  time: { label: "Time tracking", description: "Log hours against tasks" },
  ngo: { label: "NGO pack", description: "Logframe, indicators, grants, partners, beneficiaries, donor reports" },
};

export const DEFAULT_MODULES = [
  "core", "budget", "risks", "changes", "stakeholders", "documents", "evaluation", "time",
];
export const NGO_MODULES = [...DEFAULT_MODULES, "ngo"];

export const SECTORS = ["GENERAL", "NGO", "AGENCY", "CONSTRUCTION", "IT_SERVICES"] as const;

// The project lifecycle, in order
export const PROJECT_PHASES = ["INITIATING", "PLANNING", "EXECUTING", "MONITORING", "CLOSING"] as const;
export type Phase = (typeof PROJECT_PHASES)[number];

export const PHASE_LABELS: Record<Phase, string> = {
  INITIATING: "Initiation",
  PLANNING: "Planning",
  EXECUTING: "Execution",
  MONITORING: "Monitoring & control",
  CLOSING: "Closure & evaluation",
};

// Checklist a project must complete before leaving each phase (stage gate)
export const GATE_REQUIREMENTS: Record<Phase, string[]> = {
  INITIATING: [
    "Project charter written",
    "Stakeholders identified",
    "Concept note / business case approved",
    "Initial risks logged",
  ],
  PLANNING: [
    "Workplan and milestones created",
    "Budget approved",
    "Logframe and indicators defined",
    "Roles and responsibilities assigned",
    "Risk register reviewed",
  ],
  EXECUTING: [
    "Activities delivered per workplan",
    "Progress reports submitted",
    "Budget variance reviewed",
  ],
  MONITORING: [
    "Indicator data collected and verified",
    "Open change requests resolved",
    "Midterm evaluation completed",
  ],
  CLOSING: [
    "Final report submitted",
    "Deliverables accepted by client / donor",
    "Final budget reconciled",
    "Lessons learned recorded",
    "Project archived",
  ],
};

export const TASK_STATUSES = ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const;
export const STATUS_LABELS: Record<(typeof TASK_STATUSES)[number], string> = {
  BACKLOG: "Backlog",
  TODO: "To do",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  DONE: "Done",
};
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
