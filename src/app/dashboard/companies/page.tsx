import PageContainer from '@/components/layout/page-container';
import { buttonVariants } from '@/components/ui/button';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';
import { searchParamsCache } from '@/lib/searchparams';
import { cn } from '@/lib/utils';
import { IconPlus, IconUpload } from '@tabler/icons-react';
import Link from 'next/link';
import { SearchParams } from 'nuqs/server';
import { Suspense } from 'react';
import { buildCompaniesListOrderBy } from '@/lib/companies-list-order-by';
import { buildCompaniesLocationSomeWhere } from '@/lib/companies-table-location-filter';
import {
  BLANK_STATE_FILTER_VALUE,
  getDistinctCompanyLocationStates,
  getLocationIdsWithBlankParsedState
} from '@/lib/company-location-states';
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
  const stateFilterRaw = searchParamsCache.get('state');
  const sellerFilterRaw = searchParamsCache.get('seller');
  const buyerLegacyRaw = searchParamsCache.get('buyer');
  const addressFilter = Array.isArray(addressFilterRaw) ? addressFilterRaw[0] : addressFilterRaw;
  const statusFilter = Array.isArray(statusFilterRaw) ? statusFilterRaw[0] : statusFilterRaw;
  const stateFilter = stateFilterRaw?.filter(Boolean) ?? [];
  const sellerVals =
    (sellerFilterRaw?.filter(Boolean)?.length ? sellerFilterRaw : buyerLegacyRaw)?.filter(Boolean) ??
    [];
  const hideAccounts = searchParamsCache.get('hideAccounts') === '1';
  const sort = searchParamsCache.get('sort');

  const skip = (Number(page) - 1) * Number(perPage);
  const take = Number(perPage);

  const blankStateLocationIds = stateFilter.includes(BLANK_STATE_FILTER_VALUE)
    ? await getLocationIdsWithBlankParsedState()
    : null;

  const where: any = {
    Location: {
      some: buildCompaniesLocationSomeWhere({
        addressContains: addressFilter,
        states: stateFilter.length ? stateFilter : null,
        blankStateLocationIds
      })
    },
    hidden: false
  };

  // Search companies (name)
  if (nameFilter || companyFilter) {
    const filterValue = nameFilter || companyFilter;
    where.name = { contains: filterValue, mode: 'insensitive' as const };
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

  if (sellerVals.length === 1) {
    if (sellerVals[0] === 'yes') where.isSeller = true;
    else if (sellerVals[0] === 'no') where.isSeller = false;
  }

  const orderBy = buildCompaniesListOrderBy(sort);

  const [stateOptions, companies, total] = await Promise.all([
    getDistinctCompanyLocationStates(),
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
        isSeller: true,
        metadata: true,
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
        <div className='flex flex-wrap items-center gap-2'>
          <Link
            href='/map/companies/import'
            className={cn(buttonVariants({ variant: 'outline' }), 'text-xs md:text-sm')}
          >
            <IconUpload className='mr-2 h-4 w-4' />
            Import JSON
          </Link>
          <Link
            href='/dashboard/companies/new'
            className={cn(buttonVariants(), 'text-xs md:text-sm')}
          >
            <IconPlus className='mr-2 h-4 w-4' /> Add New
          </Link>
        </div>
      }
    >
      <Suspense
        fallback={
          <DataTableSkeleton columnCount={8} rowCount={8} filterCount={5} />
        }
      >
        <CompaniesTable
          data={companies}
          totalItems={total}
          hideAccounts={hideAccounts}
          stateOptions={stateOptions}
        />
      </Suspense>
    </PageContainer>
  );
}
