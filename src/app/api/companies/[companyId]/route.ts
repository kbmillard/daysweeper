import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isValidStatus, normalizeStatus } from '@/constants/company-status';
import {
  isCompanyPrimarySyncSuppressed,
  mergePrimaryLocationMirrorMetadata
} from '@/lib/location-primary-sync-metadata';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, website: true, phone: true, email: true }
    });
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }
    return NextResponse.json({ company });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch company';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - Delete a company
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    await prisma.company.delete({ where: { id: companyId } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: error?.message ?? 'Failed to delete company' },
      { status: 500 }
    );
  }
}

// PATCH - Update company (e.g. status)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const body = await req.json();

    const { status, parentCompanyId, primaryLocationId, name, website, phone, email, productType } =
      body;

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return NextResponse.json(
          { error: 'name must be a non-empty string' },
          { status: 400 }
        );
      }
    }
    if (website !== undefined && website !== null && typeof website !== 'string') {
      return NextResponse.json({ error: 'website must be a string or null' }, { status: 400 });
    }
    if (phone !== undefined && phone !== null && typeof phone !== 'string') {
      return NextResponse.json({ error: 'phone must be a string or null' }, { status: 400 });
    }
    if (email !== undefined && email !== null && typeof email !== 'string') {
      return NextResponse.json({ error: 'email must be a string or null' }, { status: 400 });
    }

    if (productType !== undefined && productType !== null && typeof productType !== 'string') {
      return NextResponse.json(
        { error: 'productType must be a string or null' },
        { status: 400 }
      );
    }

    if (status !== undefined && status !== null) {
      if (typeof status !== 'string' || (status !== '' && !isValidStatus(status))) {
        return NextResponse.json(
          { error: 'Invalid status. Use one of: Contacted - no answer, Contacted - not interested, Contacted - meeting set, Account' },
          { status: 400 }
        );
      }
    }

    let parentRecordForLink: { externalId: string | null } | null = null;
    if (parentCompanyId !== undefined) {
      if (parentCompanyId !== null && typeof parentCompanyId !== 'string') {
        return NextResponse.json(
          { error: 'parentCompanyId must be a string or null' },
          { status: 400 }
        );
      }
      if (parentCompanyId) {
        const parent = await prisma.company.findUnique({
          where: { id: parentCompanyId },
          select: { id: true, externalId: true }
        });
        if (!parent) {
          return NextResponse.json(
            { error: 'Parent company not found' },
            { status: 404 }
          );
        }
        if (parent.id === companyId) {
          return NextResponse.json(
            { error: 'Company cannot be its own parent' },
            { status: 400 }
          );
        }
        parentRecordForLink = parent;
      }
    }

    if (primaryLocationId !== undefined) {
      if (primaryLocationId !== null && typeof primaryLocationId !== 'string') {
        return NextResponse.json(
          { error: 'primaryLocationId must be a string or null' },
          { status: 400 }
        );
      }
      if (primaryLocationId) {
        const loc = await prisma.location.findFirst({
          where: { id: primaryLocationId, companyId }
        });
        if (!loc) {
          return NextResponse.json(
            { error: 'Location not found or does not belong to this company' },
            { status: 404 }
          );
        }
      }
    }

    let mergedMetadata: Record<string, unknown> | undefined;
    if (productType !== undefined) {
      const current = await prisma.company.findUnique({
        where: { id: companyId },
        select: { metadata: true }
      });
      const raw = current?.metadata;
      const base =
        raw && typeof raw === 'object' && !Array.isArray(raw)
          ? { ...(raw as Record<string, unknown>) }
          : {};
      if (productType === null || (typeof productType === 'string' && productType.trim() === '')) {
        delete base.productType;
      } else {
        base.productType = (productType as string).trim();
      }
      mergedMetadata = base;
    }

    const company = await prisma.company.update({
      where: { id: companyId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(website !== undefined && { website: website === '' ? null : website?.trim() ?? null }),
        ...(phone !== undefined && { phone: phone === '' ? null : phone?.trim() ?? null }),
        ...(email !== undefined && { email: email === '' ? null : email?.trim() ?? null }),
        ...(status !== undefined && { status: status === '' ? null : normalizeStatus(status) }),
        ...(parentCompanyId !== undefined && {
          parentCompanyDbId:
            parentCompanyId === '' || parentCompanyId === null ? null : parentCompanyId,
          externalParentId:
            parentCompanyId === '' || parentCompanyId === null
              ? null
              : (parentRecordForLink?.externalId ?? null)
        }),
        ...(primaryLocationId !== undefined && {
          primaryLocationId: primaryLocationId === '' || primaryLocationId === null ? null : primaryLocationId
        }),
        ...(mergedMetadata !== undefined && {
          metadata: mergedMetadata as Prisma.InputJsonValue
        }),
        updatedAt: new Date()
      }
    });

    const newPrimaryId =
      typeof primaryLocationId === 'string' && primaryLocationId.trim() !== ''
        ? primaryLocationId.trim()
        : null;

    if (newPrimaryId) {
      const loc = await prisma.location.findFirst({
        where: { id: newPrimaryId, companyId },
        select: { id: true, metadata: true }
      });
      if (loc) {
        await prisma.location.update({
          where: { id: newPrimaryId },
          data: {
            locationName: company.name,
            phone: company.phone,
            website: company.website,
            email: company.email,
            metadata: mergePrimaryLocationMirrorMetadata(loc.metadata, company, {
              clearSuppress: true
            }) as Prisma.InputJsonValue,
            updatedAt: new Date()
          }
        });
      }
    } else if (
      company.primaryLocationId &&
      (name !== undefined ||
        website !== undefined ||
        phone !== undefined ||
        email !== undefined ||
        status !== undefined ||
        mergedMetadata !== undefined)
    ) {
      const plId = company.primaryLocationId as string;
      const loc = await prisma.location.findFirst({
        where: { id: plId, companyId },
        select: { id: true, metadata: true }
      });
      if (loc && !isCompanyPrimarySyncSuppressed(loc.metadata)) {
        await prisma.location.update({
          where: { id: plId },
          data: {
            locationName: company.name,
            phone: company.phone,
            website: company.website,
            email: company.email,
            metadata: mergePrimaryLocationMirrorMetadata(loc.metadata, company, {
              clearSuppress: false
            }) as Prisma.InputJsonValue,
            updatedAt: new Date()
          }
        });
      }
    }

    return NextResponse.json({ company });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: error?.message ?? 'Failed to update company' },
      { status: 500 }
    );
  }
}
