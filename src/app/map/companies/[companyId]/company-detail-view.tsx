'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IconArrowLeft, IconPlus } from '@tabler/icons-react';
import Link from 'next/link';
import CompanyEditableFields from './company-editable-fields';
import CompanyInteractions from './company-interactions';
import { AddChildCompanySearch } from '@/app/dashboard/companies/[companyId]/add-child-company-search';
import { LinkExistingCompanyAsLocation } from '@/features/companies/link-existing-company-as-location';
import { RemoveAsChildButton } from '@/features/companies/remove-as-child-button';
import { DeleteLocationButton } from '@/features/locations/delete-location-button';
import { PrimaryAddressSection } from '@/features/locations/primary-address-section';
import CompanyLocationsMap from '@/features/companies/company-locations-map';
import { filterLegacyKeyFacts } from '@/lib/filter-legacy-metadata';

type CompanyMetadata = {
  keyProducts?: string[] | null;
  industryKeywords?: string[] | null;
  keyFacts?: Record<string, unknown> | null;
  profile?: {
    summary?: string | null;
    keyFacts?: Record<string, unknown> | null;
    businessActivities?: string | null;
    roleWithinGroup?: string | null;
    localPresence?: string | null;
    profileMarkdown?: string | null;
  } | null;
  contactInfo?: { phone?: string; email?: string } | null;
  supplyChainCategory?: string | null;
};

type CompanyData = {
  id: string;
  externalId?: string | null;
  name: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  status: string | null;
  metadata: unknown;
  Location: Array<{
    id?: string;
    externalId?: string | null;
    addressRaw: string;
    addressNormalized?: string | null;
    locationName?: string | null;
    addressComponents?: unknown;
    latitude?: number | null | unknown;
    longitude?: number | null | unknown;
    createdAt?: Date;
    updatedAt?: Date;
  }>;
  Company?: CompanyData | null; // Parent company
  other_Company?: CompanyData[]; // Child companies
};

type Props = {
  company: CompanyData;
  baseUrl?: string;
};

// Component to render a company card (reusable for parent/child)
function CompanyCard({
  company,
  title
}: {
  company: CompanyData;
  title: string;
}) {
  const primaryLocation = company.Location?.[0];
  const addressComponents = (primaryLocation?.addressComponents || {}) as {
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };

  // Get phone from metadata.contactInfo if phone field is empty
  const phone =
    company.phone ||
    (company.metadata as CompanyMetadata | null)?.contactInfo?.phone ||
    null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center justify-between'>
          <span>{title}</span>
          <Link href={`/dashboard/companies/${company.id}`}>
            <Button variant='outline' size='sm'>
              View Details
            </Button>
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid gap-4 md:grid-cols-2'>
          <div>
            <label className='text-muted-foreground text-sm font-medium'>
              Company
            </label>
            <p className='mt-1 text-base font-semibold'>{company.name}</p>
          </div>

          <div>
            <label className='text-muted-foreground text-sm font-medium'>
              Website
            </label>
            {company.website ? (
              <p className='mt-1 text-base'>
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
              <p className='text-muted-foreground mt-1 text-base'>—</p>
            )}
          </div>

          <div>
            <label className='text-muted-foreground text-sm font-medium'>
              Phone
            </label>
            {phone ? (
              <p className='mt-1 text-base'>{phone}</p>
            ) : (
              <p className='text-muted-foreground mt-1 text-base'>—</p>
            )}
          </div>

          <div>
            <label className='text-muted-foreground text-sm font-medium'>
              Address
            </label>
            {primaryLocation?.addressRaw ? (
              <p className='mt-1 text-base'>{primaryLocation.addressRaw}</p>
            ) : (
              <p className='text-muted-foreground mt-1 text-base'>—</p>
            )}
          </div>

          <div>
            <label className='text-muted-foreground text-sm font-medium'>
              City
            </label>
            {addressComponents.city ? (
              <p className='mt-1 text-base'>{String(addressComponents.city)}</p>
            ) : (
              <p className='text-muted-foreground mt-1 text-base'>—</p>
            )}
          </div>

          <div>
            <label className='text-muted-foreground text-sm font-medium'>
              State
            </label>
            {addressComponents.state ? (
              <p className='mt-1 text-base'>{String(addressComponents.state)}</p>
            ) : (
              <p className='text-muted-foreground mt-1 text-base'>—</p>
            )}
          </div>

          <div>
            <label className='text-muted-foreground text-sm font-medium'>
              Postal Code
            </label>
            {addressComponents.postal_code ? (
              <p className='mt-1 text-base'>{String(addressComponents.postal_code)}</p>
            ) : (
              <p className='text-muted-foreground mt-1 text-base'>—</p>
            )}
          </div>

          <div>
            <label className='text-muted-foreground text-sm font-medium'>
              Country
            </label>
            {addressComponents.country ? (
              <p className='mt-1 text-base'>{String(addressComponents.country)}</p>
            ) : (
              <p className='text-muted-foreground mt-1 text-base'>—</p>
            )}
          </div>

        </div>
      </CardContent>
    </Card>
  );
}

