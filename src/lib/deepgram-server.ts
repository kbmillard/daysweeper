/**
 * Server-only Deepgram helpers (env, key normalization, /v1/auth/grant).
 */

export const DEEPGRAM_DEFAULT_ORIGIN = 'https://api.deepgram.com';

export const DEEPGRAM_MAX_TTL_SECONDS = 3600;

export function normalizeDeepgramApiKey(raw: string): string {
  let k = raw.trim();
  if (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1).trim();
  }
  k = k.replace(/^Token\s+/i, '').trim();
  return k;
}

export function getDeepgramApiOrigin(): string {
  const raw = process.env.DEEPGRAM_API_URL?.trim();
  if (!raw) return DEEPGRAM_DEFAULT_ORIGIN;
  try {
    return new URL(raw).origin;
  } catch {
    return DEEPGRAM_DEFAULT_ORIGIN;
  }
}

export type DeepgramGrantResult =
  | {
      ok: true;
      access_token: string;
      expires_in: number;
      wssHost: string;
    }
  | {
      ok: false;
      status: number;
      err_msg?: string;
      err_code?: string;
      hint?: string;
    };

export async function deepgramGrantJwt(
  apiKey: string,
  ttlSeconds: number = DEEPGRAM_MAX_TTL_SECONDS
): Promise<DeepgramGrantResult> {
  const origin = getDeepgramApiOrigin();
  const grantUrl = `${origin}/v1/auth/grant`;
  const wssHost = new URL(origin).host;

  const dgRes = await fetch(grantUrl, {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ttl_seconds: ttlSeconds })
  });

  const body = (await dgRes.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    err_msg?: string;
    err_code?: string;
  };

  if (dgRes.ok && body.access_token) {
    return {
      ok: true,
      access_token: body.access_token,
      expires_in: body.expires_in ?? ttlSeconds,
      wssHost
    };
  }

  const msg =
    typeof body.err_msg === 'string'
      ? body.err_msg
      : `Deepgram token request failed (${dgRes.status})`;

  const hints: string[] = [];
  const hasCustomUrl = Boolean(process.env.DEEPGRAM_API_URL?.trim());
  const isDefaultUs = origin === DEEPGRAM_DEFAULT_ORIGIN;
  const isEu = origin.includes('eu.deepgram');

  if (dgRes.status === 403 && !hasCustomUrl && isDefaultUs) {
    hints.push(
      'If your Deepgram project uses EU data residency, set DEEPGRAM_API_URL=https://api.eu.deepgram.com in Vercel (Production and Preview) and redeploy.'
    );
  }
  if (dgRes.status === 403 && isEu) {
    hints.push(
      'If your project is US-based, remove DEEPGRAM_API_URL from Vercel so the app uses https://api.deepgram.com.'
    );
  }
  if (dgRes.status === 403) {
    hints.push(
      'Create a brand-new API key in Deepgram Console → API Keys (Member or Administrator role), paste only the key into Vercel DEEPGRAM_API_KEY, and redeploy.'
    );
    hints.push(
      'Add DEEPGRAM_API_KEY to both Production and Preview in Vercel if you test on preview URLs.'
    );
  }

  return {
    ok: false,
    status: dgRes.status,
    err_msg: msg,
    err_code: body.err_code,
    hint: hints.length > 0 ? hints.join(' ') : undefined
  };
}
