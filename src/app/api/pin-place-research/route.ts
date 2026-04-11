export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { researchPinPlace } from '@/lib/pin-place-research';

/**
 * POST /api/pin-place-research
 * Body: { latitude: number, longitude: number, hint?: string, radiusMeters?: number, skipCache?: boolean }
 *
 * Uses Google Places Nearby + Place Details for authoritative name/address/phone.
 * Optional LLM disambiguation when multiple candidates (PIN_RESEARCH_LLM: gemini | openai | anthropic | none).
 *
 * Env:
 * - GOOGLE_PLACES_API_KEY (preferred) or GOOGLE_MAPS_API_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
 * - GEMINI_API_KEY when PIN_RESEARCH_LLM=gemini (default)
 * - OPENAI_API_KEY when PIN_RESEARCH_LLM=openai
 * - ANTHROPIC_API_KEY when PIN_RESEARCH_LLM=anthropic
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const lat = body?.latitude != null ? Number(body.latitude) : NaN;
    const lng = body?.longitude != null ? Number(body.longitude) : NaN;
    const hint = typeof body?.hint === 'string' ? body.hint : '';
    const radiusMeters =
      body?.radiusMeters != null ? Math.min(500, Math.max(30, Number(body.radiusMeters))) : 120;
    const skipCache = Boolean(body?.skipCache);

    if (Number.isNaN(lat) || lat < -90 || lat > 90) {
      return NextResponse.json({ ok: false, error: 'Invalid latitude' }, { status: 400 });
    }
    if (Number.isNaN(lng) || lng < -180 || lng > 180) {
      return NextResponse.json({ ok: false, error: 'Invalid longitude' }, { status: 400 });
    }

    const result = await researchPinPlace({
      latitude: lat,
      longitude: lng,
      hint,
      radiusMeters,
      skipCache
    });

    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Pin place research failed';
    if (message.includes('not configured')) {
      return NextResponse.json({ ok: false, error: message }, { status: 503 });
    }
    console.error('[pin-place-research]', e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
