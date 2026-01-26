import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const replaceStopsSchema = z.object({
  targetIds: z.array(z.string())
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: routeId } = await params;
    const body = await request.json();
    const data = replaceStopsSchema.parse(body);

    // Verify route exists
    const route = await prisma.route.findUnique({
      where: { id: routeId }
    });

    if (!route) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    }

    // Transaction: delete existing stops, then create new ones
    await prisma.$transaction(async (tx) => {
      await tx.routeStop.deleteMany({
        where: { routeId }
      });

      if (data.targetIds.length > 0) {
        await tx.routeStop.createMany({
          data: data.targetIds.map((targetId, index) => ({
            routeId,
            targetId,
            seq: index + 1
          }))
        });
      }
    });

    // Return updated route with stops
    const updatedRoute = await prisma.route.findUnique({
      where: { id: routeId },
      include: {
        stops: {
          orderBy: { seq: 'asc' },
          include: {
            target: {
              select: {
                id: true,
                company: true,
                addressRaw: true,
                website: true,
                phone: true,
                email: true
              }
            }
          }
        }
      }
    });

    return NextResponse.json(updatedRoute);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Replace stops error:', error);
    return NextResponse.json(
      { error: 'Failed to replace stops' },
      { status: 500 }
    );
  }
}
