import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const createRouteSchema = z.object({
  name: z.string().min(1),
  assignedToUserId: z.string().optional().nullable(),
  scheduledFor: z.string().datetime().optional().nullable()
});

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const assignedTo = searchParams.get('assignedTo');

    const where: any = {};
    if (assignedTo === 'me') {
      where.assignedToUserId = userId;
    }

    const routes = await prisma.route.findMany({
      where,
      include: {
        _count: {
          select: { stops: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(routes);
  } catch (error) {
    console.error('Get routes error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch routes' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const data = createRouteSchema.parse(body);

    const route = await prisma.route.create({
      data: {
        name: data.name,
        assignedToUserId: data.assignedToUserId || userId,
        scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : null
      },
      include: {
        _count: {
          select: { stops: true }
        }
      }
    });

    return NextResponse.json(route, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Create route error:', error);
    return NextResponse.json(
      { error: 'Failed to create route' },
      { status: 500 }
    );
  }
}
