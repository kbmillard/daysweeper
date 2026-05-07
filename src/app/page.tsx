import { auth } from '@clerk/nextjs/server';
import { isPublicCrmHostname } from '@/lib/public-crm-host';
import { TEMP_BYPASS_CLERK_ROUTE_GUARD } from '@/lib/temp-clerk-bypass';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function Page() {
  if (TEMP_BYPASS_CLERK_ROUTE_GUARD) {
    redirect('/dashboard/overview');
  }
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  if (isPublicCrmHostname(host)) {
    redirect('/dashboard/overview');
  }
  const { userId } = await auth();
  if (!userId) {
    redirect('/auth/sign-in');
  }
  redirect('/dashboard/overview');
}
