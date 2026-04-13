import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { readDefaultPinResearchCache } from '@/lib/pin-place-research';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST - Add a location (company + geocode) or a pin (lat/lng) to the current user's LastLeg route.
 * Body: { locationId, companyId } OR { sellerId } (legacy: buyer company id) OR { latitude, longitude, label? }
 * Creates Target and RouteStop in daysweeper DB. LastLeg app fetches via GET /api/targets.
 */
const SHARED_USER_ID = 'shared';

export async function POST(req: Request) {
  try {
    const authResult = await Promise.race([
      auth({ acceptsToken: ['session_token', 'oauth_token'] }).catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
    ]);
    const userId =
      (authResult && 'userId' in authResult ? (authResult as { userId: string }).userId : null) ??
      SHARED_USER_ID;

    const body = await req.json();
    const { locationId, companyId, sellerId } = body;
    const latIn = body.latitude != null ? Number(body.latitude) : null;
    const lngIn = body.longitude != null ? Number(body.longitude) : null;
    const label = typeof body.label === 'string' ? body.label : null;

    let lat: number | null;
    let lng: number | null;
    let companyName: string;
    let addressRaw: string;
    let website: string | undefined;
    let phone: string | undefined;
    let email: string | undefined;
    let targetLegacyJson: Record<string, unknown> | undefined;

    if (sellerId && typeof sellerId === 'string') {
      const buyerCompany = await prisma.company.findFirst({
        where: { id: sellerId, isBuyer: true, hidden: false },
        include: {
          Location: {
            where: {
              latitude: { not: null },
              longitude: { not: null }
            },
            orderBy: { createdAt: 'asc' },
            take: 1
          }
        }
      });
      if (!buyerCompany) {
        return NextResponse.json({ error: 'Buyer company not found' }, { status: 404 });
      }
      const loc = buyerCompany.Location[0];
      lat = loc?.latitude != null ? Number(loc.latitude) : null;
      lng = loc?.longitude != null ? Number(loc.longitude) : null;
      companyName = buyerCompany.name;
      addressRaw = loc?.addressRaw ?? '';
      website = buyerCompany.website ?? undefined;
      phone = loc?.phone ?? buyerCompany.phone ?? undefined;
      email = buyerCompany.email ?? undefined;
      targetLegacyJson = {
        daysweeper_pin_kind: 'buyer',
        companyId: buyerCompany.id,
        locationId: loc?.id,
        companyExternalId: buyerCompany.externalId
      };
    } else if (locationId && companyId) {
      const location = await prisma.location.findUnique({
        where: { id: locationId },
        include: { Company: { select: { id: true, name: true, website: true, phone: true, email: true } } }
      });
      if (!location || location.companyId !== companyId) {
        return NextResponse.json({ error: 'Location not found' }, { status: 404 });
      }
      const company = location.Company;
      if (!company) {
        return NextResponse.json({ error: 'Company not found' }, { status: 404 });
      }
      lat = location.latitude != null ? Number(location.latitude) : null;
      lng = location.longitude != null ? Number(location.longitude) : null;
      companyName = company.name;
      addressRaw = location.addressRaw ?? '';
      website = company.website ?? undefined;
      // Prefer primary location phone (matches company page display)
      phone = location.phone ?? company.phone ?? undefined;
      email = company.email ?? undefined;
    } else if (latIn != null && lngIn != null && !Number.isNaN(latIn) && !Number.isNaN(lngIn)) {
      if (latIn < -90 || latIn > 90 || lngIn < -180 || lngIn > 180) {
        return NextResponse.json(
          { error: 'latitude must be -90..90, longitude -180..180' },
          { status: 400 }
        );
      }
      lat = latIn;
      lng = lngIn;
      const cached = await readDefaultPinResearchCache(latIn, lngIn).catch(() => null);
      companyName = cached?.chosen?.name?.trim() || label?.trim() || 'Pin';
      addressRaw = cached?.chosen?.formattedAddress?.trim() || '';
      website = cached?.chosen?.website ?? undefined;
      phone = cached?.chosen?.phone ?? undefined;
      email = undefined;
    } else {
      return NextResponse.json(
        { error: 'Provide locationId+companyId, sellerId (buyer company id), or latitude+longitude' },
        { status: 400 }
      );
    }

    const now = new Date();

    let route = await prisma.route.findFirst({
      where: { assignedToUserId: userId },
      orderBy: { updatedAt: 'desc' }
    });

    if (!route) {
      route = await prisma.route.create({
        data: {
          name: 'My route',
          assignedToUserId: userId,
          created: now,
          updatedAt: now
        }
      });
    }

    const maxStop = await prisma.routeStop.findFirst({
      where: { routeId: route.id },
      orderBy: { seq: 'desc' },
      select: { seq: true }
    });
    const nextSeq = (maxStop?.seq ?? 0) + 1;

    const target = await prisma.target.create({
      data: {
        company: companyName,
        addressRaw,
        website,
        phone,
        email,
        latitude: lat ?? undefined,
        longitude: lng ?? undefined,
        geocodeStatus: lat != null && lng != null ? 'geocoded' : 'missing',
        legacyJson: targetLegacyJson
          ? (targetLegacyJson as Prisma.InputJsonValue)
          : undefined,
        category: targetLegacyJson ? 'SELLER' : undefined,
        createdAt: now,
        updatedAt: now
      }
    });

    if (lat != null && lng != null) {
      const cached = await readDefaultPinResearchCache(lat, lng).catch(() => null);
      if (cached?.chosen) {
        const previousSummary = cached.webSummary?.trim();
        const placesContext = [
          `Listed as: ${cached.chosen.name}`,
          cached.chosen.formattedAddress ? `Address: ${cached.chosen.formattedAddress}` : null,
          cached.chosen.phone ? `Phone (public): ${cached.chosen.phone}` : null,
          cached.chosen.website ? `Website: ${cached.chosen.website}` : null,
          previousSummary ? `Summary: ${previousSummary}` : null,
          'Source: GPT web research with Google Maps coordinate context.'
        ]
          .filter(Boolean)
          .join(' ') + ' ';

        await prisma.targetEnrichment.upsert({
          where: { targetId: target.id },
          create: {
            id: `enr_${target.id}`,
            targetId: target.id,
            enrichedJson: {
              snapshot: {
                legalName: cached.chosen.name,
                industry: 'Unknown',
                employees: 0,
                siteFunction: 'Facility',
                summary: previousSummary ?? '',
                contactPhone: cached.chosen.phone ?? null
              },
              places_context: placesContext,
              pin_research: {
                summary: cached.webSummary ?? null,
                sources: cached.sources ?? [],
                confidence: cached.confidence ?? null,
                companyName: cached.chosen.name,
                address: cached.chosen.formattedAddress,
                phone: cached.chosen.phone,
                website: cached.chosen.website
              }
            },
            model: `pin-cache:${cached.provider}`,
            updatedAt: now
          },
          update: {
            enrichedJson: {
              snapshot: {
                legalName: cached.chosen.name,
                industry: 'Unknown',
                employees: 0,
                siteFunction: 'Facility',
                summary: previousSummary ?? '',
                contactPhone: cached.chosen.phone ?? null
              },
              places_context: placesContext,
              pin_research: {
                summary: cached.webSummary ?? null,
                sources: cached.sources ?? [],
                confidence: cached.confidence ?? null,
                companyName: cached.chosen.name,
                address: cached.chosen.formattedAddress,
                phone: cached.chosen.phone,
                website: cached.chosen.website
              }
            },
            model: `pin-cache:${cached.provider}`,
            updatedAt: now
          }
        }).catch(() => undefined);
      }
    }

    await prisma.routeStop.create({
      data: {
        routeId: route.id,
        targetId: target.id,
        seq: nextSeq,
        createdAt: now,
        updatedAt: now
      }
    });

    return NextResponse.json({ success: true, routeId: route.id, target_id: target.id });
  } catch (error: unknown) {
    const raw = error instanceof Error ? error.message : String(error);
    const isDbMissing =
      typeof raw === 'string' &&
      (raw.includes('does not exist') || raw.includes('Unknown column') || raw.includes('(not available)'));
    const message = isDbMissing
      ? 'Server database is missing Route/Target tables. Deploy or run migrations.'
      : raw || 'Failed to add to route';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
