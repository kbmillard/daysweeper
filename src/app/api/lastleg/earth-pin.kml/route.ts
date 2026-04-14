import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KML_CONTENT_TYPE = 'application/vnd.google-earth.kml+xml';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function clampName(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  return t.length > 200 ? t.slice(0, 200) : t;
}

function parseCoord(v: string | null): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isValidWgs84(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * GET — KML 2.2 placemark for Google Earth iOS handshake:
 * comgoogleearth://&lt;host&gt;/api/lastleg/earth-pin.kml?lat=&amp;lng=&amp;name=
 *
 * Public (Earth fetches without session). Name is optional, XML-escaped, max 200 chars.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = parseCoord(searchParams.get('lat'));
  const lng = parseCoord(searchParams.get('lng'));
  if (lat == null || lng == null || !isValidWgs84(lat, lng)) {
    return NextResponse.json({ error: 'Invalid or missing lat/lng' }, { status: 400 });
  }

  const nameParam = searchParams.get('name');
  const trimmed = typeof nameParam === 'string' ? clampName(nameParam) : '';
  const nameInner = trimmed ? escapeXml(trimmed) : 'Pin';

  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>${nameInner}</name>
      <Point>
        <coordinates>${lng},${lat},0</coordinates>
      </Point>
    </Placemark>
  </Document>
</kml>
`;

  return new NextResponse(kml, {
    status: 200,
    headers: {
      'Content-Type': KML_CONTENT_TYPE,
      'Cache-Control': 'no-store, max-age=0'
    }
  });
}
