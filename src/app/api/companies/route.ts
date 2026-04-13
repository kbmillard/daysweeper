import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim();
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 500);
    const tokens = search
      ? search.split(/\s+/).filter((t) => t.length > 0)
      : [];
    const companies = await prisma.company.findMany({
      where: search
        ? {
            hidden: false,
            AND: tokens.map((t) => ({
              name: { contains: t, mode: 'insensitive' as const }
            }))
          }
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
    const {
      name,
      parentCompanyId,
      website,
      phone,
      addressRaw,
      latitude,
      longitude,
      removeLocationId,
      removeFromCompanyId
    } = body;

    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'name is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    let parentExternalForCreate: string | null = null;
    if (parentCompanyId != null) {
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
      parentExternalForCreate = parent.externalId ?? null;
    }

    const hasAddress =
      typeof addressRaw === 'string' && addressRaw.trim().length > 0;

    let lat: number | undefined;
    let lng: number | undefined;
    if (latitude !== undefined && latitude !== null && latitude !== '') {
      lat = Number(latitude);
      if (Number.isNaN(lat) || lat < -90 || lat > 90) {
        return NextResponse.json(
          { error: 'latitude must be between -90 and 90' },
          { status: 400 }
        );
      }
    }
    if (longitude !== undefined && longitude !== null && longitude !== '') {
      lng = Number(longitude);
      if (Number.isNaN(lng) || lng < -180 || lng > 180) {
        return NextResponse.json(
          { error: 'longitude must be between -180 and 180' },
          { status: 400 }
        );
      }
    }

    const hasRemove =
      removeLocationId != null &&
      removeFromCompanyId != null &&
      typeof removeLocationId === 'string' &&
      typeof removeFromCompanyId === 'string' &&
      removeLocationId.trim() !== '' &&
      removeFromCompanyId.trim() !== '';
    if (
      (removeLocationId != null || removeFromCompanyId != null) &&
      !hasRemove
    ) {
      return NextResponse.json(
        { error: 'removeLocationId and removeFromCompanyId must be sent together' },
        { status: 400 }
      );
    }

    const now = new Date();
    const id = crypto.randomUUID();

    await prisma.$transaction(async (tx) => {
      await tx.company.create({
        data: {
          id,
          name: name.trim(),
          updatedAt: now,
          ...(parentCompanyId && {
            parentCompanyDbId: parentCompanyId,
            externalParentId: parentExternalForCreate
          }),
          ...(typeof website === 'string' && { website: website.trim() || null }),
          ...(typeof phone === 'string' && { phone: phone.trim() || null })
        }
      });

      if (hasAddress) {
        const locId = crypto.randomUUID();
        await tx.location.create({
          data: {
            id: locId,
            companyId: id,
            addressRaw: String(addressRaw).trim(),
            updatedAt: now,
            locationName: name.trim(),
            ...(typeof phone === 'string' && phone.trim() && { phone: phone.trim() }),
            ...(typeof website === 'string' && website.trim() && { website: website.trim() }),
            ...(lat !== undefined && { latitude: lat }),
            ...(lng !== undefined && { longitude: lng })
          }
        });
        await tx.company.update({
          where: { id },
          data: { primaryLocationId: locId }
        });
      }

      if (hasRemove) {
        const rid = String(removeLocationId).trim();
        const rfc = String(removeFromCompanyId).trim();
        const loc = await tx.location.findUnique({ where: { id: rid } });
        if (!loc || loc.companyId !== rfc) {
          throw new Error('Source location not found or does not belong to the source company');
        }
        const sourceCo = await tx.company.findUnique({ where: { id: rfc } });
        await tx.location.delete({ where: { id: rid } });
        if (sourceCo?.primaryLocationId === rid) {
          const nextPrimary = await tx.location.findFirst({
            where: { companyId: rfc },
            orderBy: { updatedAt: 'desc' }
          });
          await tx.company.update({
            where: { id: rfc },
            data: {
              primaryLocationId: nextPrimary?.id ?? null,
              updatedAt: now
            }
          });
        }
      }
    });

    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) {
      return NextResponse.json({ error: 'Company not found after create' }, { status: 500 });
    }

    return NextResponse.json({ company });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create company';
    if (message.includes('Source location not found')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
