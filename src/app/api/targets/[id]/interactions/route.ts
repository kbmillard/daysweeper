import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

const SHARED_USER_ID = 'shared';

async function resolveUserId(): Promise<string> {
  try {
    const result = await Promise.race([
      auth({ acceptsToken: ['session_token', 'oauth_token'] }).catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
    ]);
    return (result && 'userId' in result ? (result as { userId: string }).userId : null) ?? SHARED_USER_ID;
  } catch {
    return SHARED_USER_ID;
  }
}

/**
 * Find or create a Company record for a given Target.
 * Matches by exact company name (case-insensitive). Creates one if missing.
 */
async function getOrCreateCompanyForTarget(targetId: string): Promise<string | null> {
  const target = await prisma.target.findUnique({
    where: { id: targetId },
    select: { id: true, company: true, website: true, addressRaw: true }
  });
  if (!target) return null;

  // Try to find existing company by name
  const existing = await prisma.company.findFirst({
    where: { name: { equals: target.company, mode: 'insensitive' } },
    select: { id: true }
  });
  if (existing) return existing.id;

  // Create a new Company record linked to this target's data
  const created = await prisma.company.create({
    data: {
      id: crypto.randomUUID(),
      name: target.company,
      website: target.website ?? null,
      updatedAt: new Date()
    },
    select: { id: true }
  });
  return created.id;
}

/**
 * GET /api/targets/[id]/interactions
 * Returns CompanyInteractions for the company linked to this target.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const companyId = await getOrCreateCompanyForTarget(id);
    if (!companyId) {
      return NextResponse.json({ interactions: [] });
    }

    const rows = await prisma.companyInteraction.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return NextResponse.json({
      interactions: rows.map((r) => ({
        id: r.id,
        targetId: id,
        type: r.type,
        content: r.content,
        createdAt: r.createdAt.toISOString(),
        userId: r.userId
      }))
    });
  } catch (err) {
    console.error('GET interactions error:', err);
    return NextResponse.json({ interactions: [], error: String(err) }, { status: 500 });
  }
}

/**
 * POST /api/targets/[id]/interactions
 * Body: { type: string, content: string }
 * Creates a CompanyInteraction so it appears in the Daysweeper web UI.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const userId = await resolveUserId();
    const body = await req.json() as { type?: string; content?: string };

    const type = (body.type ?? 'note').trim();
    const content = (body.content ?? '').trim();

    if (!content) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const companyId = await getOrCreateCompanyForTarget(id);
    if (!companyId) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 });
    }

    const interaction = await prisma.companyInteraction.create({
      data: {
        companyId,
        type,
        content,
        userId: userId === SHARED_USER_ID ? null : userId
      }
    });

    return NextResponse.json({
      ok: true,
      interaction: {
        id: interaction.id,
        targetId: id,
        type: interaction.type,
        content: interaction.content,
        createdAt: interaction.createdAt.toISOString(),
        userId: interaction.userId
      }
    });
  } catch (err) {
    console.error('POST interaction error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/**
 * DELETE /api/targets/[id]/interactions?noteId=xxx
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await params;
  const { searchParams } = new URL(req.url);
  const noteId = searchParams.get('noteId');
  if (!noteId) return NextResponse.json({ error: 'noteId required' }, { status: 400 });

  try {
    await prisma.companyInteraction.delete({ where: { id: noteId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
