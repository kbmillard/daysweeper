import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Move an existing location (from another company) to this company. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId: targetCompanyId } = await params;
    const body = await req.json();
    const { locationId } = body;

    if (typeof locationId !== 'string' || !locationId.trim()) {
      return NextResponse.json(
        { error: 'locationId is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    const [targetCompany, location] = await Promise.all([
      prisma.company.findUnique({ where: { id: targetCompanyId } }),
      prisma.location.findUnique({
        where: { id: locationId },
        select: { id: true, companyId: true }
      })
    ]);

    if (!targetCompany) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }
    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }
    if (location.companyId === targetCompanyId) {
      return NextResponse.json(
        { error: 'Location already belongs to this company' },
        { status: 400 }
      );
    }

    const sourceCompanyId = location.companyId;
    const now = new Date();
    await prisma.location.update({
      where: { id: locationId },
      data: { companyId: targetCompanyId, updatedAt: now }
    });

    // If the source company has no locations left, delete it so lead count decreases by 1
    const remainingLocations = await prisma.location.count({
      where: { companyId: sourceCompanyId }
    });
    if (remainingLocations === 0) {
      await prisma.company.updateMany({
        where: { parentCompanyDbId: sourceCompanyId },
        data: { parentCompanyDbId: null, updatedAt: now }
      });
      await prisma.company.delete({ where: { id: sourceCompanyId } });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to link location';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
