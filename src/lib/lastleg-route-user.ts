import { auth } from '@clerk/nextjs/server';

export const SHARED_USER_ID = 'shared';

/** DB route synced from MapPin; corridor + map dots use these target ids. */
export const LASTLEG_CANONICAL_PINS_ROUTE_NAME = 'LastLeg Canonical Pins';

/**
 * Clerk user id for LastLeg / route APIs (session cookies or Bearer token).
 * Mirrors `/api/targets` behavior.
 */
export async function getLastLegUserId(): Promise<string> {
  const authResult = await Promise.race([
    auth({ acceptsToken: ['session_token', 'oauth_token'] }).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
  ]);
  return (
    (authResult && 'userId' in authResult ? (authResult as { userId: string }).userId : null) ??
    SHARED_USER_ID
  );
}
