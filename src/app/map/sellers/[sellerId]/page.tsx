import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import LocationMapCard from '@/features/locations/location-map-card';
import { AddSellerToLastLegButton } from '@/features/sellers/add-seller-to-lastleg-button';
import { prisma } from '@/lib/prisma';
import { IconArrowLeft } from '@tabler/icons-react';

export const dynamic = 'force-dynamic';

export async function generateMetadata(props: { params: Promise<{ sellerId: string }> }) {
  const { sellerId } = await props.params;
  const s = await prisma.seller.findUnique({ where: { id: sellerId }, select: { name: true } });
  return { title: s ? `Seller: ${s.name}` : 'Seller' };
}

export default async function SellerDetailPage(props: { params: Promise<{ sellerId: string }> }) {
  const { sellerId } = await props.params;
  const seller = await prisma.seller.findUnique({ where: { id: sellerId } });
  if (!seller) notFound();

  const lat = seller.latitude != null ? Number(seller.latitude) : null;
  const lng = seller.longitude != null ? Number(seller.longitude) : null;
  const hasCoords = lat != null && lng != null;

  return (
    <PageContainer scrollable pageTitle={seller.name} pageDescription={seller.role ?? 'Seller / competitor'}>
      <div className='flex flex-wrap gap-2 pb-4'>
        <Link href='/map/sellers'>
          <Button variant='outline' size='sm'>
            <IconArrowLeft className='mr-2 h-4 w-4' />
            All sellers
          </Button>
        </Link>
        <AddSellerToLastLegButton sellerId={seller.id} sellerName={seller.name} disabled={!hasCoords} />
      </div>

      <LocationMapCard latitude={lat} longitude={lng} address={seller.addressRaw} />

      <div className='mt-6 space-y-2 text-sm'>
        <p>
          <span className='text-muted-foreground'>Address: </span>
          {seller.addressRaw || '—'}
        </p>
        {seller.phone && (
          <p>
            <span className='text-muted-foreground'>Phone: </span>
            <a href={`tel:${seller.phone.replace(/\s/g, '')}`} className='text-primary underline'>
              {seller.phone}
            </a>
          </p>
        )}
        {seller.website && (
          <p>
            <span className='text-muted-foreground'>Website: </span>
            <a href={seller.website} target='_blank' rel='noopener noreferrer' className='text-primary underline break-all'>
              {seller.website}
            </a>
          </p>
        )}
        {seller.importCategory && (
          <p>
            <span className='text-muted-foreground'>Import category: </span>
            {seller.importCategory}
          </p>
        )}
        {seller.notes && (
          <div className='rounded-lg border bg-muted/30 p-4'>
            <p className='text-muted-foreground text-xs uppercase mb-1'>Notes</p>
            <p className='whitespace-pre-wrap'>{seller.notes}</p>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
