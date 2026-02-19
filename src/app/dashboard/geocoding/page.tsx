import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { GeocodingView } from './geocoding-view';

export default async function GeocodingPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/auth/sign-in');
  }

  return (
    <PageContainer
      pageTitle="Geocoding"
      pageDescription="Location geocode status and Apple (CLGeocoder) script"
    >
      <GeocodingView />
    </PageContainer>
  );
}
