export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseLocationMetadata } from '@/lib/location-primary-sync-metadata';
import { isValidStatus, normalizeStatus } from '@/constants/company-status';

/**
 * PATCH - Update location fields. Use the Apple (CLGeocoder) script or LastLeg
 * to geocode addresses; run geocode:apple to populate coordinates.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    const { locationId } = await params;
    const body = await req.json();

    const {
      addressRaw,
      addressNormalized,
      externalId,
      addressComponents,
      latitude,
      longitude,
      locationName,
      phone,
      email,
      website,
      status,
      productType,
      userTookOwnershipOfPrimaryFields
    } = body;

    const wantsMetadataRead =
      userTookOwnershipOfPrimaryFields === true ||
      status !== undefined ||
      productType !== undefined;

    let mergedMetadata: Prisma.InputJsonValue | undefined;
    if (wantsMetadataRead) {
      const existing = await prisma.location.findUnique({
        where: { id: locationId },
        select: { metadata: true, companyId: true }
      });
      if (!existing) {
        return NextResponse.json({ error: 'Location not found' }, { status: 404 });
      }
      const parent = await prisma.company.findUnique({
        where: { id: existing.companyId },
        select: { primaryLocationId: true }
      });
      const isPrimaryLocation = parent?.primaryLocationId === locationId;

      const applyStatus = status !== undefined && !isPrimaryLocation;
      const applyProductType = productType !== undefined && !isPrimaryLocation;
      const needsMetadataMerge =
        userTookOwnershipOfPrimaryFields === true || applyStatus || applyProductType;

      if (needsMetadataMerge) {
        const m = parseLocationMetadata(existing.metadata);
        if (userTookOwnershipOfPrimaryFields === true) {
          m.suppressCompanyPrimarySync = true;
        }
        if (applyStatus) {
          if (status === null || status === '') {
            delete m.status;
          } else {
            if (typeof status !== 'string' || !isValidStatus(status)) {
              return NextResponse.json(
                {
                  error:
                    'Invalid status. Use one of: Contacted - no answer, Contacted - not interested, Contacted - meeting set, Account'
                },
                { status: 400 }
              );
            }
            const ns = normalizeStatus(status);
            if (ns) m.status = ns;
            else delete m.status;
          }
        }
        if (applyProductType) {
          if (productType === null || (typeof productType === 'string' && productType.trim() === '')) {
            delete m.productType;
          } else if (typeof productType === 'string') {
            m.productType = productType.trim();
          } else {
            return NextResponse.json(
              { error: 'productType must be a string or null' },
              { status: 400 }
            );
          }
        }
        mergedMetadata = m as Prisma.InputJsonValue;
      }
    }

    const data: Record<string, unknown> = {
      updatedAt: new Date()
    };

    if (addressRaw !== undefined) {
      if (typeof addressRaw !== 'string') {
        return NextResponse.json(
          { error: 'addressRaw must be a string' },
          { status: 400 }
        );
      }
      const trimmed = addressRaw.trim();
      if (!trimmed) {
        return NextResponse.json(
          { error: 'addressRaw cannot be empty' },
          { status: 400 }
        );
      }
      data.addressRaw = trimmed;
    }

    if (addressNormalized !== undefined) {
      const v = typeof addressNormalized === 'string' ? addressNormalized.trim() : '';
      if (v) data.addressNormalized = v;
      else if (addressNormalized === null) data.addressNormalized = null;
    }

    if (externalId !== undefined) {
      data.externalId =
        typeof externalId === 'string' && externalId.trim()
          ? externalId.trim()
          : null;
    }

    if (addressComponents !== undefined) {
      if (addressComponents !== null && typeof addressComponents !== 'object') {
        return NextResponse.json(
          { error: 'addressComponents must be an object or null' },
          { status: 400 }
        );
      }
      // Only overwrite geocoded components if body has meaningful data
      const ac = addressComponents as Record<string, string> | null;
      const hasValues =
        ac &&
        typeof ac === 'object' &&
        [ac.city, ac.state, ac.postal_code, ac.country].some((v) => v && String(v).trim());
      if (hasValues || addressComponents === null) {
        data.addressComponents = addressComponents;
      }
    }

    if (latitude !== undefined) {
      const n = Number(latitude);
      if (Number.isNaN(n) || n < -90 || n > 90) {
        return NextResponse.json(
          { error: 'latitude must be a number between -90 and 90' },
          { status: 400 }
        );
      }
      data.latitude = n;
    }

    if (longitude !== undefined) {
      const n = Number(longitude);
      if (Number.isNaN(n) || n < -180 || n > 180) {
        return NextResponse.json(
          { error: 'longitude must be a number between -180 and 180' },
          { status: 400 }
        );
      }
      data.longitude = n;
    }

    const contactData: Record<string, unknown> = {};
    if (locationName !== undefined) {
      contactData.locationName = typeof locationName === 'string' && locationName.trim() ? locationName.trim() : null;
    }
    if (phone !== undefined) {
      contactData.phone = typeof phone === 'string' && phone.trim() ? phone.trim() : null;
    }
    if (email !== undefined) {
      contactData.email = typeof email === 'string' && email.trim() ? email.trim() : null;
    }
    if (website !== undefined) {
      contactData.website = typeof website === 'string' && website.trim() ? website.trim() : null;
    }

    const hasContactFields = Object.keys(contactData).length > 0;
    const fullData = hasContactFields ? { ...data, ...contactData } : data;

    if (mergedMetadata !== undefined) {
      (fullData as Record<string, unknown>).metadata = mergedMetadata;
    }

    let location;
    try {
      location = await prisma.location.update({
        where: { id: locationId },
        data: fullData as Parameters<typeof prisma.location.update>[0]['data']
      });
    } catch (updateError: any) {
      const msg = String(updateError?.message ?? '') + String(JSON.stringify(updateError ?? ''));
      const isColumnMissing =
        msg.includes('does not exist') ||
        msg.includes('(not available)') ||
        msg.includes('Unknown column');
      if (isColumnMissing && hasContactFields) {
        try {
          location = await prisma.location.update({
            where: { id: locationId },
            data: data as Parameters<typeof prisma.location.update>[0]['data']
          });
          return NextResponse.json({
            location,
            warning: 'Contact fields (location name, phone, email, website) could not be saved. Run database migrations in production.'
          });
        } catch {
          throw updateError;
        }
      }
      throw updateError;
    }

    return NextResponse.json({ location });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: error?.message ?? 'Failed to update location' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    const { locationId } = await params;
    await prisma.location.delete({ where: { id: locationId } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: error?.message ?? 'Failed to delete location' },
      { status: 500 }
    );
  }
}
