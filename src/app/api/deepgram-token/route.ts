import { NextResponse } from 'next/server';
import {
  DEEPGRAM_MAX_TTL_SECONDS,
  deepgramGrantJwt,
  normalizeDeepgramApiKey
} from '@/lib/deepgram-server';

export const dynamic = 'force-dynamic';

/**
 * Issues a short-lived Deepgram JWT for browser WebSocket STT.
 * Auth temporarily disabled while Clerk login is bypassed — re-add Clerk check when auth is restored.
 *
 * EU projects: set DEEPGRAM_API_URL=https://api.eu.deepgram.com (grant + wss host must match).
 */
export async function POST() {
  try {
    const rawKey = process.env.DEEPGRAM_API_KEY?.trim();
    if (!rawKey) {
      return NextResponse.json(
        { error: 'Deepgram is not configured (missing DEEPGRAM_API_KEY).' },
        { status: 503 }
      );
    }

    const apiKey = normalizeDeepgramApiKey(rawKey);
    if (!apiKey) {
      return NextResponse.json(
        { error: 'DEEPGRAM_API_KEY is empty after trimming.' },
        { status: 503 }
      );
    }

    const result = await deepgramGrantJwt(apiKey, DEEPGRAM_MAX_TTL_SECONDS);

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.err_msg,
          err_code: result.err_code,
          ...(result.hint ? { hint: result.hint } : {})
        },
        { status: result.status === 200 ? 502 : result.status }
      );
    }

    return NextResponse.json({
      access_token: result.access_token,
      expires_in: result.expires_in,
      wssHost: result.wssHost
    });
  } catch (e) {
    console.error('deepgram-token:', e);
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : 'Failed to create Deepgram token'
      },
      { status: 502 }
    );
  }
}
