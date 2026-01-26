import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
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

    // Get outcome data from RouteStop for completion rate and byDay chart
    const outcomeRows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT date("visitedAt") as day,
        sum(CASE WHEN outcome='VISITED' THEN 1 ELSE 0 END) as visited,
        sum(CASE WHEN outcome='NO_ANSWER' THEN 1 ELSE 0 END) as no_answer,
        sum(CASE WHEN outcome='WRONG_ADDRESS' THEN 1 ELSE 0 END) as wrong_address,
        sum(CASE WHEN outcome='FOLLOW_UP' THEN 1 ELSE 0 END) as follow_up
      FROM "RouteStop"
      WHERE "visitedAt" IS NOT NULL
        AND "visitedAt" >= '${from.toISOString()}'
      GROUP BY date("visitedAt")
      ORDER BY day ASC
    `);

    const visited = outcomeRows.reduce((n: number, r: any) => n + Number(r.visited || 0), 0);
    const other = outcomeRows.reduce(
      (n: number, r: any) => 
        n + Number(r.no_answer || 0) + Number(r.wrong_address || 0) + Number(r.follow_up || 0), 
      0
    );
    const denom = visited + other;
    const completionRate = denom === 0 ? 0 : visited / denom;

    // Get state distribution
    const stateCounts = await prisma.target.groupBy({
      by: ["accountState"],
      _count: { _all: true },
    });

    // Map byDay data from outcome rows
    const byDay = outcomeRows.map((r: any) => ({
      day: r.day,
      visited: Number(r.visited || 0),
      noAnswer: Number(r.no_answer || 0),
      wrongAddress: Number(r.wrong_address || 0),
      followUp: Number(r.follow_up || 0),
    }));

    return NextResponse.json({
      cards: { totalTargets, newLeads, accounts, completionRate },
      charts: {
        byDay,
        stateDistribution: stateCounts.map(s => ({ state: s.accountState, count: s._count._all })),
      },
    });
  } catch (error) {
    console.error('Analytics overview error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
