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
    include: {
      Location: {
        orderBy: { createdAt: 'desc' }
      },
      Company: {
        select: {
          id: true,
          name: true,
          website: true
        }
      },
      other_Company: {
        select: {
          id: true,
          name: true,
          website: true
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
