import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const createTargetSchema = z.object({
  company: z.string().min(1),
  website: z.string().url().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  addressRaw: z.string().min(1),
  accountState: z.enum(['ACCOUNT', 'NEW_UNCONTACTED', 'NEW_CONTACTED_NO_ANSWER']).optional(),
  supplyTier: z.enum(['OEM', 'TIER_1', 'TIER_2', 'TIER_3', 'LOGISTICS_3PL', 'TOOLING_CAPITAL_EQUIPMENT', 'AFTERMARKET_SERVICES']).optional().nullable(),
  supplyGroup: z.string().optional().nullable(),
  supplySubtype: z.string().optional().nullable()
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const state = searchParams.get('state');
    const tier = searchParams.get('tier');
    const group = searchParams.get('group');
    const subtype = searchParams.get('subtype');
    const tags = searchParams.getAll('tags');

    const where: any = {};

    if (q) {
      where.company = {
        contains: q,
        mode: 'insensitive'
      };
    }

    if (state) {
      where.accountState = state;
    }

    if (tier) {
      where.supplyTier = tier;
    }

    if (group) {
      where.supplyGroup = group;
    }

    if (subtype) {
      where.supplySubtype = subtype;
    }

    if (tags.length > 0) {
      where.TargetNote = {
        some: {
          tags: {
            hasSome: tags
          }
        }
      };
    }

    const targets = await prisma.target.findMany({
      where,
      include: {
        TargetNote: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 10
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 200
    });

    return NextResponse.json(targets);
  } catch (error) {
    console.error('Get targets error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch targets' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = createTargetSchema.parse(body);

    const target = await prisma.target.create({
      data: {
        company: data.company,
        website: data.website ?? null,
        phone: data.phone ?? null,
        email: data.email ?? null,
        addressRaw: data.addressRaw,
        accountState: data.accountState ?? 'NEW_UNCONTACTED',
        supplyTier: data.supplyTier ?? null,
        supplyGroup: data.supplyGroup ?? null,
        supplySubtype: data.supplySubtype ?? null
      } as any
    });

    return NextResponse.json(target, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Create target error:', error);
    return NextResponse.json(
      { error: 'Failed to create target' },
      { status: 500 }
    );
  }
}
