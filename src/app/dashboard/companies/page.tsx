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
  const nameFilter = searchParamsCache.get('name');
  const companyFilter = searchParamsCache.get('company');
  const stateFilterRaw = searchParamsCache.get('state');
  const tierFilterRaw = searchParamsCache.get('tier');
  const categoryFilterRaw = searchParamsCache.get('category');
  const subCategoryGroupFilterRaw = searchParamsCache.get('subCategoryGroup');
  const statusFilterRaw = searchParamsCache.get('status');
  const stateFilter = Array.isArray(stateFilterRaw) ? stateFilterRaw[0] : stateFilterRaw;
  const tierFilter = Array.isArray(tierFilterRaw) ? tierFilterRaw[0] : tierFilterRaw;
  const categoryFilter = Array.isArray(categoryFilterRaw) ? categoryFilterRaw[0] : categoryFilterRaw;
  const subCategoryGroupFilter = Array.isArray(subCategoryGroupFilterRaw) ? subCategoryGroupFilterRaw[0] : subCategoryGroupFilterRaw;
  const statusFilter = Array.isArray(statusFilterRaw) ? statusFilterRaw[0] : statusFilterRaw;
  const sort = searchParamsCache.get('sort');

  const skip = (Number(page) - 1) * Number(perPage);
  const take = Number(perPage);

  const where: any = {};

  // Search companies (name)
  if (nameFilter || companyFilter) {
    const filterValue = nameFilter || companyFilter;
    where.name = { contains: filterValue, mode: 'insensitive' as const };
  }

  // State: companies that have at least one location in this state
  if (stateFilter) {
    where.Location = {
      some: {
        addressComponents: {
          path: ['state'],
          equals: stateFilter
        }
      }
    };
  }

  // Tier (Company.tier)
  if (tierFilter) {
    where.tier = { equals: tierFilter, mode: 'insensitive' as const };
  }

  // Category (Company.category)
  if (categoryFilter) {
    where.category = { equals: categoryFilter, mode: 'insensitive' as const };
  }

  // Sub category group (Company.subtypeGroup)
  if (subCategoryGroupFilter) {
    where.subtypeGroup = { equals: subCategoryGroupFilter, mode: 'insensitive' as const };
  }

  // Status (APR Account, Contacted - meeting set, etc.)
  if (statusFilter) {
    where.status = { equals: statusFilter, mode: 'insensitive' as const };
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
      tier: 'tier',
      category: 'category',
      subCategoryGroup: 'subtypeGroup',
      createdAt: 'createdAt',
      locations: 'createdAt' // locations is computed, fallback to createdAt
    };
    
    const field = fieldMap[firstSort.id] || 'createdAt';
    orderBy = {
      [field]: firstSort.desc ? 'desc' : 'asc'
    };
  }

  const [companies, total, locationStates, tiers, categories, subtypeGroups] = await Promise.all([
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
        subtype: true,
        subtypeGroup: true,
        tier: true,
        category: true,
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
    prisma.company.count({ where }),
    prisma.location.findMany({
      select: { addressComponents: true }
    }),
    prisma.company.findMany({
      where: { tier: { not: null } },
      select: { tier: true },
      distinct: ['tier'],
      orderBy: { tier: 'asc' }
    }),
    prisma.company.findMany({
      where: { category: { not: null } },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' }
    }),
    prisma.company.findMany({
      where: { subtypeGroup: { not: null } },
      select: { subtypeGroup: true },
      distinct: ['subtypeGroup'],
      orderBy: { subtypeGroup: 'asc' }
    })
  ]);

  const stateOptions = Array.from(
    new Set(
      locationStates
        .map((loc) => (loc.addressComponents as { state?: string } | null)?.state)
        .filter(Boolean) as string[]
    )
  )
    .sort()
    .map((value) => ({ label: value, value }));

  const subCategoryGroupOptions = (subtypeGroups.map((c) => c.subtypeGroup).filter(Boolean) as string[]).map(
    (value) => ({ label: value, value })
  );

  const tierOptions = (tiers.map((c) => c.tier).filter(Boolean) as string[]).map(
    (value) => ({ label: value, value })
  );

  const categoryOptions = (categories
    .map((c) => c.category)
    .filter((v): v is string => v != null && v !== '' && v.toLowerCase() !== 'yes')
  ).map((value) => ({ label: value, value }));

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
          <DataTableSkeleton columnCount={7} rowCount={8} filterCount={3} />
        }
      >
        <CompaniesTable
          data={companies}
          totalItems={total}
          stateOptions={stateOptions}
          tierOptions={tierOptions}
          categoryOptions={categoryOptions}
          subCategoryGroupOptions={subCategoryGroupOptions}
        />
      </Suspense>
    </PageContainer>
  );
}
