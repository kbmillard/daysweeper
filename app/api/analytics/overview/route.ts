import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const daysParam = url.searchParams.get("range") ?? "30d";
  const days = Number(daysParam.replace("d", "")) || 30;
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  const [totalTargets, newLeads, accounts] = await Promise.all([
    prisma.target.count(),
    prisma.target.count({ where: { createdAt: { gte: from } } }),
    prisma.target.count({ where: { accountState: "ACCOUNT" } }),
  ]);

  const outcomeRows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT date("visitedAt") as day,
      sum(CASE WHEN outcome='VISITED' THEN 1 ELSE 0 END)   as visited,
      sum(CASE WHEN outcome='NO_ANSWER' THEN 1 ELSE 0 END) as no_answer,
      sum(CASE WHEN outcome='WRONG_ADDRESS' THEN 1 ELSE 0 END) as wrong_address,
      sum(CASE WHEN outcome='FOLLOW_UP' THEN 1 ELSE 0 END) as follow_up
    FROM "RouteStop"
    WHERE "visitedAt" IS NOT NULL
      AND "visitedAt" BETWEEN '${from.toISOString()}' AND '${to.toISOString()}'
    GROUP BY day
    ORDER BY day ASC
  `);

  const visited = outcomeRows.reduce((n, r) => n + Number(r.visited || 0), 0);
  const other = outcomeRows.reduce((n, r) => n + Number(r.no_answer || 0) + Number(r.wrong_address || 0) + Number(r.follow_up || 0), 0);
  const denom = visited + other;
  const completionRate = denom === 0 ? 0 : visited / denom;

  const stateCounts = await prisma.target.groupBy({
    by: ["accountState"],
    _count: { _all: true },
  });

  return NextResponse.json({
    cards: { totalTargets, newLeads, accounts, completionRate },
    charts: {
      byDay: outcomeRows.map(r => ({
        day: r.day,
        visited: Number(r.visited || 0),
        noAnswer: Number(r.no_answer || 0),
        wrongAddress: Number(r.wrong_address || 0),
        followUp: Number(r.follow_up || 0),
      })),
      stateDistribution: stateCounts.map(s => ({ state: s.accountState, count: s._count._all })),
    },
  });
}
