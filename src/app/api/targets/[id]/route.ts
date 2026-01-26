import { prisma } from '@/lib/prisma';
import { listGroups, listSubtypes } from '@/taxonomy/automotive';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const updateTargetSchema = z.object({
  company: z.string().min(1).optional(),
  website: z.string().url().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  addressRaw: z.string().min(1).optional(),
  accountState: z.enum(['ACCOUNT', 'NEW_UNCONTACTED', 'NEW_CONTACTED_NO_ANSWER']).optional(),
  supplyTier: z.enum(['OEM', 'TIER_1', 'TIER_2', 'TIER_3', 'LOGISTICS_3PL', 'TOOLING_CAPITAL_EQUIPMENT', 'AFTERMARKET_SERVICES']).optional().nullable(),
  supplyGroup: z.string().optional().nullable(),
  supplySubtype: z.string().optional().nullable()
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const target = await prisma.target.findUnique({
      where: { id },
      include: {
        TargetNote: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!target) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 });
    }

    return NextResponse.json(target);
  } catch (error) {
    console.error('Get target error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch target' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = updateTargetSchema.parse(body);

    // Validate taxonomy
    if (data.supplyTier) {
      if (data.supplyTier === 'TIER_1') {
        if (data.supplyGroup) {
          const validGroups = listGroups('Tier_1');
          if (!validGroups.includes(data.supplyGroup)) {
            return NextResponse.json(
              { error: `Invalid supplyGroup for TIER_1. Must be one of: ${validGroups.join(', ')}` },
              { status: 400 }
            );
          }
          if (data.supplySubtype) {
            const validSubtypes = listSubtypes('Tier_1', data.supplyGroup);
            if (!validSubtypes.includes(data.supplySubtype)) {
              return NextResponse.json(
                { error: `Invalid supplySubtype for group ${data.supplyGroup}` },
                { status: 400 }
              );
            }
          }
        }
      } else {
        // For other tiers, validate subtype if provided
        if (data.supplySubtype) {
          const validSubtypes = listSubtypes(data.supplyTier as any);
          if (!validSubtypes.includes(data.supplySubtype)) {
            return NextResponse.json(
              { error: `Invalid supplySubtype for tier ${data.supplyTier}` },
              { status: 400 }
            );
          }
        }
        // Allow "General" or null for group
        if (data.supplyGroup && data.supplyGroup !== 'General') {
          return NextResponse.json(
            { error: 'supplyGroup must be "General" or null for non-Tier_1 tiers' },
            { status: 400 }
          );
        }
      }
    }

    const target = await prisma.target.update({
      where: { id },
      data
    });

    return NextResponse.json(target);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Update target error:', error);
    return NextResponse.json(
      { error: 'Failed to update target' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.target.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete target error:', error);
    return NextResponse.json(
      { error: 'Failed to delete target' },
      { status: 500 }
    );
  }
}
