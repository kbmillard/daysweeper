import Link from 'next/link';
import PageContainer from '@/components/layout/page-container';
import { buttonVariants } from '@/components/ui/button';
import { prisma } from '@/lib/prisma';
import { cn } from '@/lib/utils';
import { IconUpload } from '@tabler/icons-react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Map: Sellers'
};

export default async function SellersPage() {
  const sellers = await prisma.seller.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      addressRaw: true,
      role: true,
      importCategory: true,
      latitude: true,
      longitude: true
    }
  });

  return (
    <PageContainer
      scrollable
      pageTitle='Sellers'
      pageDescription='Competitors and vendor research (grey pins on the map)'
      pageHeaderAction={
        <Link href='/map/sellers/import' className={cn(buttonVariants(), 'text-xs md:text-sm')}>
          <IconUpload className='mr-2 h-4 w-4' />
          Import JSON
        </Link>
      }
    >
      <div className='rounded-md border'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='border-b bg-muted/50 text-left'>
              <th className='p-3 font-medium'>Name</th>
              <th className='p-3 font-medium'>Address</th>
              <th className='p-3 font-medium'>Role</th>
              <th className='p-3 font-medium'>Map</th>
            </tr>
          </thead>
          <tbody>
            {sellers.length === 0 ? (
              <tr>
                <td colSpan={4} className='p-6 text-muted-foreground'>
                  No sellers yet. Use <Link href='/map/sellers/import' className='underline'>Import JSON</Link>.
                </td>
              </tr>
            ) : (
              sellers.map((s) => (
                <tr key={s.id} className='border-b last:border-0'>
                  <td className='p-3'>
                    <Link href={`/map/sellers/${s.id}`} className='font-medium text-primary hover:underline'>
                      {s.name}
                    </Link>
                  </td>
                  <td className='p-3 text-muted-foreground max-w-md truncate' title={s.addressRaw}>
                    {s.addressRaw || '—'}
                  </td>
                  <td className='p-3 text-muted-foreground'>{s.role || '—'}</td>
                  <td className='p-3'>
                    {s.latitude != null && s.longitude != null ? (
                      <span className='text-emerald-600'>Geocoded</span>
                    ) : (
                      <span className='text-amber-600'>Pending</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </PageContainer>
  );
}
