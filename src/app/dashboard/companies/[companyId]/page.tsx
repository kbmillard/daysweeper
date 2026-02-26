export const dynamic = 'force-dynamic';
export const revalidate = 0;

import PageContainer from '@/components/layout/page-container';
import { prisma } from '@/lib/prisma';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import FormCardSkeleton from '@/components/form-card-skeleton';
import CompanyDetailView from './company-detail-view';

export const metadata = {
  title: 'Dashboard: Company Details'
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

type PageProps = { params: Promise<{ companyId: string }> };

export default async function Page(props: PageProps) {
  const params = await props.params;
  const companyId = params.companyId;
  const baseUrl = await getBaseUrl();

  let company;
  try {
    company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      externalId: true,
      name: true,
      website: true,
      phone: true,
      email: true,
      status: true,
      metadata: true,
      primaryLocationId: true,
      Location: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          externalId: true,
          addressRaw: true,
          addressNormalized: true,
          locationName: true,
          addressComponents: true,
          latitude: true,
          longitude: true,
          phone: true,
          createdAt: true,
          updatedAt: true
        }
      },
      Company: {
        // Parent company (include primaryLocationId + all locations so card shows primary address)
        select: {
          id: true,
          externalId: true,
          name: true,
          website: true,
          phone: true,
          email: true,
          segment: true,
          status: true,
          metadata: true,
          primaryLocationId: true,
          Location: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              addressRaw: true,
              addressComponents: true,
              latitude: true,
              longitude: true,
              phone: true
            }
          }
        }
      },
      other_Company: {
        // Child companies (include all locations with coords for map)
        select: {
          id: true,
          externalId: true,
          name: true,
          website: true,
          phone: true,
          email: true,
          segment: true,
          status: true,
          metadata: true,
          Location: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              addressRaw: true,
              addressComponents: true,
              latitude: true,
              longitude: true,
              phone: true
            }
          }
        }
      }
    }
  });
  } catch (err) {
    throw new Error(`Failed to load company: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!company) {
    notFound();
  }

  // Serialize for client: Prisma Decimal is not JSON-serializable for RSC payload
  const serialized = {
    ...company,
    primaryLocationId: company.primaryLocationId ?? null,
    Location: (company.Location ?? []).map((loc) => ({
      ...loc,
      latitude: loc.latitude != null ? Number(loc.latitude) : null,
      longitude: loc.longitude != null ? Number(loc.longitude) : null
    })),
    Company: company.Company
      ? {
          ...company.Company,
          primaryLocationId: company.Company.primaryLocationId ?? null,
          Location: (company.Company.Location ?? []).map((loc) => ({
            ...loc,
            latitude: loc.latitude != null ? Number(loc.latitude) : null,
            longitude: loc.longitude != null ? Number(loc.longitude) : null
          }))
        }
      : null,
    other_Company: (company.other_Company ?? []).map((child) => ({
      ...child,
      Location: (child.Location ?? []).map((loc) => ({
        ...loc,
        latitude: loc.latitude != null ? Number(loc.latitude) : null,
        longitude: loc.longitude != null ? Number(loc.longitude) : null
      }))
    }))
  };

  return (
    <PageContainer scrollable pageTitle={company.name} pageDescription='Company details and locations'>
      <Suspense fallback={<FormCardSkeleton />}>
        <CompanyDetailView company={serialized} baseUrl={baseUrl} />
      </Suspense>
    </PageContainer>
  );
}
