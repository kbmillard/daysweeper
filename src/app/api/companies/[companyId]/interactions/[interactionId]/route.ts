import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// DELETE - Remove an interaction (must belong to the company)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ companyId: string; interactionId: string }> }
) {
  try {
    const { companyId, interactionId } = await params;

    const interaction = await prisma.companyInteraction.findFirst({
      where: { id: interactionId, companyId }
    });

    if (!interaction) {
      return NextResponse.json(
        { error: 'Interaction not found' },
        { status: 404 }
      );
    }

    await prisma.companyInteraction.delete({
      where: { id: interactionId }
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete interaction';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
