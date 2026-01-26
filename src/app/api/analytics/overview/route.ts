import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import dayjs from 'dayjs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '30d';
    
    // Calculate date range
    const days = range === '30d' ? 30 : range === '7d' ? 7 : 30;
    const startDate = dayjs().subtract(days, 'day').toDate();

    // Get card metrics
    const totalTargets = await prisma.target.count();
    const newLeads = await prisma.target.count({
      where: {
        createdAt: {
          gte: startDate
        }
      }
    });
    const accounts = await prisma.target.count({
      where: {
        accountState: 'ACCOUNT'
      }
    });
    const completionRate = 0; // TODO: implement when routes are added

    // Get state distribution
    const stateDistribution = await prisma.target.groupBy({
      by: ['accountState'],
      _count: {
        id: true
      }
    });

    // Get byDay data (empty for now, will be populated when visit data exists)
    const byDay: Array<{
      day: string;
      visited: number;
      noAnswer: number;
      wrongAddress: number;
      followUp: number;
    }> = [];

    return NextResponse.json({
      cards: {
        totalTargets,
        newLeads,
        accounts,
        completionRate
      },
      charts: {
        byDay,
        stateDistribution: stateDistribution.map((s) => ({
          state: s.accountState,
          count: s._count.id
        }))
      }
    });
  } catch (error) {
    console.error('Analytics overview error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
