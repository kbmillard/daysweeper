export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { prisma } from '@/lib/prisma';
import { BinsTable } from './bins-table';
import { BinsUploadButton } from './bins-upload-button';
import PageContainer from '@/components/layout/page-container';

const BINS_LIMIT = 5000;

export default async function BinsPage() {
  const bins = await prisma.warehouseItem.findMany({
    orderBy: { updatedAt: 'desc' },
    take: BINS_LIMIT
  });

  const binsWithNumbers = bins.map((bin) => ({
    ...bin,
    price: bin.price ? Number(bin.price) : null,
    changedAt: bin.changedAt ? new Date(bin.changedAt) : null,
    createdAt: new Date(bin.createdAt),
    updatedAt: new Date(bin.updatedAt)
  }));

  return (
    <PageContainer>
      <div className='flex flex-1 flex-col space-y-4'>
        <div className='flex items-center justify-between'>
          <h2 className='text-2xl font-bold tracking-tight'>Inventory</h2>
          <BinsUploadButton />
        </div>
        <BinsTable initialData={binsWithNumbers} />
      </div>
    </PageContainer>
  );
}
