import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';

// Bins are global: all authenticated users see and edit the same list. No org/user scoping.

function withPrice(item: { price: unknown }) {
  return {
    ...item,
    price: item.price != null ? Number(item.price) : null
  };
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const items = await prisma.warehouseItem.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 5000
    });

    return NextResponse.json(items.map(withPrice));
  } catch (error: unknown) {
    console.error('Error fetching bins:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to fetch bins';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const partNumber =
      typeof body.partNumber === 'string' ? body.partNumber.trim() : '';
    if (!partNumber) {
      return NextResponse.json(
        { error: 'partNumber is required' },
        { status: 400 }
      );
    }

    const bin = typeof body.bin === 'string' ? body.bin.trim() : '';
    const now = new Date();
    const changedBy =
      typeof body.changedByDisplayName === 'string' &&
      body.changedByDisplayName.trim()
        ? body.changedByDisplayName.trim()
        : userId;

    const item = await prisma.warehouseItem.create({
      data: {
        partNumber,
        bin: bin || null,
        description:
          typeof body.description === 'string'
            ? body.description.trim() || null
            : null,
        quantity:
          typeof body.quantity === 'number' && Number.isFinite(body.quantity)
            ? body.quantity
            : 0,
        changedAt: now,
        changedBy,
        createdAt: now,
        updatedAt: now
      }
    });

    return NextResponse.json(withPrice(item));
  } catch (error: unknown) {
    console.error('Error creating bin item:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to create bin item';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE /api/bins — clear all bins (WarehouseItem rows). */
export async function DELETE() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const r = await prisma.warehouseItem.deleteMany({});
    return NextResponse.json({ deleted: r.count });
  } catch (error: unknown) {
    console.error('Error clearing bins:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to clear bins';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
