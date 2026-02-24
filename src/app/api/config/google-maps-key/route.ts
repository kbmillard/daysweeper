import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET - Return the Google Maps API key for client-side map loading.
 * Reads from NEXT_PUBLIC_GOOGLE_MAPS_API_KEY or GOOGLE_MAPS_API_KEY.
 * In Vercel: set one of these in Project Settings → Environment Variables
 * for Production (and Preview if needed), then redeploy.
 */
export async function GET() {
  const key =
    (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '').trim() ||
    (process.env.GOOGLE_MAPS_API_KEY ?? '').trim();
  return NextResponse.json({ key });
}
