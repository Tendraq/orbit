import { db } from "@orbit/db";
import { api, paging, projectJson } from "@/server/public-api";

export const GET = api({}, async (c, req) => {
  const { limit, offset } = paging(req);
  const rows = await db.project.findMany({
    where: { workspaceId: c.workspaceId, deletedAt: null }, orderBy: { createdAt: "desc" }, take: limit, skip: offset,
  });
  return { data: rows.map(projectJson) };
});
