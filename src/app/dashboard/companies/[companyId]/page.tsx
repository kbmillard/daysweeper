import PageContainer from '@/components/layout/page-container';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import FormCardSkeleton from '@/components/form-card-skeleton';
import CompanyDetailView from './company-detail-view';

export const metadata = {
  title: 'Dashboard: Company Details'
};

type PageProps = { params: Promise<{ companyId: string }> };

export default async function Page(props: PageProps) {
  const params = await props.params;
  const companyId = params.companyId;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      website: true,
      phone: true,
      category: true,
      subtype: true,
      status: true,
      metadata: true,
      Location: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        select: {
          addressRaw: true,
          addressComponents: true
        }
      },
      Company: {
        // Parent company
        select: {
          id: true,
          name: true,
          website: true,
          phone: true,
          category: true,
          subtype: true,
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
          name: true,
          website: true,
          phone: true,
          category: true,
          subtype: true,
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
        <CompanyDetailView company={company} />
      </Suspense>
    </PageContainer>
  );
}
