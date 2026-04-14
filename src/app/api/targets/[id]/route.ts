import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import {
  isRouteOutcomeValue,
  parseRouteOutcomeFromBody,
  stopFieldsFromRouteOutcome,
  type RouteOutcomeValue
} from '@/lib/route-stop-outcome';
import { resolveSellerCompanyIdsForTargets } from '@/lib/lastleg-resolve-seller-targets';
import { targetToLead } from '@/lib/target-to-lead';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SHARED_USER_ID = 'shared';

const TARGET_INCLUDE = {
  TargetEnrichment: {
    select: { enrichedJson: true }
  },
  RouteStop: {
    take: 1,
    orderBy: { seq: 'asc' as const },
    select: { seq: true, outcome: true }
  }
} as const;

async function fetchTargetForLead(id: string) {
  return prisma.target.findUnique({
    where: { id },
    include: TARGET_INCLUDE
  });
}

/**
 * GET - Fetch a single target by ID (LastLeg app). Accepts session or Bearer token.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const target = await fetchTargetForLead(id);

    if (!target) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 });
    }

    const sellerByTarget = await resolveSellerCompanyIdsForTargets([target]);
    return NextResponse.json({
      target: targetToLead(target, {
        resolvedSellerCompanyId: sellerByTarget.get(target.id) ?? null
      })
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch target';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const VALID_OUTCOMES = [
  'VISITED',
  'NO_ANSWER',
  'WRONG_ADDRESS',
  'FOLLOW_UP',
  'NOT_INTERESTED',
  'REVISITING_INTERESTED',
  'DEAL_MADE',
  'CONTAINERS_CLEARED'
] as const;

/**
 * PATCH - Update target (LastLeg app). Accepts session or Bearer token.
 *
 * Canonical route stop: **`route_outcome`** (snake) or **`routeOutcome`** (camel). JSON **`null`** clears
 * outcome + `visitedAt` (reactivate). Idempotent merge with other fields.
 *
 * Legacy: **`status`** (`visited` | `no_answer` | `trashed` | `active` | or a StopOutcome string) when `route_outcome` is omitted.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await Promise.race([
      auth({ acceptsToken: ['session_token', 'oauth_token'] }).catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
    ]);
    const userId =
      (authResult && 'userId' in authResult ? (authResult as { userId: string }).userId : null) ??
      SHARED_USER_ID;

    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    const {
      status,
      notes,
      visited,
      latitude,
      longitude,
      places_context,
      address_raw,
      address,
      pin_research,
      facility_snapshot,
      enriched_intelligence,
      account_state,
      primary_name
    } = body;

    const target = await prisma.target.findUnique({ where: { id } });
    if (!target) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 });
    }

    const now = new Date();

    const targetUpdates: Record<string, unknown> = { updatedAt: now };

    if (account_state === null) {
      targetUpdates.accountState = 'NEW_UNCONTACTED';
    } else {
      const VALID_STATES = ['NEW_UNCONTACTED', 'NEW_CONTACTED_NO_ANSWER', 'ACCOUNT'] as const;
      if (typeof account_state === 'string' && VALID_STATES.includes(account_state as (typeof VALID_STATES)[number])) {
        targetUpdates.accountState = account_state;
      }
    }

    if (typeof primary_name === 'string' && primary_name.trim()) {
      targetUpdates.company = primary_name.trim();
    }
    if (latitude != null && !Number.isNaN(Number(latitude))) targetUpdates.latitude = Number(latitude);
    if (longitude != null && !Number.isNaN(Number(longitude))) targetUpdates.longitude = Number(longitude);
    if (typeof address_raw === 'string' && address_raw.trim()) targetUpdates.addressRaw = address_raw.trim();
    if (typeof address === 'string' && address.trim()) targetUpdates.addressNormalized = address.trim();
    if (Object.keys(targetUpdates).length > 1) {
      await prisma.target.update({ where: { id }, data: targetUpdates as Prisma.TargetUpdateInput });
    }

    const hasEnrichment =
      places_context != null ||
      pin_research != null ||
      facility_snapshot != null ||
      enriched_intelligence != null;
    if (hasEnrichment) {
      const existing = await prisma.targetEnrichment.findUnique({ where: { targetId: id } });
      const existingJson: Record<string, unknown> =
        existing?.enrichedJson && typeof existing.enrichedJson === 'object'
          ? (existing.enrichedJson as Record<string, unknown>)
          : {};

      const mergedJson: Record<string, unknown> = { ...existingJson };
      if (typeof places_context === 'string' && places_context.trim())
        mergedJson.places_context = places_context.trim();
      if (pin_research != null && typeof pin_research === 'object')
        mergedJson.pin_research = pin_research;
      if (facility_snapshot != null && typeof facility_snapshot === 'object')
        mergedJson.snapshot = facility_snapshot;
      if (enriched_intelligence != null && typeof enriched_intelligence === 'object')
        mergedJson.enriched_intelligence = enriched_intelligence;

      await prisma.targetEnrichment.upsert({
        where: { targetId: id },
        create: { id: id, targetId: id, enrichedJson: mergedJson as Prisma.JsonObject, updatedAt: now },
        update: { enrichedJson: mergedJson as Prisma.JsonObject, updatedAt: now }
      });
    }

    const stop = await prisma.routeStop.findFirst({
      where: {
        targetId: id,
        route: { assignedToUserId: userId }
      },
      orderBy: { updatedAt: 'desc' }
    });

    if (stop) {
      const routeOutcomeInput = parseRouteOutcomeFromBody(body);
      const noteData: { note?: string } =
        typeof notes === 'string' ? { note: notes } : {};

      if (routeOutcomeInput !== undefined) {
        if (routeOutcomeInput !== null && !isRouteOutcomeValue(routeOutcomeInput)) {
          return NextResponse.json(
            {
              error: `Invalid route_outcome: "${routeOutcomeInput}". Expected null or one of: ${VALID_OUTCOMES.join(', ')}`
            },
            { status: 400 }
          );
        }
        const canonical: null | RouteOutcomeValue =
          routeOutcomeInput === null ? null : routeOutcomeInput;
        const fields = stopFieldsFromRouteOutcome(canonical, now);
        await prisma.routeStop.update({
          where: { id: stop.id },
          data: { ...fields, ...noteData }
        });
      } else {
        const stopUpdates: Record<string, unknown> = { ...noteData };
        if (visited === true) {
          stopUpdates.outcome = 'VISITED';
          stopUpdates.visitedAt = now;
        } else if (typeof status === 'string') {
          const normalizedStatus = status.trim();
          if (normalizedStatus === 'visited') {
            stopUpdates.outcome = 'VISITED';
            stopUpdates.visitedAt = now;
          } else if (normalizedStatus === 'no_answer') {
            stopUpdates.outcome = 'NO_ANSWER';
            stopUpdates.visitedAt = null;
          } else if (normalizedStatus === 'trashed') {
            stopUpdates.outcome = 'WRONG_ADDRESS';
            stopUpdates.visitedAt = null;
          } else if (normalizedStatus === 'active') {
            stopUpdates.outcome = null;
            stopUpdates.visitedAt = null;
          } else if (isRouteOutcomeValue(normalizedStatus)) {
            Object.assign(stopUpdates, stopFieldsFromRouteOutcome(normalizedStatus, now));
          }
        }
        if (Object.keys(stopUpdates).length > 0) {
          await prisma.routeStop.update({
            where: { id: stop.id },
            data: stopUpdates as Prisma.RouteStopUpdateInput
          });
        }
      }
    }

    const refreshed = await fetchTargetForLead(id);
    const sellerByTarget = refreshed
      ? await resolveSellerCompanyIdsForTargets([refreshed])
      : new Map<string, string>();
    return NextResponse.json({
      ok: true,
      ...(refreshed
        ? {
            target: targetToLead(refreshed, {
              resolvedSellerCompanyId: sellerByTarget.get(refreshed.id) ?? null
            })
          }
        : {})
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update target';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
