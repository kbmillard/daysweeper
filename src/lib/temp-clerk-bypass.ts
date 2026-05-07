/**
 * Temporary: skip Clerk route protection on /map and /dashboard, allow APIs without a session
 * (using shared LastLeg user id where needed). Sign-in / sign-up pages still use Clerk.
 * Set to `false` and redeploy to restore full auth.
 */
export const TEMP_BYPASS_CLERK_ROUTE_GUARD = true;
