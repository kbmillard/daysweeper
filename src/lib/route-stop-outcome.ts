import type { StopOutcome } from '@prisma/client';

/** All values persisted on `RouteStop.outcome` (API + DB). */
export const ROUTE_OUTCOME_VALUES = [
  'VISITED',
  'NO_ANSWER',
  'WRONG_ADDRESS',
  'FOLLOW_UP',
  'NOT_INTERESTED',
  'REVISITING_INTERESTED',
  'DEAL_MADE',
  'CONTAINERS_CLEARED'
] as const;

export type RouteOutcomeValue = (typeof ROUTE_OUTCOME_VALUES)[number];

export function isRouteOutcomeValue(s: string): s is RouteOutcomeValue {
  return (ROUTE_OUTCOME_VALUES as readonly string[]).includes(s);
}

/**
 * Parse `route_outcome` / `routeOutcome` from PATCH JSON.
 * - Key absent → `undefined` (do not change stop from this field).
 * - JSON `null` → clear outcome + visitedAt (reactivate pin on client).
 */
export function parseRouteOutcomeFromBody(body: Record<string, unknown>): undefined | null | string {
  if ('route_outcome' in body) {
    const v = body.route_outcome;
    if (v === null) return null;
    if (typeof v === 'string') return v.trim();
    return undefined;
  }
  if ('routeOutcome' in body) {
    const v = body.routeOutcome;
    if (v === null) return null;
    if (typeof v === 'string') return v.trim();
    return undefined;
  }
  return undefined;
}

/**
 * Maps canonical `route_outcome` to RouteStop columns. Fade/inactive is client-only; DB stores outcome + timestamps.
 */
export function stopFieldsFromRouteOutcome(
  outcome: null | RouteOutcomeValue,
  now: Date
): { outcome: StopOutcome | null; visitedAt: Date | null } {
  if (outcome === null) {
    return { outcome: null, visitedAt: null };
  }
  const noVisitTimestamp: RouteOutcomeValue[] = [
    'NO_ANSWER',
    'WRONG_ADDRESS',
    'FOLLOW_UP',
    'REVISITING_INTERESTED'
  ];
  if (noVisitTimestamp.includes(outcome)) {
    return { outcome, visitedAt: null };
  }
  return { outcome, visitedAt: now };
}
