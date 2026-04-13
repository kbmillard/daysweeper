import { NextResponse } from 'next/server';
import { LASTLEG_IOS_GOOGLE_MAPS_DEFAULT_KEY } from '@/lib/lastleg-google-maps-key';

export const dynamic = 'force-dynamic';

/**
 * GET - Google Maps API key for LastLeg iOS (and any client that fetches this URL).
 * LASTLEG_IOS_GOOGLE_MAPS_API_KEY overrides; otherwise uses the bundled LastLeg default.
 */
export async function GET() {
  const key =
    (process.env.LASTLEG_IOS_GOOGLE_MAPS_API_KEY ?? '').trim() ||
    LASTLEG_IOS_GOOGLE_MAPS_DEFAULT_KEY;
  return NextResponse.json({ key });
}
