import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

// GET - Fetch all interactions for a company
export async function GET(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;

    const interactions = await prisma.companyInteraction.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    return NextResponse.json({ interactions });
  } catch (error: any) {
    // Table may not exist if migrations haven't run (e.g. new deploy)
    const isMissingTable =
      error?.code === 'P2021' || error?.message?.includes('does not exist');
    if (isMissingTable) {
      return NextResponse.json(
        { interactions: [], migrationsRequired: true },
        { status: 200 }
      );
    }
    return NextResponse.json(
      { error: error?.message ?? 'Failed to fetch interactions' },
      { status: 500 }
    );
  }
}

// POST - Create a new interaction
export async function POST(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { userId } = await auth();
    const { companyId } = await params;
    const body = await req.json();

    const { type, subject, content, duration, metadata } = body;

    if (!type || !content) {
      return NextResponse.json(
        { error: 'Type and content are required' },
        { status: 400 }
      );
    }

    // Verify company exists
    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    const interaction = await prisma.companyInteraction.create({
      data: {
        companyId,
        userId: userId || null,
        type,
        subject: subject || null,
        content,
        duration: duration || null,
        metadata: metadata || null
      }
    });

    return NextResponse.json({ interaction }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating interaction:', error);
    // Table may not exist if migrations haven't run
    const isMissingTable =
      error?.code === 'P2021' || error?.message?.includes('does not exist');
    if (isMissingTable) {
      return NextResponse.json(
        { error: 'migrations_required', migrationsRequired: true },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: error?.message ?? 'Failed to create interaction' },
      { status: 500 }
    );
  }
}
