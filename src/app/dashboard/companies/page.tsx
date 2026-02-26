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

export const dynamic = 'force-dynamic';

type pageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function Page(props: pageProps) {
  const searchParams = await props.searchParams;
  searchParamsCache.parse(searchParams);

  const page = searchParamsCache.get('page') ?? 1;
  const perPage = searchParamsCache.get('perPage') ?? 10;
  const nameFilter = searchParamsCache.get('name');
  const companyFilter = searchParamsCache.get('company');
  const addressFilterRaw = searchParamsCache.get('address');
  const statusFilterRaw = searchParamsCache.get('status');
  const addressFilter = Array.isArray(addressFilterRaw) ? addressFilterRaw[0] : addressFilterRaw;
  const statusFilter = Array.isArray(statusFilterRaw) ? statusFilterRaw[0] : statusFilterRaw;
  const hideAccounts = searchParamsCache.get('hideAccounts') === '1';
  const sort = searchParamsCache.get('sort');

  const skip = (Number(page) - 1) * Number(perPage);
  const take = Number(perPage);

  const where: any = { Location: { some: {} } }; // Only companies with at least one location

  // Search companies (name)
  if (nameFilter || companyFilter) {
    const filterValue = nameFilter || companyFilter;
    where.name = { contains: filterValue, mode: 'insensitive' as const };
  }

  // Search address: companies that have at least one location whose address contains the search
  if (addressFilter) {
    where.Location = {
      some: {
        addressRaw: { contains: addressFilter, mode: 'insensitive' as const }
      }
    };
  }

  // Status (Account, Contacted - meeting set, etc.; "Account" includes legacy "APR Account")
  if (statusFilter) {
    where.status =
      statusFilter === 'Account'
        ? { in: ['Account', 'APR Account'], mode: 'insensitive' as const }
        : { equals: statusFilter, mode: 'insensitive' as const };
  }

  // Hide accounts (status = Account / APR Account)
  if (hideAccounts) {
    where.status = {
      notIn: ['Account', 'APR Account']
    };
  }

  // Build orderBy from sort parameter
  let orderBy: any = { createdAt: 'desc' }; // default
  if (sort && sort.length > 0) {
    const firstSort = sort[0];
    // Map column IDs to Prisma field names
    const fieldMap: Record<string, string> = {
      name: 'name',
      website: 'website',
      status: 'status',
      createdAt: 'createdAt'
    };
    
    const field = fieldMap[firstSort.id] || 'createdAt';
    orderBy = {
      [field]: firstSort.desc ? 'desc' : 'asc'
    };
  }

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where,
      skip,
      take,
      orderBy,
      select: {
        id: true,
        name: true,
        website: true,
        status: true,
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
      scrollable={true}
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
          <DataTableSkeleton columnCount={6} rowCount={8} filterCount={3} />
        }
      >
        <CompaniesTable
          data={companies}
          totalItems={total}
          hideAccounts={hideAccounts}
        />
      </Suspense>
    </PageContainer>
  );
}
