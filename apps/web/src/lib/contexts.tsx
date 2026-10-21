"use client";

import { createContext, useContext } from "react";
import { can as canRole, type Action, type RoleName } from "@/config/permissions";
import { DEFAULT_TERMINOLOGY } from "@/config";
import type { Out } from "./trpc";

type Base = { role: RoleName; enabledModules: string[]; terminology: unknown };

function helpers(b: Base) {
  const terms = (b.terminology ?? {}) as Record<string, string>;
  return {
    role: b.role,
    can: (a: Action) => canRole(b.role, a), // may this person do it?
    has: (m: string) => b.enabledModules.includes(m), // is the module on?
    term: (k: string) => terms[k] ?? DEFAULT_TERMINOLOGY[k] ?? k, // custom wording
  };
}

// ───── workspace ─────
export type WorkspaceValue = ReturnType<typeof helpers> & { id: string; slug: string; name: string; sector: string };
export const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function buildWorkspaceValue(ws: Out["workspace"]["get"]): WorkspaceValue {
  return {
    ...helpers({ role: ws.role, enabledModules: ws.enabledModules, terminology: ws.terminology }),
    id: ws.id, slug: ws.slug, name: ws.name, sector: ws.sector,
  };
}

export function useWorkspace() {
  const v = useContext(WorkspaceContext);
  if (!v) throw new Error("useWorkspace must be used inside a workspace page");
  return v;
}

// ───── project ─────
export type ProjectValue = ReturnType<typeof helpers> & {
  project: Out["project"]["get"];
  slug: string;
};
export const ProjectContext = createContext<ProjectValue | null>(null);

export function buildProjectValue(p: Out["project"]["get"]): ProjectValue {
  return {
    ...helpers({ role: p.role, enabledModules: p.workspace.enabledModules, terminology: p.workspace.terminology }),
    project: p,
    slug: p.workspace.slug,
  };
}

export function useProject() {
  const v = useContext(ProjectContext);
  if (!v) throw new Error("useProject must be used inside a project page");
  return v;
}
