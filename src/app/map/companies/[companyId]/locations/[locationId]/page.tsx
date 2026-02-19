import PageContainer from '@/components/layout/page-container';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import FormCardSkeleton from '@/components/form-card-skeleton';
import LocationDetailView from './location-detail-view';

export const metadata = {
  title: 'Dashboard: Location Details'
};

type PageProps = {
  params: Promise<{ companyId: string; locationId: string }>;
};

export default async function Page(props: PageProps) {
  const params = await props.params;
  const { companyId, locationId } = params;

  const location = await prisma.location.findUnique({
    where: { id: locationId },
    select: {
      id: true,
      externalId: true,
      companyId: true,
      addressRaw: true,
      addressNormalized: true,
      addressComponents: true,
      addressConfidence: true,
      latitude: true,
      longitude: true,
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
          Location: {
            select: {
              id: true,
              addressRaw: true
            }
          }
        }
      }
    }
  });

  if (!location || location.companyId !== companyId) {
    notFound();
  }

  return (
    <PageContainer
      scrollable
      pageTitle={location.addressRaw}
      pageDescription={`Location for ${location.Company.name}`}
    >
      <Suspense fallback={<FormCardSkeleton />}>
        <LocationDetailView location={location} />
      </Suspense>
    </PageContainer>
  );
}
