import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/slugify';
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const createNoteSchema = z.object({
  content: z.string().min(1),
  tags: z.array(z.string()).optional().default([])
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const notes = await prisma.targetNote.findMany({
      where: { targetId: id },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(notes);
  } catch (error) {
    console.error('Get notes error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notes' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = createNoteSchema.parse(body);

    // Normalize tags
    const normalizedTags = data.tags.map((tag) => slugify(tag)).filter(Boolean);

    // Get userId from Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const note = await prisma.targetNote.create({
      data: {
        targetId: id,
        content: data.content,
        tags: normalizedTags,
        userId
      }
    });

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Create note error:', error);
    return NextResponse.json(
      { error: 'Failed to create note' },
      { status: 500 }
    );
  }
}
