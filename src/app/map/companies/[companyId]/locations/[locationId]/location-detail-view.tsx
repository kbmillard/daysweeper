import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IconArrowLeft } from '@tabler/icons-react';
import Link from 'next/link';
import LocationEditableFields from '@/features/locations/location-editable-fields';
import LocationMapCard from '@/features/locations/location-map-card';
import { AddToLastLegButton } from '@/features/locations/add-to-lastleg-button';

type LocationWithCompany = {
  id: string;
  externalId: string | null;
  companyId: string;
  addressRaw: string;
  addressNormalized: string | null;
  addressComponents: any;
  addressConfidence: number | null;
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

const BASE = '/map';

type Props = {
  location: LocationWithCompany;
};

export default function LocationDetailView({ location }: Props) {
  const company = location.Company;
  const otherLocations = company.Location.filter((loc) => loc.id !== location.id);

  const lat = location.latitude != null ? Number(location.latitude) : null;
  const lng = location.longitude != null ? Number(location.longitude) : null;

  return (
    <div className='space-y-6'>
      {/* Header Actions */}
      <div className='flex items-center justify-between'>
        <div className='flex gap-2'>
          <Link href={`${BASE}/companies/${company.id}`}>
            <Button variant='outline' size='sm'>
              <IconArrowLeft className='mr-2 h-4 w-4' />
              Back to Company
            </Button>
          </Link>
          <AddToLastLegButton
            locationId={location.id}
            addressRaw={location.addressRaw}
            companyId={company.id}
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
          addressConfidence:
            location.addressConfidence != null ? Number(location.addressConfidence) : null,
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

      {/* Other Locations */}
      {otherLocations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Other Locations ({otherLocations.length})</CardTitle>
            <CardDescription>Additional locations for this company</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-2'>
              {otherLocations.map((loc) => (
                <Link
                  key={loc.id}
                  href={`${BASE}/companies/${company.id}/locations/${loc.id}`}
                  className='block p-3 border rounded-lg hover:bg-accent/50 transition-colors'
                >
                  <p className='text-sm font-medium'>{loc.addressRaw}</p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legacy JSON */}
      {location.legacyJson && (
        <Card>
          <CardHeader>
            <CardTitle>Legacy Data</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className='text-xs bg-muted p-4 rounded-lg overflow-auto'>
              {JSON.stringify(location.legacyJson, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
