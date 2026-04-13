import type { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function requireSignedInUser(): Promise<boolean> {
  const { userId } = await auth();
  return Boolean(userId);
}

/**
 * Bulk geocode: signed-in Clerk session, or Bearer GEOCODE_BULK_SECRET (for scripts / cron).
 */
export async function authorizeBulkGeocode(req: NextRequest): Promise<boolean> {
  const secret = process.env.GEOCODE_BULK_SECRET?.trim();
  if (secret) {
    const h = req.headers.get('authorization');
    if (h === `Bearer ${secret}`) return true;
  }
  const { userId } = await auth();
  return Boolean(userId);
}
