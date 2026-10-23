import { z } from "zod";
import { db } from "@orbit/db";
import { ApiError, api, readJson } from "@/server/public-api";
import { writeAudit } from "@/server/audit";

const body = z.object({
  period: z.string().min(2).max(30),                      // e.g. "2026-Q1"
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}/).refine((s) => !Number.isNaN(Date.parse(s))),
  value: z.number(),
  disaggregation: z.record(z.number()).optional(),         // e.g. {"female": 120, "male": 80}
  note: z.string().max(1000).optional(),
});

async function load(workspaceId: string, id: string) {
  const i = await db.indicator.findFirst({ where: { id, project: { workspaceId, deletedAt: null } } });
  if (!i) throw new ApiError(404, "not_found", "Indicator not found.");
  return i;
}

export const GET = api({}, async (c, _req, p) => {
  await load(c.workspaceId, p.id);
  const rows = await db.indicatorValue.findMany({ where: { indicatorId: p.id }, orderBy: { periodStart: "desc" }, take: 500 });
  return { data: rows.map((v) => ({ id: v.id, period: v.period, periodStart: v.periodStart, value: v.value, disaggregation: v.disaggregation, note: v.note })) };
});

// For field-data tools (Kobo, ODK, Power Automate, Zapier): push a result into an indicator.
export const POST = api({ write: true }, async (c, req, p) => {
  await load(c.workspaceId, p.id);
  const b = body.parse(await readJson(req));
  const v = await db.indicatorValue.create({
    data: { indicatorId: p.id, period: b.period, periodStart: new Date(b.periodStart.slice(0, 10) + "T00:00:00Z"), value: b.value, disaggregation: b.disaggregation, note: b.note, recordedById: c.createdById },
  });
  await writeAudit(db, { workspaceId: c.workspaceId, action: "indicator.value_added", entityType: "IndicatorValue", entityId: v.id, metadata: { via: "api", key: c.keyPrefix } });
  return { data: { id: v.id, period: v.period, value: v.value } };
});
