'use client';

import { Button } from '@/components/ui/button';
import { IconBrandApple } from '@tabler/icons-react';
import { buildLastLegGeocodeUrl } from '@/lib/lastleg-url';

type Props = {
  locationId: string;
  addressRaw: string;
  companyId: string;
};

export function AddToLastLegButton({ locationId, addressRaw, companyId }: Props) {
  const handleClick = () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const url = buildLastLegGeocodeUrl({
      locationId,
      addressRaw,
      companyId,
      baseUrl
    });
    window.location.href = url;
  };

  return (
    <Button variant='outline' size='sm' onClick={handleClick}>
      <IconBrandApple className='mr-2 h-4 w-4' />
      Add to LastLeg
    </Button>
  );
}
