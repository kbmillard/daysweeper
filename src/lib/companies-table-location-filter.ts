import { Prisma } from '@prisma/client';
import { BLANK_STATE_FILTER_VALUE } from '@/lib/company-location-states';

/**
 * Fallback when "No state" is selected but no precomputed ID list was passed (should be rare).
 */
function locationWhereBlankStateFallback(): Prisma.LocationWhereInput {
  return {
    OR: [
      { addressComponents: { equals: Prisma.DbNull } },
      { addressComponents: { path: ['state'], equals: Prisma.DbNull } },
      { addressComponents: { path: ['state'], equals: Prisma.JsonNull } },
      { addressComponents: { path: ['state'], equals: '' } }
    ]
  };
}

/**
 * Builds `Location.some` for companies list: optional address substring and/or
 * one-or-more states (JSON `addressComponents.state` on any location), including
 * {@link BLANK_STATE_FILTER_VALUE} for "no state".
 */
export function buildCompaniesLocationSomeWhere(input: {
  addressContains?: string | null;
  states?: string[] | null;
  /** When "No state" is selected, prefer IDs from {@link getLocationIdsWithBlankParsedState} (trim-aware). */
  blankStateLocationIds?: string[] | null;
}): Prisma.LocationWhereInput {
  const raw = (input.states ?? []).map((s) => s.trim()).filter(Boolean);
  const includeBlank = raw.includes(BLANK_STATE_FILTER_VALUE);
  const states = raw.filter((s) => s !== BLANK_STATE_FILTER_VALUE);
  const addressContains = input.addressContains?.trim() || null;

  const addressClause: Prisma.LocationWhereInput | null = addressContains
    ? { addressRaw: { contains: addressContains, mode: 'insensitive' } }
    : null;

  const blankBranch: Prisma.LocationWhereInput | null = includeBlank
    ? input.blankStateLocationIds && input.blankStateLocationIds.length > 0
      ? { id: { in: input.blankStateLocationIds } }
      : locationWhereBlankStateFallback()
    : null;

  const stateBranches: Prisma.LocationWhereInput[] = [
    ...states.map((s) => ({
      addressComponents: {
        path: ['state'],
        equals: s
      }
    })),
    ...(blankBranch ? [blankBranch] : [])
  ];

  const stateClause: Prisma.LocationWhereInput | null =
    stateBranches.length > 0 ? { OR: stateBranches } : null;

  if (addressClause && stateClause) {
    return { AND: [addressClause, stateClause] };
  }
  if (addressClause) return addressClause;
  if (stateClause) return stateClause;
  return {};
}
