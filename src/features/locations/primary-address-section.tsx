'use client';

import { DeleteLocationButton } from './delete-location-button';
import { AddToLastLegButton } from './add-to-lastleg-button';
import LocationEditableFields from './location-editable-fields';

type Props = {
  primaryLocation: {
    id: string;
    externalId?: string | null;
    addressRaw: string;
    addressNormalized?: string | null;
    addressComponents?: unknown;
    latitude?: number | null | unknown;
    longitude?: number | null | unknown;
  };
  company: {
    id: string;
    name: string;
    website: string | null;
    phone: string | null;
    email: string | null;
  };
  basePath: 'map' | 'dashboard';
};

export function PrimaryAddressSection({ primaryLocation, company, basePath }: Props) {
  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between gap-2 flex-wrap'>
        <h2 className='text-xl font-semibold'>Primary address</h2>
        <div className='flex items-center gap-2'>
          {primaryLocation.addressRaw?.trim() && (
            <AddToLastLegButton
              locationId={primaryLocation.id}
              companyId={company.id}
              addressRaw={primaryLocation.addressRaw}
              latitude={primaryLocation.latitude != null ? Number(primaryLocation.latitude) : null}
              longitude={primaryLocation.longitude != null ? Number(primaryLocation.longitude) : null}
            />
          )}
          <DeleteLocationButton
            locationId={primaryLocation.id}
            companyId={company.id}
            basePath={basePath}
            refreshOnly
            variant='outline'
            size='sm'
            buttonText='Delete'
          />
        </div>
      </div>
      <LocationEditableFields
        location={{
          id: primaryLocation.id,
          externalId: primaryLocation.externalId ?? null,
          companyId: company.id,
          addressRaw: primaryLocation.addressRaw,
          addressNormalized: primaryLocation.addressNormalized ?? null,
          addressComponents: (primaryLocation.addressComponents || null) as {
            city?: string;
            state?: string;
            postal_code?: string;
            country?: string;
          } | null,
          latitude: primaryLocation.latitude != null ? Number(primaryLocation.latitude) : null,
          longitude: primaryLocation.longitude != null ? Number(primaryLocation.longitude) : null
        }}
        company={{
          id: company.id,
          name: company.name,
          website: company.website,
          phone: company.phone,
          email: company.email
        }}
        locationOnly
      />
    </div>
  );
}
