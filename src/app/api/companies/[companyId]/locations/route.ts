import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const body = await req.json();
    const { addressRaw } = body;

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
    const location = await prisma.location.create({
      data: {
        id,
        companyId,
        addressRaw: addressRaw.trim(),
        updatedAt: now
      }
    });

    return NextResponse.json({ location });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create location';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
