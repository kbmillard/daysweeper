import { NextResponse } from 'next/server';
import { getSellerMapPins, type SellerMapPin } from '@/lib/sellers-map-data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export type { SellerMapPin };

/**
 * GET — Grey seller/vendor-research pins: every geocoded Location for non-hidden `Company.isSeller`.
 * Includes import `legacyJson` on company and location for map popovers / LastLeg handoff.
 */
export async function GET() {
  try {
    const pins = await getSellerMapPins();
    return NextResponse.json({ pins }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json(
      { pins: [], error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    );
  }
}
