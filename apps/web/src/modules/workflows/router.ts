import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { PrismaClient, ProjectPhase } from "@orbit/db";
import { emit } from "@/server/events";
import { router, protectedProcedure } from "@/server/api/trpc";
import { guardProject, log } from "@/server/api/guard";
import { notify, notifyMany, approverIds } from "@/server/notify";
import { GATE_REQUIREMENTS, PROJECT_PHASES, PHASE_LABELS } from "@/config";

type Req = { id: string; label: string; done: boolean };
const phaseEnum = z.enum(PROJECT_PHASES);

// Creates the 5 gates for a project the first time they are needed
async function ensureGates(db: PrismaClient, projectId: string) {
  const existing = await db.stageGate.findMany({ where: { projectId } });
  const have = new Set(existing.map((g) => g.phase));
  const missing = PROJECT_PHASES.filter((p) => !have.has(p));
  if (missing.length) {
    await db.stageGate.createMany({
      data: missing.map((phase) => ({
        projectId,
        phase,
        requirements: GATE_REQUIREMENTS[phase].map((label, i) => ({
          id: `${phase}-${i}`,
          label,
          done: false,
        })),
      })),
      skipDuplicates: true,
    });
  }
  const gates = await db.stageGate.findMany({ where: { projectId } });
  return gates.sort((a, b) => PROJECT_PHASES.indexOf(a.phase) - PROJECT_PHASES.indexOf(b.phase));
}

async function getGate(db: PrismaClient, projectId: string, phase: ProjectPhase) {
  await ensureGates(db, projectId);
  const gate = await db.stageGate.findUnique({ where: { projectId_phase: { projectId, phase } } });
  if (!gate) throw new TRPCError({ code: "NOT_FOUND", message: "Gate not found" });
  return gate;
}

export const workflowRouter = router({
  // All five gates with their checklists
  gates: protectedProcedure.input(z.object({ projectId: z.string() })).query(async ({ ctx, input }) => {
    const { project } = await guardProject(ctx, input.projectId, "workspace:read");
    const gates = await ensureGates(ctx.db, input.projectId);
    return {
      currentPhase: project.phase,
      status: project.status,
      gates: gates.map((g) => ({ ...g, requirements: g.requirements as unknown as Req[] })),
    };
  }),

  toggleRequirement: protectedProcedure
    .input(z.object({ projectId: z.string(), phase: phaseEnum, itemId: z.string(), done: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await guardProject(ctx, input.projectId, "gate:edit");
      const gate = await getGate(ctx.db, input.projectId, input.phase);
      if (gate.status === "APPROVED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This gate is already approved" });
      }
      const reqs = (gate.requirements as unknown as Req[]).map((r) =>
        r.id === input.itemId ? { ...r, done: input.done } : r
      );
      return ctx.db.stageGate.update({ where: { id: gate.id }, data: { requirements: reqs } });
    }),

  addRequirement: protectedProcedure
    .input(z.object({ projectId: z.string(), phase: phaseEnum, label: z.string().min(2).max(200) }))
    .mutation(async ({ ctx, input }) => {
      await guardProject(ctx, input.projectId, "gate:edit");
      const gate = await getGate(ctx.db, input.projectId, input.phase);
      const reqs = gate.requirements as unknown as Req[];
      reqs.push({ id: `${input.phase}-${Date.now()}`, label: input.label, done: false });
      return ctx.db.stageGate.update({ where: { id: gate.id }, data: { requirements: reqs } });
    }),

  // Ask the owners/admins to approve moving past the current phase
  submit: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { project, workspace } = await guardProject(ctx, input.projectId, "gate:edit");
      if (project.status === "COMPLETED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This project is already completed" });
      }
      const gate = await getGate(ctx.db, project.id, project.phase);
      if (gate.status === "SUBMITTED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Already waiting for approval" });
      }
      const reqs = gate.requirements as unknown as Req[];
      const open = reqs.filter((r) => !r.done).length;
      if (open > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Complete the checklist first (${open} item${open > 1 ? "s" : ""} left)`,
        });
      }
      await ctx.db.stageGate.update({
        where: { id: gate.id },
        data: { status: "SUBMITTED", submittedById: ctx.user.id, submittedAt: new Date(), decisionNote: null },
      });
      await log(ctx, workspace.id, "gate.submitted", "StageGate", gate.id, { phase: project.phase });
      await emit(ctx.db, workspace.id, "gate.submitted", { project: project.name, phase: PHASE_LABELS[project.phase], by: ctx.user.name ?? ctx.user.email, path: `/${workspace.slug}/projects/${project.id}/overview` });
      await notifyMany(ctx.db, (await approverIds(ctx.db, workspace.id)).filter((id) => id !== ctx.user.id), {
        workspaceId: workspace.id,
        type: "gate",
        title: `Approval needed: ${project.name} (${PHASE_LABELS[project.phase]})`,
        link: `/${workspace.slug}/projects/${project.id}/overview`,
      });
      return { ok: true };
    }),

  // Owner/admin approves or rejects. Approving moves the project to the next phase.
  decide: protectedProcedure
    .input(z.object({ projectId: z.string(), approve: z.boolean(), note: z.string().max(1000).optional() }))
    .mutation(async ({ ctx, input }) => {
      const { project, workspace } = await guardProject(ctx, input.projectId, "gate:approve");
      const gate = await getGate(ctx.db, project.id, project.phase);
      if (gate.status !== "SUBMITTED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nothing is waiting for approval" });
      }
      await ctx.db.stageGate.update({
        where: { id: gate.id },
        data: {
          status: input.approve ? "APPROVED" : "REJECTED",
          decidedById: ctx.user.id,
          decidedAt: new Date(),
          decisionNote: input.note,
        },
      });

      if (input.approve) {
        const idx = PROJECT_PHASES.indexOf(project.phase);
        const next = PROJECT_PHASES[idx + 1];
        await ctx.db.project.update({
          where: { id: project.id },
          // Approving the last gate (closure) completes the project
          data: next ? { phase: next } : { status: "COMPLETED" },
        });
      }
      await log(ctx, workspace.id, input.approve ? "gate.approved" : "gate.rejected", "StageGate", gate.id, {
        phase: project.phase,
      });
      await emit(ctx.db, workspace.id, input.approve ? "gate.approved" : "gate.rejected", { project: project.name, phase: PHASE_LABELS[project.phase], note: input.note ?? "", by: ctx.user.name ?? ctx.user.email, path: `/${workspace.slug}/projects/${project.id}/overview` });
      await notify(ctx.db, gate.submittedById, {
        workspaceId: workspace.id,
        type: "gate",
        title: `${input.approve ? "Approved" : "Sent back"}: ${project.name} (${PHASE_LABELS[project.phase]})`,
        body: input.note,
        link: `/${workspace.slug}/projects/${project.id}/overview`,
      });
      return { ok: true };
    }),
});
