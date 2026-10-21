import type { PrismaClient } from "@orbit/db";

// Latest value and progress (baseline -> target) for each indicator.
export async function indicatorProgress(db: PrismaClient, projectId: string) {
  const indicators = await db.indicator.findMany({
    where: { projectId },
    include: {
      values: { orderBy: { periodStart: "desc" } },
      logframeItem: { select: { code: true, level: true, statement: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return indicators.map((i) => {
    const latest = i.values[0] ?? null;
    const span = i.target - i.baseline;
    const raw = latest ? (span === 0 ? 100 : ((latest.value - i.baseline) / span) * 100) : 0;
    return {
      ...i,
      latestValue: latest?.value ?? null,
      latestPeriod: latest?.period ?? null,
      progressPct: Math.max(0, Math.round(raw)),
      onTrack: raw >= 50,
    };
  });
}

// Average progress across indicators (each capped at 100)
export function averageProgress(rows: { progressPct: number }[]) {
  if (rows.length === 0) return null;
  return Math.round(rows.reduce((n, r) => n + Math.min(100, r.progressPct), 0) / rows.length);
}
