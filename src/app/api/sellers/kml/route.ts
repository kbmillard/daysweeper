import { NextResponse } from 'next/server';
import { getSellerMapPins } from '@/lib/sellers-map-data';
import { buildSellersKml } from '@/lib/sellers-kml-document';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KML_CONTENT_TYPE = 'application/vnd.google-earth.kml+xml';

/**
 * GET — KML 2.2 of all geocoded seller locations (same set as /api/sellers/map) for Google Earth.
 */
export async function GET() {
  try {
    const pins = await getSellerMapPins();
    const kml = buildSellersKml(pins);

    return new NextResponse(kml, {
      status: 200,
      headers: {
        'Content-Type': KML_CONTENT_TYPE,
        'Content-Disposition': 'attachment; filename="daysweeper-sellers.kml"',
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (e) {
    console.error('sellers/kml', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    );
  }
}
