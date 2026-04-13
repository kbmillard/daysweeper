export const dynamic = 'force-dynamic';
export const revalidate = 0;

import PageContainer from '@/components/layout/page-container';
import { prisma } from '@/lib/prisma';
import { reconcilePrimaryLocationFromCompanyIfNeeded } from '@/lib/reconcile-primary-location-from-company';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import FormCardSkeleton from '@/components/form-card-skeleton';
import LocationDetailView from './location-detail-view';

export const metadata = {
  title: 'Dashboard: Location Details'
};

async function getBaseUrl(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
    const proto = h.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    return host ? `${proto}://${host}` : '';
  } catch {
    return '';
  }
}

const locationDetailSelect = {
  id: true,
  externalId: true,
  companyId: true,
  addressRaw: true,
  addressNormalized: true,
  addressComponents: true,
  latitude: true,
  longitude: true,
  locationName: true,
  phone: true,
  email: true,
  website: true,
  legacyJson: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
  Company: {
    select: {
      id: true,
      name: true,
      website: true,
      phone: true,
      email: true,
      status: true,
      metadata: true,
      primaryLocationId: true,
      Location: {
        select: {
          id: true,
          addressRaw: true
        }
      }
    }
  }
} as const;

type PageProps = {
  params: Promise<{ companyId: string; locationId: string }>;
};

export default async function Page(props: PageProps) {
  const params = await props.params;
  const { companyId, locationId } = params;
  const baseUrl = await getBaseUrl();

  let location;
  try {
    location = await prisma.location.findUnique({
      where: { id: locationId },
      select: locationDetailSelect
    });
  } catch (err) {
    throw new Error(`Failed to load location: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!location || location.companyId !== companyId) {
    notFound();
  }

  if (location.Company.primaryLocationId === location.id) {
    await reconcilePrimaryLocationFromCompanyIfNeeded(locationId, companyId);
    location = await prisma.location.findUnique({
      where: { id: locationId },
      select: locationDetailSelect
    });
    if (!location) {
      notFound();
    }
  }

  const serialized = {
    ...location,
    latitude: location.latitude != null ? Number(location.latitude) : null,
    longitude: location.longitude != null ? Number(location.longitude) : null
  };

  return (
    <PageContainer
      pageTitle={location.addressRaw}
      pageDescription={`Location for ${location.Company.name}`}
    >
      <Suspense fallback={<FormCardSkeleton />}>
        <LocationDetailView location={serialized} baseUrl={baseUrl} />
      </Suspense>
    </PageContainer>
  );
}
