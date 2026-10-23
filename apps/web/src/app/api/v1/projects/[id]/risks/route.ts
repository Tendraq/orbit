import { api, findProject } from "@/server/public-api";
import { db } from "@orbit/db";

export const GET = api({}, async (c, _req, p) => {
  await findProject(c, p.id);
  const rows = await db.risk.findMany({ where: { projectId: p.id }, orderBy: { createdAt: "asc" } });
  return {
    data: rows.map((r) => ({ id: r.id, title: r.title, probability: r.probability, impact: r.impact, score: r.probability * r.impact, status: r.status, response: r.response })),
  };
});
