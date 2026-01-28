import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { BinsTable } from './bins-table';
import { BinsUploadButton } from './bins-upload-button';
import PageContainer from '@/components/layout/page-container';

export default async function BinsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/auth/sign-in');
  }

  const bins = await prisma.warehouseItem.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 1000,
  });

  return (
    <PageContainer>
      <div className="flex flex-1 flex-col space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Warehouse Bins</h2>
            <p className="text-muted-foreground">
              Manage inventory items and their bin locations
            </p>
          </div>
          <BinsUploadButton />
        </div>
        <BinsTable initialData={bins} />
      </div>
    </PageContainer>
  );
}
