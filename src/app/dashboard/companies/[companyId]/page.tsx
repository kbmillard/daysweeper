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

  const company = await prisma.company.findUnique({
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
      Location: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          externalId: true,
          addressRaw: true,
          addressNormalized: true,
          addressComponents: true,
          addressConfidence: true,
          latitude: true,
          longitude: true,
          createdAt: true,
          updatedAt: true
        }
      },
      Company: {
        // Parent company
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
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              addressRaw: true,
              addressComponents: true
            }
          }
        }
      },
      other_Company: {
        // Child companies
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
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              addressRaw: true,
              addressComponents: true
            }
          }
        }
      }
    }
  });

  if (!company) {
    notFound();
  }

  return (
    <PageContainer scrollable pageTitle={company.name} pageDescription='Company details and locations'>
      <Suspense fallback={<FormCardSkeleton />}>
        <CompanyDetailView company={company} baseUrl={baseUrl} />
      </Suspense>
    </PageContainer>
  );
}
