import { Button } from '@/components/ui/button';
import { IconArrowLeft } from '@tabler/icons-react';
import Link from 'next/link';
import LocationEditableFields from '@/features/locations/location-editable-fields';
import LocationMapCard from '@/features/locations/location-map-card';
import { DeleteLocationButton } from '@/features/locations/delete-location-button';
import CompanyInteractions from '../../company-interactions';

type LocationWithCompany = {
  id: string;
  externalId: string | null;
  companyId: string;
  addressRaw: string;
  addressNormalized: string | null;
  addressComponents: any;
  latitude: any;
  longitude: any;
  geom?: any;
  legacyJson: any;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
  Company: {
    id: string;
    name: string;
    website: string | null;
    phone: string | null;
    email: string | null;
    Location: Array<{
      id: string;
      addressRaw: string;
    }>;
  };
};

const BASE = '/dashboard';

type Props = {
  location: LocationWithCompany;
  baseUrl?: string;
};

export default function LocationDetailView({ location, baseUrl }: Props) {
  const company = location.Company;
  const lat = location.latitude != null ? Number(location.latitude) : null;
  const lng = location.longitude != null ? Number(location.longitude) : null;

  return (
    <div className='flex flex-col gap-6 pb-8'>
      {/* Header Actions */}
      <div className='flex items-center justify-between'>
        <div className='flex gap-2'>
          <Link href={`${BASE}/companies/${company.id}`}>
            <Button variant='outline' size='sm'>
              <IconArrowLeft className='mr-2 h-4 w-4' />
              Back to Company
            </Button>
          </Link>
          <DeleteLocationButton
            locationId={location.id}
            companyId={company.id}
            basePath='dashboard'
            buttonText='Remove as location'
          />
        </div>
        <Link href={`${BASE}/companies`}>
          <Button variant='ghost' size='sm'>
            All Companies
          </Button>
        </Link>
      </div>

      <LocationMapCard
        latitude={lat}
        longitude={lng}
        address={location.addressRaw}
      />

      <LocationEditableFields
        location={{
          id: location.id,
          externalId: location.externalId,
          companyId: location.companyId,
          addressRaw: location.addressRaw,
          addressNormalized: location.addressNormalized,
          addressComponents: location.addressComponents,
          latitude: lat,
          longitude: lng
        }}
        company={{
          id: company.id,
          name: company.name,
          website: company.website,
          phone: company.phone,
          email: company.email
        }}
      />

      <div className='w-full min-w-0'>
        <CompanyInteractions companyId={company.id} />
      </div>
    </div>
  );
}
