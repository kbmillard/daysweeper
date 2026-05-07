import SignUpViewPage from '@/features/auth/components/sign-up-view';
import { isPublicCrmHostname } from '@/lib/public-crm-host';
import { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Authentication | Sign Up',
  description: 'Sign Up page for authentication.'
};

export default async function Page() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  if (isPublicCrmHostname(host)) {
    redirect('/dashboard/overview');
  }
  return <SignUpViewPage />;
}
