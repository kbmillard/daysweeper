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
    include: {
      Company: {
        include: {
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
