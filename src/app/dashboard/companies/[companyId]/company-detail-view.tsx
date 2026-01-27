import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IconArrowLeft } from '@tabler/icons-react';
import Link from 'next/link';

type CompanyData = {
  id: string;
  name: string;
  website: string | null;
  phone: string | null;
  category: string | null;
  subtype: string | null;
  metadata: any;
  Location: Array<{
    addressRaw: string;
    addressComponents: any;
  }>;
};

type Props = {
  company: CompanyData;
};

export default function CompanyDetailView({ company }: Props) {
  const primaryLocation = company.Location?.[0];
  const addressComponents = primaryLocation?.addressComponents || {};
  
  // Get phone from metadata.contactInfo if phone field is empty
  const phone = company.phone || company.metadata?.contactInfo?.phone || null;
  
  // Get supply chain fields from metadata if not in direct fields
  const supplyChainCategory = company.category || company.metadata?.supplyChainCategory || null;
  const supplyChainSubtype = company.subtype || company.metadata?.supplyChainSubtype || null;

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <Link href='/dashboard/companies'>
          <Button variant='outline' size='sm'>
            <IconArrowLeft className='mr-2 h-4 w-4' />
            Back to Companies
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Company Details</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid gap-4 md:grid-cols-2'>
            <div>
              <label className='text-sm font-medium text-muted-foreground'>Company</label>
              <p className='text-base font-semibold mt-1'>{company.name}</p>
            </div>

            <div>
              <label className='text-sm font-medium text-muted-foreground'>Website</label>
              {company.website ? (
                <p className='text-base mt-1'>
                  <a
                    href={company.website}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-primary hover:underline'
                  >
                    {company.website}
                  </a>
                </p>
              ) : (
                <p className='text-base text-muted-foreground mt-1'>—</p>
              )}
            </div>

            <div>
              <label className='text-sm font-medium text-muted-foreground'>Phone</label>
              {phone ? (
                <p className='text-base mt-1'>{phone}</p>
              ) : (
                <p className='text-base text-muted-foreground mt-1'>—</p>
              )}
            </div>

            <div>
              <label className='text-sm font-medium text-muted-foreground'>Address</label>
              {primaryLocation?.addressRaw ? (
                <p className='text-base mt-1'>{primaryLocation.addressRaw}</p>
              ) : (
                <p className='text-base text-muted-foreground mt-1'>—</p>
              )}
            </div>

            <div>
              <label className='text-sm font-medium text-muted-foreground'>City</label>
              {addressComponents.city ? (
                <p className='text-base mt-1'>{addressComponents.city}</p>
              ) : (
                <p className='text-base text-muted-foreground mt-1'>—</p>
              )}
            </div>

            <div>
              <label className='text-sm font-medium text-muted-foreground'>State</label>
              {addressComponents.state ? (
                <p className='text-base mt-1'>{addressComponents.state}</p>
              ) : (
                <p className='text-base text-muted-foreground mt-1'>—</p>
              )}
            </div>

            <div>
              <label className='text-sm font-medium text-muted-foreground'>Postal Code</label>
              {addressComponents.postal_code ? (
                <p className='text-base mt-1'>{addressComponents.postal_code}</p>
              ) : (
                <p className='text-base text-muted-foreground mt-1'>—</p>
              )}
            </div>

            <div>
              <label className='text-sm font-medium text-muted-foreground'>Country</label>
              {addressComponents.country ? (
                <p className='text-base mt-1'>{addressComponents.country}</p>
              ) : (
                <p className='text-base text-muted-foreground mt-1'>—</p>
              )}
            </div>

            <div>
              <label className='text-sm font-medium text-muted-foreground'>Supply Chain Category</label>
              {supplyChainCategory ? (
                <p className='text-base mt-1'>{supplyChainCategory}</p>
              ) : (
                <p className='text-base text-muted-foreground mt-1'>—</p>
              )}
            </div>

            <div>
              <label className='text-sm font-medium text-muted-foreground'>Supply Chain Subtype</label>
              {supplyChainSubtype ? (
                <p className='text-base mt-1'>{supplyChainSubtype}</p>
              ) : (
                <p className='text-base text-muted-foreground mt-1'>—</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
