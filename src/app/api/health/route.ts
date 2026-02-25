export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';

/**
 * GET /api/health - Health check for LastLeg iOS app.
 */
export async function GET() {
  return NextResponse.json({ ok: true });
}
