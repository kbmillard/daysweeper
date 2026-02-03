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
import CompaniesMap from './companies-map';

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
  const segmentFilter = searchParamsCache.get('segment');
  const tierFilter = searchParamsCache.get('tier');
  const emailFilter = searchParamsCache.get('email');
  const phoneFilter = searchParamsCache.get('phone');
  const websiteFilter = searchParamsCache.get('website');
  const statusFilter = searchParamsCache.get('status');
  const sort = searchParamsCache.get('sort');

  const skip = (Number(page) - 1) * Number(perPage);
  const take = Number(perPage);

  const where: any = {};
  
  // Company name filter (from 'name' or 'company' param)
  if (nameFilter || companyFilter) {
    const filterValue = nameFilter || companyFilter;
    where.name = { contains: filterValue, mode: 'insensitive' as const };
  }
  
  if (segmentFilter) {
    where.segment = { equals: segmentFilter, mode: 'insensitive' as const };
  }
  
  if (tierFilter) {
    where.tier = { equals: tierFilter, mode: 'insensitive' as const };
  }

  if (emailFilter) {
    where.email = { contains: emailFilter, mode: 'insensitive' as const };
  }

  if (phoneFilter) {
    where.phone = { contains: phoneFilter, mode: 'insensitive' as const };
  }

  if (websiteFilter) {
    where.website = { contains: websiteFilter, mode: 'insensitive' as const };
  }

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
      email: 'email',
      phone: 'phone',
      website: 'website',
      segment: 'segment',
      tier: 'tier',
      status: 'status',
      createdAt: 'createdAt',
      locations: 'createdAt' // locations is computed, fallback to createdAt
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
        phone: true,
        email: true,
        segment: true,
        tier: true,
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
      <section className="mt-6">
        <h2 className="text-sm font-medium text-muted-foreground mb-2">
          Map
        </h2>
        <CompaniesMap mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN} />
      </section>
    </PageContainer>
  );
}
