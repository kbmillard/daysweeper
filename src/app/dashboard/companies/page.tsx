import PageContainer from '@/components/layout/page-container';
import { buttonVariants } from '@/components/ui/button';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';
import { searchParamsCache } from '@/lib/searchparams';
import { cn } from '@/lib/utils';
import { IconPlus } from '@tabler/icons-react';
import Link from 'next/link';
import { SearchParams } from 'nuqs/server';
import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import CompaniesTable from './companies-table';

export const metadata = {
  title: 'Dashboard: Companies'
};

type pageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function Page(props: pageProps) {
  const searchParams = await props.searchParams;
  searchParamsCache.parse(searchParams);

  const page = searchParamsCache.get('page') ?? 1;
  const perPage = searchParamsCache.get('perPage') ?? 10;
  const companyFilter = searchParamsCache.get('company');
  const segmentFilter = searchParamsCache.get('segment');
  const tierFilter = searchParamsCache.get('tier');
  const accountStateFilter = searchParamsCache.get('accountState');

  const skip = (Number(page) - 1) * Number(perPage);
  const take = Number(perPage);

  const where: any = {};
  
  if (companyFilter) {
    where.OR = [
      { name: { contains: companyFilter, mode: 'insensitive' as const } },
      { email: { contains: companyFilter, mode: 'insensitive' as const } },
      { website: { contains: companyFilter, mode: 'insensitive' as const } }
    ];
  }
  
  if (segmentFilter) {
    where.segment = { equals: segmentFilter, mode: 'insensitive' as const };
  }
  
  if (tierFilter) {
    where.tier = { equals: tierFilter, mode: 'insensitive' as const };
  }

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        website: true,
        phone: true,
        email: true,
        segment: true,
        tier: true,
        createdAt: true,
        updatedAt: true,
        Location: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: {
            addressRaw: true,
            addressComponents: true
          }
        }
      }
    }),
    prisma.company.count({ where })
  ]);

  return (
    <PageContainer
      scrollable={false}
      pageTitle='Companies'
      pageDescription='Manage companies and targets'
      pageHeaderAction={
        <Link
          href='/dashboard/companies/new'
          className={cn(buttonVariants(), 'text-xs md:text-sm')}
        >
          <IconPlus className='mr-2 h-4 w-4' /> Add New
        </Link>
      }
    >
      <Suspense
        fallback={
          <DataTableSkeleton columnCount={7} rowCount={8} filterCount={2} />
        }
      >
        <CompaniesTable data={companies} totalItems={total} />
      </Suspense>
    </PageContainer>
  );
}
