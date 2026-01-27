import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  IconMapPin,
  IconArrowLeft,
  IconBuilding,
  IconWorld,
  IconMail,
  IconPhone
} from '@tabler/icons-react';
import Link from 'next/link';

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
  geom: any;
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

type Props = {
  location: LocationWithCompany;
};

export default function LocationDetailView({ location }: Props) {
  const company = location.Company;
  const otherLocations = company.Location.filter((loc) => loc.id !== location.id);

  return (
    <div className='space-y-6'>
      {/* Header Actions */}
      <div className='flex items-center justify-between'>
        <Link href={`/dashboard/companies/${company.id}`}>
          <Button variant='outline' size='sm'>
            <IconArrowLeft className='mr-2 h-4 w-4' />
            Back to Company
          </Button>
        </Link>
        <Link href='/dashboard/companies'>
          <Button variant='ghost' size='sm'>
            All Companies
          </Button>
        </Link>
      </div>

      <div className='grid gap-6 md:grid-cols-2'>
        {/* Location Information */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <IconMapPin className='h-5 w-5' />
              Location Details
            </CardTitle>
            <CardDescription>Address and location information</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div>
              <label className='text-sm font-medium text-muted-foreground'>Address</label>
              <p className='text-lg font-semibold'>{location.addressRaw}</p>
            </div>

            {location.addressNormalized && (
              <div>
                <label className='text-sm font-medium text-muted-foreground'>
                  Normalized Address
                </label>
                <p className='text-sm'>{location.addressNormalized}</p>
              </div>
            )}

            {location.externalId && (
              <div>
                <label className='text-sm font-medium text-muted-foreground'>External ID</label>
                <p className='text-sm font-mono text-xs'>{location.externalId}</p>
              </div>
            )}

            {location.addressConfidence && (
              <div>
                <label className='text-sm font-medium text-muted-foreground'>
                  Address Confidence
                </label>
                <div className='flex items-center gap-2 mt-1'>
                  <div className='flex-1 bg-muted rounded-full h-2'>
                    <div
                      className='bg-primary h-2 rounded-full'
                      style={{ width: `${location.addressConfidence * 100}%` }}
                    />
                  </div>
                  <span className='text-sm text-muted-foreground'>
                    {Math.round(location.addressConfidence * 100)}%
                  </span>
                </div>
              </div>
            )}

            <Separator />

            {location.addressComponents && (
              <div>
                <label className='text-sm font-medium text-muted-foreground mb-2 block'>
                  Address Components
                </label>
                <div className='flex flex-wrap gap-2'>
                  {location.addressComponents.city && (
                    <Badge variant='outline'>
                      City: {location.addressComponents.city}
                    </Badge>
                  )}
                  {location.addressComponents.state && (
                    <Badge variant='outline'>
                      State: {location.addressComponents.state}
                    </Badge>
                  )}
                  {location.addressComponents.postal_code && (
                    <Badge variant='outline'>
                      ZIP: {location.addressComponents.postal_code}
                    </Badge>
                  )}
                  {location.addressComponents.country && (
                    <Badge variant='outline'>
                      Country: {location.addressComponents.country}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {(location.latitude || location.longitude) && (
              <div>
                <label className='text-sm font-medium text-muted-foreground'>Coordinates</label>
                <p className='text-sm font-mono'>
                  {location.latitude?.toString()}, {location.longitude?.toString()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Company Information */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <IconBuilding className='h-5 w-5' />
              Company
            </CardTitle>
            <CardDescription>Parent company information</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div>
              <Link
                href={`/dashboard/companies/${company.id}`}
                className='text-lg font-semibold text-primary hover:underline'
              >
                {company.name}
              </Link>
            </div>

            {company.website && (
              <div className='flex items-center gap-2'>
                <IconWorld className='h-4 w-4 text-muted-foreground' />
                <a
                  href={company.website}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-sm text-primary hover:underline'
                >
                  {company.website}
                </a>
              </div>
            )}

            {company.email && (
              <div className='flex items-center gap-2'>
                <IconMail className='h-4 w-4 text-muted-foreground' />
                <span className='text-sm'>{company.email}</span>
              </div>
            )}

            {company.phone && (
              <div className='flex items-center gap-2'>
                <IconPhone className='h-4 w-4 text-muted-foreground' />
                <span className='text-sm'>{company.phone}</span>
              </div>
            )}

            <Separator />

            <div>
              <label className='text-sm font-medium text-muted-foreground'>
                Total Locations
              </label>
              <p className='text-sm'>{company.Location.length} location{company.Location.length !== 1 ? 's' : ''}</p>
            </div>
          </CardContent>
        </Card>
      </div>

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
                  href={`/dashboard/companies/${company.id}/locations/${loc.id}`}
                  className='block p-3 border rounded-lg hover:bg-accent/50 transition-colors'
                >
                  <p className='text-sm font-medium'>{loc.addressRaw}</p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      {location.metadata && Object.keys(location.metadata).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Additional Information</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className='text-xs bg-muted p-4 rounded-lg overflow-auto'>
              {JSON.stringify(location.metadata, null, 2)}
            </pre>
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