export default function CompanyDetailView({ company, baseUrl }: Props) {
  const meta = (company.metadata ?? null) as CompanyMetadata | null;
  const primaryLocation = company.Location?.[0];

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <Link href='/map/companies'>
          <Button variant='outline' size='sm'>
            <IconArrowLeft className='mr-2 h-4 w-4' />
            Back to Companies
          </Button>
        </Link>
      </div>

      <CompanyEditableFields
        company={{
          id: company.id,
          name: company.name,
          website: company.website,
          phone: company.phone,
          email: company.email ?? null,
          status: company.status ?? null
        }}
      />

      {/* Company profile (summary, key facts, business activities, role, local presence, markdown) */}
      {meta?.profile && (
        <Card>
          <CardHeader>
            <CardTitle>Company profile</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            {meta.profile.summary && (
              <div>
                <label className='text-muted-foreground text-sm font-medium'>
                  Summary
                </label>
                <p className='mt-1 text-base'>{meta.profile.summary}</p>
              </div>
            )}
            {(() => {
              const profileFacts = (meta.profile?.keyFacts ?? meta.keyFacts) as Record<string, unknown> | null | undefined;
              const filtered = filterLegacyKeyFacts(profileFacts);
              return profileFacts && typeof profileFacts === 'object' && Object.keys(filtered).length > 0 && (
                <div>
                  <label className='text-muted-foreground text-sm font-medium'>
                    Key facts
                  </label>
                  <ul className='mt-1 list-inside list-disc space-y-0.5 text-sm'>
                    {Object.entries(filtered).map(([k, v]) => {
                        if (v == null) return null;
                        const disp = Array.isArray(v)
                          ? (v as string[]).join(', ')
                          : String(v);
                        return (
                          <li key={k}>
                            <span className='font-medium capitalize'>
                              {k.replace(/([A-Z])/g, ' $1').trim()}:
                            </span>{' '}
                            {disp}
                          </li>
                        );
                      })}
                  </ul>
                </div>
              );
            })()}
            {meta.profile.businessActivities && (
              <div>
                <label className='text-muted-foreground text-sm font-medium'>
                  Business activities
                </label>
                <p className='mt-1 text-base'>
                  {meta.profile.businessActivities}
                </p>
              </div>
            )}
            {meta.profile.roleWithinGroup && (
              <div>
                <label className='text-muted-foreground text-sm font-medium'>
                  Role within group
                </label>
                <p className='mt-1 text-base'>{meta.profile.roleWithinGroup}</p>
              </div>
            )}
            {meta.profile.localPresence && (
              <div>
                <label className='text-muted-foreground text-sm font-medium'>
                  Local presence
                </label>
                <p className='mt-1 text-base'>{meta.profile.localPresence}</p>
              </div>
            )}
            {meta.profile.profileMarkdown && (
              <div>
                <label className='text-muted-foreground text-sm font-medium'>
                  Profile (markdown)
                </label>
                <pre className='bg-muted mt-1 rounded-md p-3 font-sans text-sm whitespace-pre-wrap'>
                  {meta.profile.profileMarkdown}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <CompanyLocationsMap locations={company.Location ?? []} companyName={company.name} />

      {/* Locations list – all addresses for this company */}
      <div className='space-y-4'>
        <div className='flex items-center justify-between flex-wrap gap-2'>
          <h2 className='text-xl font-semibold'>
            Locations ({company.Location?.length ?? 0})
          </h2>
          <Link href={`/map/companies/${company.id}/locations/new`}>
            <Button size='sm'>
              <IconPlus className='mr-2 h-4 w-4' />
              Add location
            </Button>
          </Link>
        </div>
        {company.Location && company.Location.length > 0 ? (
          <div className='rounded-md border'>
            {company.Location.map((loc, idx) => (
              <div
                key={loc.id ?? idx}
                className={`flex items-center justify-between gap-2 px-4 py-3 text-sm transition-colors hover:bg-accent/50 ${idx > 0 ? 'border-t' : ''}`}
              >
                {loc.id ? (
                  <Link
                    href={`/map/companies/${company.id}/locations/${loc.id}`}
                    className='flex-1 min-w-0 flex flex-col gap-0.5'
                  >
                    {loc.locationName && (
                      <span className='font-medium text-primary hover:underline truncate'>
                        {loc.locationName}
                      </span>
                    )}
                    <span className={`truncate ${loc.locationName ? 'text-muted-foreground text-xs' : 'text-primary hover:underline'}`}>
                      {loc.addressRaw || 'Address not specified'}
                    </span>
                  </Link>
                ) : (
                  <span className='flex-1 truncate text-muted-foreground'>
                    {loc.locationName && `${loc.locationName} – `}
                    {loc.addressRaw || 'Address not specified'}
                  </span>
                )}
                {loc.id && (
                  <DeleteLocationButton
                    locationId={loc.id}
                    companyId={company.id}
                    basePath='map'
                    refreshOnly
                    variant='outline'
                    size='sm'
                    buttonText='Delete'
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className='text-muted-foreground text-sm'>
            No locations yet. Add one to get started.
          </p>
        )}
        <div className='pt-2 border-t'>
          <p className='text-sm font-medium mb-2'>Link existing company as location</p>
          <LinkExistingCompanyAsLocation targetCompanyId={company.id} />
        </div>
      </div>

      {primaryLocation && primaryLocation.id && (
        <PrimaryAddressSection
          primaryLocation={{ ...primaryLocation, id: primaryLocation.id }}
          company={{
            id: company.id,
            name: company.name,
            website: company.website,
            phone: company.phone,
            email: company.email ?? null
          }}
          basePath='map'
        />
      )}

      {/* Parent Company – only show when there is a parent and it's different from this company */}
      {company.Company && company.Company.id !== company.id ? (
        <div className='space-y-2'>
          <h2 className='text-xl font-semibold'>Parent Company</h2>
          <CompanyCard company={company.Company} title='Parent Company' />
          <Link href={`/dashboard/companies/${company.id}/set-parent`}>
            <Button variant='ghost' size='sm'>
              Change or clear parent
            </Button>
          </Link>
        </div>
      ) : (
        <div className='flex items-center gap-2'>
          <span className='text-muted-foreground text-sm'>
            No parent company.
          </span>
          <Link href={`/dashboard/companies/${company.id}/set-parent`}>
            <Button variant='outline' size='sm'>
              <IconPlus className='mr-2 h-4 w-4' />
              Add parent
            </Button>
          </Link>
        </div>
      )}

      {/* Child companies – list with option to create new or link existing */}
      <div className='space-y-4'>
        <div className='flex items-center justify-between flex-wrap gap-2'>
          <h2 className='text-xl font-semibold'>
            Child Companies ({company.other_Company?.length ?? 0})
          </h2>
          <Link href={`/map/companies/new?parentId=${company.id}`}>
            <Button size='sm'>
              <IconPlus className='mr-2 h-4 w-4' />
              Add child company
            </Button>
          </Link>
        </div>
        {company.other_Company && company.other_Company.length > 0 ? (
          <ul className='space-y-2'>
            {company.other_Company.map((child) => (
              <li
                key={child.id}
                className='flex items-center justify-between gap-2 flex-wrap'
              >
                <Link
                  href={`/map/companies/${child.id}`}
                  className='text-primary font-medium hover:underline'
                >
                  {child.name}
                </Link>
                <div className='flex items-center gap-2'>
                  <Link href={`/map/companies/${child.id}`}>
                    <Button variant='outline' size='sm'>
                      View Details
                    </Button>
                  </Link>
                  <RemoveAsChildButton
                    childCompanyId={child.id}
                    childCompanyName={child.name}
                    buttonText='Remove'
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className='text-muted-foreground text-sm'>
            No child companies yet.
          </p>
        )}
        <div className='pt-2 border-t'>
          <p className='text-sm font-medium mb-2'>Link existing company as child</p>
          <AddChildCompanySearch
            parentCompanyId={company.id}
            existingChildIds={(company.other_Company ?? []).map((c) => c.id)}
          />
        </div>
      </div>

      {/* Interactions */}
      <CompanyInteractions companyId={company.id} />
    </div>
  );
}
