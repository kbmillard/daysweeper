import { NextRequest, NextResponse } from 'next/server';
import { getLastLegUserId } from '@/lib/lastleg-route-user';
import { setUserActiveRouteId } from '@/lib/user-active-route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/route-planner/active-route — body `{ "routeId": "..." }` sets which route receives corridor + LastLeg sync.
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getLastLegUserId();
    const body = (await req.json()) as { routeId?: string };
    const routeId = typeof body.routeId === 'string' ? body.routeId.trim() : '';
    if (!routeId) {
      return NextResponse.json({ error: 'routeId required' }, { status: 400 });
    }
    await setUserActiveRouteId(userId, routeId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to set route';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
