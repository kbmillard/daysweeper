import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { IconBuilding, IconMail, IconPhone, IconWorld, IconMapPin, IconArrowLeft } from '@tabler/icons-react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';

type CompanyWithRelations = {
  id: string;
  name: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  tier: string | null;
  segment: string | null;
  category: string | null;
  subtype: string | null;
  companyKey: string | null;
  externalId: string | null;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
  Location: Array<{
    id: string;
    externalId: string | null;
    addressRaw: string;
    addressNormalized: string | null;
    addressComponents: any;
    addressConfidence: number | null;
    latitude: any;
    longitude: any;
    createdAt: Date;
    updatedAt: Date;
  }>;
  Company: {
    id: string;
    name: string;
    website: string | null;
  } | null;
  other_Company: Array<{
    id: string;
    name: string;
    website: string | null;
  }>;
};

type Props = {
  company: CompanyWithRelations;
};

export default async function CompanyDetailView({ company }: Props) {
  const locationCount = company.Location?.length || 0;
  const childCompanies = company.other_Company || [];

  return (
    <div className='space-y-6'>
      {/* Header Actions */}
      <div className='flex items-center justify-between'>
        <Link href='/dashboard/companies'>
          <Button variant='outline' size='sm'>
            <IconArrowLeft className='mr-2 h-4 w-4' />
            Back to Companies
          </Button>
        </Link>
      </div>

      <div className='grid gap-6 md:grid-cols-2'>
        {/* Company Information */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <IconBuilding className='h-5 w-5' />
              Company Information
            </CardTitle>
            <CardDescription>Basic company details</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div>
              <label className='text-sm font-medium text-muted-foreground'>Company Name</label>
              <p className='text-lg font-semibold'>{company.name}</p>
            </div>

            {company.companyKey && (
              <div>
                <label className='text-sm font-medium text-muted-foreground'>Company Key</label>
                <p className='text-sm'>{company.companyKey}</p>
              </div>
            )}

            {company.externalId && (
              <div>
                <label className='text-sm font-medium text-muted-foreground'>External ID</label>
                <p className='text-sm font-mono text-xs'>{company.externalId}</p>
              </div>
            )}

            <Separator />

            <div className='flex flex-wrap gap-2'>
              {company.segment && (
                <Badge variant='outline' className='capitalize'>
                  {company.segment}
                </Badge>
              )}
              {company.tier && (
                <Badge variant='secondary' className='capitalize'>
                  {company.tier}
                </Badge>
              )}
              {company.category && (
                <Badge variant='outline' className='capitalize'>
                  {company.category}
                </Badge>
              )}
              {company.subtype && (
                <Badge variant='outline' className='capitalize'>
                  {company.subtype}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
            <CardDescription>Company contact details</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
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

            {!company.website && !company.email && !company.phone && (
              <p className='text-sm text-muted-foreground'>No contact information available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Parent Company */}
      {company.Company && (
        <Card>
          <CardHeader>
            <CardTitle>Parent Company</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href={`/dashboard/companies/${company.Company.id}`}
              className='text-sm text-primary hover:underline'
            >
              {company.Company.name}
            </Link>
            {company.Company.website && (
              <p className='text-xs text-muted-foreground mt-1'>{company.Company.website}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Child Companies */}
      {childCompanies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Child Companies ({childCompanies.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-2'>
              {childCompanies.map((child) => (
                <div key={child.id} className='flex items-center justify-between'>
                  <Link
                    href={`/dashboard/companies/${child.id}`}
                    className='text-sm text-primary hover:underline'
                  >
                    {child.name}
                  </Link>
                  {child.website && (
                    <span className='text-xs text-muted-foreground'>{child.website}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Locations */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <IconMapPin className='h-5 w-5' />
            Locations ({locationCount})
          </CardTitle>
          <CardDescription>Company locations and facilities</CardDescription>
        </CardHeader>
        <CardContent>
          {locationCount > 0 ? (
            <div className='space-y-4'>
              {company.Location.map((location) => (
                <div
                  key={location.id}
                  className='border rounded-lg p-4 hover:bg-accent/50 transition-colors'
                >
                  <div className='flex items-start justify-between'>
                    <div className='flex-1'>
                      <Link
                        href={`/dashboard/companies/${company.id}/locations/${location.id}`}
                        className='font-medium text-primary hover:underline'
                      >
                        {location.addressRaw}
                      </Link>
                      {location.addressNormalized && (
                        <p className='text-sm text-muted-foreground mt-1'>
                          {location.addressNormalized}
                        </p>
                      )}
                      {location.addressComponents && (
                        <div className='flex flex-wrap gap-2 mt-2'>
                          {location.addressComponents.city && (
                            <Badge variant='outline' className='text-xs'>
                              {location.addressComponents.city}
                            </Badge>
                          )}
                          {location.addressComponents.state && (
                            <Badge variant='outline' className='text-xs'>
                              {location.addressComponents.state}
                            </Badge>
                          )}
                          {location.addressComponents.postal_code && (
                            <Badge variant='outline' className='text-xs'>
                              {location.addressComponents.postal_code}
                            </Badge>
                          )}
                          {location.addressComponents.country && (
                            <Badge variant='outline' className='text-xs'>
                              {location.addressComponents.country}
                            </Badge>
                          )}
                        </div>
                      )}
                      {location.addressConfidence && (
                        <p className='text-xs text-muted-foreground mt-2'>
                          Confidence: {Math.round(location.addressConfidence * 100)}%
                        </p>
                      )}
                    </div>
                    <Link
                      href={`/dashboard/companies/${company.id}/locations/${location.id}`}
                      className='ml-4'
                    >
                      <Button variant='outline' size='sm'>
                        View Details
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className='text-sm text-muted-foreground'>No locations found</p>
          )}
        </CardContent>
      </Card>

      {/* Metadata */}
      {company.metadata && Object.keys(company.metadata).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Additional Information</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className='text-xs bg-muted p-4 rounded-lg overflow-auto'>
              {JSON.stringify(company.metadata, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
