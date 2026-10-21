import type { Prisma, PrismaClient } from "@orbit/db";

type AuditEntry = {
  workspaceId?: string;
  userId?: string;
  action: string; // e.g. "task.created"
  entityType: string; // e.g. "Task"
  entityId: string;
  metadata?: Prisma.InputJsonValue;
};

/** Records who did what. Call this after every important change. */
export async function writeAudit(db: PrismaClient, entry: AuditEntry) {
  await db.auditLog.create({ data: entry });
}
