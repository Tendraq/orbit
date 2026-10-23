import { api, findProject } from "@/server/public-api";
import { indicatorProgress } from "@/modules/ngo/indicators/service";
import { db } from "@orbit/db";

export const GET = api({}, async (c, _req, p) => {
  await findProject(c, p.id);
  const rows = await indicatorProgress(db, p.id);
  return {
    data: rows.map((i) => ({
      id: i.id, name: i.name, unit: i.unit, baseline: i.baseline, target: i.target, frequency: i.frequency,
      latestValue: i.latestValue, latestPeriod: i.latestPeriod, progressPercent: i.progressPct, logframeCode: i.logframeItem?.code ?? null,
    })),
  };
});
