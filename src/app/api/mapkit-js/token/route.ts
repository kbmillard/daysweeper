import { NextResponse } from 'next/server';
import { SignJWT, importPKCS8 } from 'jose';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Short-lived JWT for MapKit JS (browser). Used for Apple forward geocoding on the route planner — not Nominatim/Mapbox.
 *
 * Env (Apple Developer → Keys → MapKit JS, or Maps token key):
 * - APPLE_TEAM_ID
 * - MAPKIT_JS_KEY_ID (10-char Key ID)
 * - MAPKIT_JS_PRIVATE_KEY (.p8 PEM, use \n for newlines in env)
 * - MAPKIT_JS_ORIGIN (optional) e.g. https://daysweeper.vercel.app — defaults from VERCEL_URL / NEXT_PUBLIC_APP_URL
 */
export async function GET() {
  const teamId = (process.env.APPLE_TEAM_ID ?? '').replace(/^[\s\n\r\uFEFF]+/, '').trim();
  const keyId = process.env.MAPKIT_JS_KEY_ID?.trim();
  let pem = (process.env.MAPKIT_JS_PRIVATE_KEY ?? '').replace(/\\n/g, '\n').trim();

  const origin =
    process.env.MAPKIT_JS_ORIGIN?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '').trim() ||
    '';

  if (!teamId || !keyId || !pem) {
    return NextResponse.json(
      {
        error:
          'MapKit JS not configured. Set APPLE_TEAM_ID, MAPKIT_JS_KEY_ID, MAPKIT_JS_PRIVATE_KEY on the server.'
      },
      { status: 503 }
    );
  }

  try {
    const key = await importPKCS8(pem, 'ES256');
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 30 * 60;

    const jwt = await new SignJWT(
      origin
        ? {
            origin
          }
        : {}
    )
      .setProtectedHeader({ alg: 'ES256', kid: keyId, typ: 'JWT' })
      .setIssuer(teamId)
      .setIssuedAt(now)
      .setExpirationTime(exp)
      .sign(key);

    return new NextResponse(jwt, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'private, max-age=0, must-revalidate'
      }
    });
  } catch (e) {
    console.error('mapkit-js/token sign error', e);
    return NextResponse.json({ error: 'Failed to sign MapKit token' }, { status: 500 });
  }
}
