import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';

// Bins are global: all authenticated users see and edit the same list. No org/user scoping.

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await _req.json().catch(() => ({}));

    const displayName =
      typeof body.changedByDisplayName === 'string' &&
      body.changedByDisplayName.trim()
        ? body.changedByDisplayName.trim()
        : userId;

    const update: Prisma.WarehouseItemUpdateInput = {
      changedAt: new Date(),
      changedBy: displayName
    };
    if (body.partNumber !== undefined)
      update.partNumber = String(body.partNumber).trim();
    if (body.description !== undefined)
      update.description =
        body.description == null ? null : String(body.description);
    if (body.bin !== undefined)
      update.bin = body.bin == null ? null : String(body.bin);
    if (body.quantity !== undefined)
      update.quantity = Number(body.quantity) || 0;

    const item = await prisma.warehouseItem.update({
      where: { id },
      data: update
    });

    return NextResponse.json({
      ...item,
      price: item.price ? Number(item.price) : null
    });
  } catch (error: unknown) {
    console.error('Error updating bin:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to update bin';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await prisma.warehouseItem.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    console.error('Error deleting bin item:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to delete bin item';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
