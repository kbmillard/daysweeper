import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim();
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 500);
    const companies = await prisma.company.findMany({
      where: search
        ? { hidden: false, name: { contains: search, mode: 'insensitive' } }
        : { hidden: false },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: limit
    });
    return NextResponse.json({ companies });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to list companies';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, parentCompanyId, website, phone } = body;

    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'name is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    if (parentCompanyId != null) {
      const parent = await prisma.company.findUnique({
        where: { id: parentCompanyId }
      });
      if (!parent) {
        return NextResponse.json(
          { error: 'Parent company not found' },
          { status: 404 }
        );
      }
    }

    const now = new Date();
    const id = crypto.randomUUID();
    const company = await prisma.company.create({
      data: {
        id,
        name: name.trim(),
        updatedAt: now,
        ...(parentCompanyId && { parentCompanyDbId: parentCompanyId }),
        ...(typeof website === 'string' && { website: website.trim() || null }),
        ...(typeof phone === 'string' && { phone: phone.trim() || null })
      }
    });

    return NextResponse.json({ company });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create company';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
