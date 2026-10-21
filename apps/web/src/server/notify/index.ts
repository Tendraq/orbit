import type { PrismaClient } from "@orbit/db";

type Payload = {
  workspaceId?: string;
  type: string; // "assigned" | "comment" | "gate" | "change" ...
  title: string;
  body?: string;
  link?: string;
};

/** Sends an in-app notification to one person. */
export async function notify(db: PrismaClient, userId: string | null | undefined, p: Payload) {
  if (!userId) return;
  await db.notification.create({ data: { userId, ...p } });
}

/** Sends the same notification to several people. */
export async function notifyMany(db: PrismaClient, userIds: string[], p: Payload) {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return;
  await db.notification.createMany({ data: unique.map((userId) => ({ userId, ...p })) });
}

/** Ids of the owners and admins of a workspace (the approvers). */
export async function approverIds(db: PrismaClient, workspaceId: string) {
  const rows = await db.membership.findMany({
    where: { workspaceId, role: { in: ["OWNER", "ADMIN"] } },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}
