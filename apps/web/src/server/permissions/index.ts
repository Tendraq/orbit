import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@orbit/db";
import { can, type Action } from "@/config/permissions";

export { can };
export type { Action };

/**
 * Checks the user belongs to the workspace AND may do the action.
 * Throws an error if not. Returns the workspace and the role.
 */
export async function requireWorkspaceAccess(
  db: PrismaClient,
  userId: string,
  where: { slug: string } | { id: string },
  action: Action
) {
  const workspace = await db.workspace.findFirst({
    where: { ...where, deletedAt: null },
    include: { memberships: { where: { userId } } },
  });

  const membership = workspace?.memberships[0];
  if (!workspace || !membership) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Workspace not found" });
  }
  if (!can(membership.role, action)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to do that" });
  }
  return { workspace, role: membership.role };
}
