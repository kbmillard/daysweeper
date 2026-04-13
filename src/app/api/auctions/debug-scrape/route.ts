import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { searchBidSpotter } from '@/lib/auction-sources/bidspotter';
import { searchProxibid } from '@/lib/auction-sources/proxibid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/auctions/debug-scrape?platform=proxibid|bidspotter&term=...
 *
 * Runs a single scraper call without writing to the database so the auction
 * pipeline can be debugged from real payloads.
 */
export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const platform = searchParams.get('platform');
    const term =
      searchParams.get('term')?.trim() || 'collapsible bulk container';

    if (platform !== 'proxibid' && platform !== 'bidspotter') {
      return NextResponse.json(
        {
          error: 'platform must be "proxibid" or "bidspotter"'
        },
        { status: 400 }
      );
    }

    const result =
      platform === 'proxibid'
        ? await searchProxibid(term)
        : await searchBidSpotter(term);

    return NextResponse.json({
      platform,
      term,
      lotCount: result.lots.length,
      sampleLots: result.lots.slice(0, 10),
      errors: result.errors
    });
  } catch (error: unknown) {
    console.error('Error debugging auction scrape:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to run debug scrape'
      },
      { status: 500 }
    );
  }
}
