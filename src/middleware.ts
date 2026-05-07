import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { isPublicCrmHostname } from '@/lib/public-crm-host';
import { TEMP_BYPASS_CLERK_ROUTE_GUARD } from '@/lib/temp-clerk-bypass';

const isProtectedRoute = createRouteMatcher(['/map(.*)', '/dashboard(.*)']);
const isPublicApi = createRouteMatcher(['/api/config/google-maps-key']);

function requestHostname(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-host');
  const fromForwarded = forwarded?.split(',')[0]?.trim().split(':')[0];
  const fromHost = req.headers.get('host')?.split(':')[0];
  return (fromForwarded || fromHost || req.nextUrl.hostname || '').toLowerCase();
}

export default clerkMiddleware(async (auth, req: NextRequest) => {
  if (isPublicApi(req)) return NextResponse.next();
  const publicCrm = isPublicCrmHostname(requestHostname(req));
  const skipProtect =
    TEMP_BYPASS_CLERK_ROUTE_GUARD || publicCrm;
  if (!skipProtect && isProtectedRoute(req)) await auth.protect();

  const res = NextResponse.next();
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.headers.set('Pragma', 'no-cache');
  res.headers.set('Expires', '0');
  return res;
});
export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)'
  ]
};
