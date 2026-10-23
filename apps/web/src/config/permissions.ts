// The permission matrix. PURE data: safe to use in both server and browser.
// Edit who-can-do-what here and nowhere else.

export type RoleName = "OWNER" | "ADMIN" | "MEMBER" | "GUEST";

export const ALL_ACTIONS = [
  "workspace:read",
  "workspace:update",
  "member:manage",
  "project:create",
  "project:update",
  "task:create",
  "task:update",
  "task:delete",
  "comment:create",
  "time:log",
  "budget:manage",
  "expense:create",
  "expense:approve",
  "risk:manage",
  "change:create",
  "change:decide",
  "gate:edit",
  "gate:approve",
  "stakeholder:manage",
  "document:manage",
  "lesson:manage",
  "ngo:manage",
  "ngo:data",
  "beneficiary:read",
  "report:manage",
  "customfield:manage",
  "label:manage",
  "integration:manage",
] as const;

export type Action = (typeof ALL_ACTIONS)[number];

const MEMBER_ACTIONS: Action[] = [
  "workspace:read",
  "project:create",
  "task:create",
  "task:update",
  "comment:create",
  "time:log",
  "expense:create",
  "risk:manage",
  "change:create",
  "gate:edit",
  "stakeholder:manage",
  "document:manage",
  "lesson:manage",
  "ngo:data",
  "beneficiary:read",
  "report:manage",
  "label:manage",
];

export const MATRIX: Record<RoleName, readonly Action[]> = {
  OWNER: ALL_ACTIONS,
  ADMIN: ALL_ACTIONS.filter((a) => a !== "workspace:update"),
  MEMBER: MEMBER_ACTIONS,
  GUEST: ["workspace:read"], // donors, partners, clients: view only
};

export function can(role: RoleName, action: Action): boolean {
  return MATRIX[role].includes(action);
}
