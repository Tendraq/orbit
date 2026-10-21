import { z } from "zod";
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/api/trpc";
import { guardWorkspace, log } from "@/server/api/guard";
import { notify } from "@/server/notify";
import { DEFAULT_MODULES, NGO_MODULES } from "@/config";
import { createWorkspaceInput, updateSettingsInput, roleEnum } from "./schema";

export const workspaceRouter = router({
  // Workspaces the current user belongs to
  list: protectedProcedure.query(({ ctx }) =>
    ctx.db.workspace.findMany({
      where: { deletedAt: null, memberships: { some: { userId: ctx.user.id } } },
      orderBy: { createdAt: "asc" },
    })
  ),

  // One workspace + my role in it (used by the layout of every workspace page)
  get: protectedProcedure.input(z.object({ slug: z.string() })).query(async ({ ctx, input }) => {
    const { workspace, role } = await guardWorkspace(ctx, input.slug, "workspace:read");
    const { memberships: _ignored, ...rest } = workspace;
    return { ...rest, role };
  }),

  create: protectedProcedure.input(createWorkspaceInput).mutation(async ({ ctx, input }) => {
    const taken = await ctx.db.workspace.findUnique({ where: { slug: input.slug } });
    if (taken) {
      throw new TRPCError({ code: "CONFLICT", message: "That address is already taken" });
    }
    const workspace = await ctx.db.workspace.create({
      data: {
        name: input.name,
        slug: input.slug,
        sector: input.sector,
        enabledModules: input.sector === "NGO" ? NGO_MODULES : DEFAULT_MODULES,
        memberships: { create: { userId: ctx.user.id, role: "OWNER" } },
      },
    });
    await log(ctx, workspace.id, "workspace.created", "Workspace", workspace.id);
    return workspace;
  }),

  updateSettings: protectedProcedure.input(updateSettingsInput).mutation(async ({ ctx, input }) => {
    const { workspace } = await guardWorkspace(ctx, input.slug, "workspace:update");
    const modules = input.enabledModules
      ? [...new Set(["core", ...input.enabledModules])]
      : undefined;
    const updated = await ctx.db.workspace.update({
      where: { id: workspace.id },
      data: {
        name: input.name,
        sector: input.sector,
        enabledModules: modules,
        terminology: input.terminology,
      },
    });
    await log(ctx, workspace.id, "workspace.settings_updated", "Workspace", workspace.id);
    return updated;
  }),

  // ───── members & invitations ─────
  members: protectedProcedure.input(z.object({ slug: z.string() })).query(async ({ ctx, input }) => {
    const { workspace } = await guardWorkspace(ctx, input.slug, "workspace:read");
    return ctx.db.membership.findMany({
      where: { workspaceId: workspace.id },
      include: { user: { select: { id: true, name: true, email: true, imageUrl: true } } },
      orderBy: { createdAt: "asc" },
    });
  }),

  invitations: protectedProcedure.input(z.object({ slug: z.string() })).query(async ({ ctx, input }) => {
    const { workspace } = await guardWorkspace(ctx, input.slug, "member:manage");
    return ctx.db.invitation.findMany({
      where: { workspaceId: workspace.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
  }),

  invite: protectedProcedure
    .input(z.object({ slug: z.string(), email: z.string().email(), role: roleEnum.default("MEMBER") }))
    .mutation(async ({ ctx, input }) => {
      const { workspace } = await guardWorkspace(ctx, input.slug, "member:manage");
      if (input.role === "OWNER") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invite as Admin, Member or Guest" });
      }
      const email = input.email.toLowerCase();
      const existing = await ctx.db.membership.findFirst({
        where: { workspaceId: workspace.id, user: { email } },
      });
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Already a member" });

      const invitation = await ctx.db.invitation.create({
        data: {
          workspaceId: workspace.id,
          email,
          role: input.role,
          token: randomUUID(),
          invitedById: ctx.user.id,
        },
      });
      await log(ctx, workspace.id, "member.invited", "Invitation", invitation.id, { email });
      return invitation; // the UI shows the link /invite/<token>
    }),

  revokeInvite: protectedProcedure
    .input(z.object({ slug: z.string(), invitationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { workspace } = await guardWorkspace(ctx, input.slug, "member:manage");
      await ctx.db.invitation.updateMany({
        where: { id: input.invitationId, workspaceId: workspace.id },
        data: { status: "REVOKED" },
      });
      return { ok: true };
    }),

  // The invited person opens /invite/<token> and calls this
  acceptInvite: protectedProcedure.input(z.object({ token: z.string() })).mutation(async ({ ctx, input }) => {
    const invitation = await ctx.db.invitation.findUnique({
      where: { token: input.token },
      include: { workspace: true },
    });
    if (!invitation || invitation.status !== "PENDING") {
      throw new TRPCError({ code: "NOT_FOUND", message: "This invitation is no longer valid" });
    }
    if (invitation.email.toLowerCase() !== ctx.user.email.toLowerCase()) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `This invitation was sent to ${invitation.email}. Sign in with that email.`,
      });
    }
    await ctx.db.membership.upsert({
      where: { userId_workspaceId: { userId: ctx.user.id, workspaceId: invitation.workspaceId } },
      update: { role: invitation.role },
      create: { userId: ctx.user.id, workspaceId: invitation.workspaceId, role: invitation.role },
    });
    await ctx.db.invitation.update({ where: { id: invitation.id }, data: { status: "ACCEPTED" } });
    await log(ctx, invitation.workspaceId, "member.joined", "Membership", ctx.user.id);
    await notify(ctx.db, invitation.invitedById, {
      workspaceId: invitation.workspaceId,
      type: "member",
      title: `${ctx.user.name ?? ctx.user.email} joined ${invitation.workspace.name}`,
    });
    return { slug: invitation.workspace.slug };
  }),

  updateRole: protectedProcedure
    .input(z.object({ slug: z.string(), membershipId: z.string(), role: roleEnum }))
    .mutation(async ({ ctx, input }) => {
      const { workspace } = await guardWorkspace(ctx, input.slug, "member:manage");
      const target = await ctx.db.membership.findFirst({
        where: { id: input.membershipId, workspaceId: workspace.id },
      });
      if (!target) throw new TRPCError({ code: "NOT_FOUND" });
      if (target.role === "OWNER" || input.role === "OWNER") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "The Owner role cannot be changed here" });
      }
      await ctx.db.membership.update({ where: { id: target.id }, data: { role: input.role } });
      await log(ctx, workspace.id, "member.role_changed", "Membership", target.id, { role: input.role });
      return { ok: true };
    }),

  removeMember: protectedProcedure
    .input(z.object({ slug: z.string(), membershipId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { workspace } = await guardWorkspace(ctx, input.slug, "member:manage");
      const target = await ctx.db.membership.findFirst({
        where: { id: input.membershipId, workspaceId: workspace.id },
      });
      if (!target) throw new TRPCError({ code: "NOT_FOUND" });
      if (target.role === "OWNER") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "The Owner cannot be removed" });
      }
      await ctx.db.membership.delete({ where: { id: target.id } });
      await log(ctx, workspace.id, "member.removed", "Membership", target.id);
      return { ok: true };
    }),

  // ───── activity feed (the audit log, readable) ─────
  activity: protectedProcedure
    .input(z.object({ slug: z.string(), limit: z.number().min(1).max(200).default(50) }))
    .query(async ({ ctx, input }) => {
      const { workspace } = await guardWorkspace(ctx, input.slug, "workspace:read");
      const rows = await ctx.db.auditLog.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
      const users = await ctx.db.user.findMany({
        where: { id: { in: [...new Set(rows.map((r) => r.userId).filter((x): x is string => !!x))] } },
        select: { id: true, name: true, email: true },
      });
      const byId = new Map(users.map((u) => [u.id, u.name ?? u.email]));
      return rows.map((r) => ({ ...r, userName: r.userId ? byId.get(r.userId) ?? "Someone" : "System" }));
    }),
});
