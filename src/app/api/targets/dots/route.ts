import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import {
  LASTLEG_CANONICAL_PINS_ROUTE_NAME,
  SHARED_USER_ID as LASTLEG_SHARED_USER_ID
} from '@/lib/lastleg-route-user';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SHARED_USER_ID = 'shared'; // Clerk fallback when unauthenticated
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY ?? '';

function getSnake(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] != null) return obj[k];
  }
  return null;
}

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function targetToRedPin(t: {
  id: string;
  company: string;
  addressRaw: string;
  phone: string | null;
  website: string | null;
  latitude: unknown;
  longitude: unknown;
  accountState: string | null;
  TargetEnrichment: { enrichedJson: unknown } | null;
}) {
  const ej = (t.TargetEnrichment?.enrichedJson as Record<string, unknown> | null) ?? {};
  const pr = (ej?.pin_research ?? {}) as Record<string, unknown>;

  const companyName = strOrNull(getSnake(pr, 'company_name', 'companyName'));
  const altNames = (() => {
    const a = pr.alternative_names ?? pr.alternativeNames;
    if (!Array.isArray(a)) return [];
    return a.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  })();
  const prPhone = strOrNull(pr.phone);
  const prEmail = strOrNull(pr.email);
  const prWebsite = strOrNull(getSnake(pr, 'website'));
  const industry = strOrNull(pr.industry);
  const summary = strOrNull(pr.summary);
  const pcStr = strOrNull(ej?.places_context);

  return {
    targetId: t.id,
    lat: Number(t.latitude),
    lng: Number(t.longitude),
    source: 'kml' as const,
    label: companyName ?? t.company,
    addressRaw: t.addressRaw || strOrNull(getSnake(pr, 'address')) || undefined,
    phone: prPhone ?? t.phone ?? undefined,
    email: prEmail ?? undefined,
    website: prWebsite ?? t.website ?? undefined,
    industry: industry ?? undefined,
    summary: summary ?? pcStr ?? undefined,
    alternativeNames: altNames.length > 0 ? altNames : undefined,
    accountState: t.accountState ?? undefined,
  };
}

/**
 * GET /api/targets/dots
 * Red-pin overlay data for the map: LastLeg route targets with enrichment.
 * - Browser: Clerk session; prefers shared “LastLeg Canonical Pins” targets (MapPin sync) so
 *   corridor ids match red dots; otherwise the signed-in user’s current route.
 * - Scripts: X-API-Key matching INTERNAL_API_KEY; returns up to 2000 geocoded targets (internal).
 */
export async function GET(req: Request) {
  const key = req.headers.get('x-api-key') ?? '';

  try {
    if (key === INTERNAL_API_KEY && INTERNAL_API_KEY.length > 0) {
      const targets = await prisma.target.findMany({
        where: { latitude: { not: null }, longitude: { not: null } },
        select: {
          id: true,
          company: true,
          addressRaw: true,
          phone: true,
          website: true,
          latitude: true,
          longitude: true,
          accountState: true,
          TargetEnrichment: { select: { enrichedJson: true } },
        },
        take: 2000,
      });
      const pins = targets.map(targetToRedPin);
      return NextResponse.json({ pins }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const authResult = await Promise.race([
      auth({ acceptsToken: ['session_token', 'oauth_token'] }).catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]);
    const userId =
      (authResult && 'userId' in authResult ? (authResult as { userId: string }).userId : null) ??
      SHARED_USER_ID;

    const dotsInclude = {
      stops: {
        orderBy: { seq: 'asc' as const },
        include: {
          target: {
            include: {
              TargetEnrichment: { select: { enrichedJson: true } },
            },
          },
        },
      },
    } as const;

    const canonicalRoute = await prisma.route.findFirst({
      where: {
        assignedToUserId: LASTLEG_SHARED_USER_ID,
        name: LASTLEG_CANONICAL_PINS_ROUTE_NAME
      },
      orderBy: { updatedAt: 'desc' },
      include: dotsInclude
    });

    const userRoute = await prisma.route.findFirst({
      where: { assignedToUserId: userId },
      orderBy: { updatedAt: 'desc' },
      include: dotsInclude
    });

    const route =
      canonicalRoute && canonicalRoute.stops.length > 0 ? canonicalRoute : userRoute;

    if (!route) {
      return NextResponse.json({ pins: [] }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const pins = route.stops
      .map((s) => ({
        ...targetToRedPin(s.target),
        routeOutcome: s.outcome ?? undefined,
      }))
      .filter((t) => Number.isFinite(t.lat) && Number.isFinite(t.lng));

    return NextResponse.json({ pins }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json(
      { pins: [], error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    );
  }
}
