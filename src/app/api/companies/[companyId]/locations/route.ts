import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const locations = await prisma.location.findMany({
      where: { companyId },
      select: { id: true, addressRaw: true },
      orderBy: { createdAt: 'asc' }
    });
    return NextResponse.json({ locations });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to list locations';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const body = await req.json();
    const { addressRaw, latitude, longitude } = body;

    if (typeof addressRaw !== 'string' || !addressRaw.trim()) {
      return NextResponse.json(
        { error: 'addressRaw is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const now = new Date();
    const id = crypto.randomUUID();

    const lat =
      latitude !== undefined && latitude !== null && latitude !== ''
        ? Number(latitude)
        : undefined;
    const lng =
      longitude !== undefined && longitude !== null && longitude !== ''
        ? Number(longitude)
        : undefined;
    if (lat !== undefined && (Number.isNaN(lat) || lat < -90 || lat > 90)) {
      return NextResponse.json(
        { error: 'latitude must be between -90 and 90' },
        { status: 400 }
      );
    }
    if (lng !== undefined && (Number.isNaN(lng) || lng < -180 || lng > 180)) {
      return NextResponse.json(
        { error: 'longitude must be between -180 and 180' },
        { status: 400 }
      );
    }

    const location = await prisma.location.create({
      data: {
        id,
        companyId,
        addressRaw: addressRaw.trim(),
        updatedAt: now,
        ...(lat !== undefined && { latitude: lat }),
        ...(lng !== undefined && { longitude: lng })
      }
    });

    return NextResponse.json({ location });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create location';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
