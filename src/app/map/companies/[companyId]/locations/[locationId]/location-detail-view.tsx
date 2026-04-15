import { Button } from '@/components/ui/button';
import { IconArrowLeft } from '@tabler/icons-react';
import Link from 'next/link';
import LocationEditableFields from '@/features/locations/location-editable-fields';
import LocationMapCard from '@/features/locations/location-map-card';
import { DeleteLocationButton } from '@/features/locations/delete-location-button';
import { AddToLastLegButton } from '@/features/locations/add-to-lastleg-button';
import { SetAsHeadquartersButton } from '@/features/companies/set-as-headquarters-button';
import CompanyInteractions from '../../company-interactions';
import { AddChildCompanySearch } from '@/app/dashboard/companies/[companyId]/add-child-company-search';
import { productTypeFromMetadata } from '@/lib/product-type-from-metadata';
import { parseLocationMetadata } from '@/lib/location-primary-sync-metadata';

function linkedPinsFromMetadata(metadata: unknown): { lat: number; lng: number }[] {
  const m = parseLocationMetadata(metadata);
  const raw = m.linkedMapPins;
  if (!Array.isArray(raw)) return [];
  const out: { lat: number; lng: number }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const la = Number(o.lat);
    const lo = Number(o.lng);
    if (Number.isFinite(la) && Number.isFinite(lo)) out.push({ lat: la, lng: lo });
  }
  return out;
}

type LocationWithCompany = {
  id: string;
  externalId: string | null;
  companyId: string;
  addressRaw: string;
  addressNormalized: string | null;
  addressComponents: any;
  latitude: number | null;
  longitude: number | null;
  locationName?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
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
    status: string | null;
    isSeller?: boolean;
    metadata: unknown;
    primaryLocationId: string | null;
    Location: Array<{
      id: string;
      addressRaw: string;
    }>;
  };
};

const BASE = '/map';

type Props = {
  location: LocationWithCompany;
  baseUrl?: string;
};

export default function LocationDetailView({ location, baseUrl }: Props) {
  const company = location.Company;
  const lat = location.latitude != null ? Number(location.latitude) : null;
  const lng = location.longitude != null ? Number(location.longitude) : null;
  const isPrimaryLocation = company.primaryLocationId === location.id;
  const companyProductType = productTypeFromMetadata(company.metadata);
  const linkedMapPins = linkedPinsFromMetadata(location.metadata);

  return (
    <div className='flex flex-col gap-6 pb-8'>
      {/* Header Actions */}
      <div className='flex flex-wrap items-center gap-2'>
        <Link href={`${BASE}/companies/${company.id}`}>
          <Button variant='outline' size='sm'>
            <IconArrowLeft className='mr-2 h-4 w-4' />
            Back to Company
          </Button>
        </Link>
        <SetAsHeadquartersButton companyId={company.id} locationId={location.id} basePath='map' />
        <AddToLastLegButton
          locationId={location.id}
          companyId={company.id}
          companyName={company.name}
          addressRaw={location.addressRaw}
          latitude={lat}
          longitude={lng}
        />
        <AddChildCompanySearch
          mode='pickParentForNewChild'
          currentCompanyId={company.id}
          basePath='map'
          locationPrefill={{
            addressRaw: location.addressRaw,
            latitude: location.latitude,
            longitude: location.longitude,
            sourceLocationId: location.id,
            sourceCompanyId: company.id
          }}
          compact
        />
        <DeleteLocationButton
          locationId={location.id}
          companyId={company.id}
          basePath='map'
          buttonText='Remove as location'
        />
        <Link href={`${BASE}/companies`} className='ml-auto'>
          <Button variant='ghost' size='sm'>
            All Companies
          </Button>
        </Link>
      </div>

      <LocationMapCard
        latitude={lat}
        longitude={lng}
        address={location.addressRaw}
        locationId={location.id}
        linkedPins={linkedMapPins}
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
          longitude: lng,
          locationName: location.locationName,
          phone: location.phone,
          email: location.email,
          website: location.website,
          metadata: location.metadata
        }}
        company={{
          id: company.id,
          name: company.name,
          website: company.website,
          phone: company.phone,
          email: company.email,
          status: company.status,
          productType: companyProductType || null,
          primaryLocationId: company.primaryLocationId,
          isSeller: company.isSeller
        }}
        editableLocationContact
        isPrimaryLocation={isPrimaryLocation}
      />

      <div className='w-full min-w-0'>
        <CompanyInteractions companyId={company.id} />
      </div>
    </div>
  );
}
