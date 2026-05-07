import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { TEMP_BYPASS_CLERK_ROUTE_GUARD } from '@/lib/temp-clerk-bypass';

/** Same id LastLeg routes use when there is no signed-in Clerk user. */
export const ANONYMOUS_API_USER_ID = 'shared';

export function isClerkApiEnforcementOptional(): boolean {
  return TEMP_BYPASS_CLERK_ROUTE_GUARD;
}

/**
 * Resolves a Clerk `userId` for APIs that previously required sign-in.
 * When {@link TEMP_BYPASS_CLERK_ROUTE_GUARD} is true, unauthenticated callers get {@link ANONYMOUS_API_USER_ID}
 * so LastLeg (Bearer or shared route) and the web app keep working.
 */
export async function resolveApiUserIdOr401(): Promise<
  { ok: true; userId: string } | { ok: false; response: NextResponse }
> {
  const { userId } = await auth();
  if (userId) return { ok: true, userId };
  if (isClerkApiEnforcementOptional()) {
    return { ok: true, userId: ANONYMOUS_API_USER_ID };
  }
  return {
    ok: false,
    response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  };
}
