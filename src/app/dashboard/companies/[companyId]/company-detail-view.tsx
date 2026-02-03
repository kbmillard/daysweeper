import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IconArrowLeft, IconPlus } from '@tabler/icons-react';
import Link from 'next/link';
import CompanyInteractions from './company-interactions';
import CompanyStatusSelect from './company-status-select';

type CompanyData = {
  id: string;
  name: string;
  website: string | null;
  phone: string | null;
  category: string | null;
  subtype: string | null;
  status: string | null;
  metadata: any;
  Location: Array<{
    id: string;
    addressRaw: string;
    addressComponents: any;
  }>;
  Company?: CompanyData | null; // Parent company
  other_Company?: CompanyData[]; // Child companies
};

type Props = {
  company: CompanyData;
};

// Component to render a company card (reusable for parent/child)
function CompanyCard({ company, title }: { company: CompanyData; title: string }) {
  const primaryLocation = company.Location?.[0];
  const addressComponents = primaryLocation?.addressComponents || {};
  
  // Get phone from metadata.contactInfo if phone field is empty
  const phone = company.phone || company.metadata?.contactInfo?.phone || null;
  
  // Get supply chain fields from metadata if not in direct fields
  const supplyChainCategory = company.category || company.metadata?.supplyChainCategory || null;

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
        </div>
      </CardContent>
    </Card>
  );
}

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
              <label className='text-sm font-medium text-muted-foreground'>Status</label>
              <div className='mt-1'>
                <CompanyStatusSelect companyId={company.id} currentStatus={company.status} />
              </div>
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

      {/* Parent Company – only show when there is a parent (no empty parent) */}
      {company.Company ? (
        <div className='space-y-2'>
          <h2 className='text-xl font-semibold'>Parent Company</h2>
          <CompanyCard company={company.Company} title='Parent Company' />
          <Link href={`/dashboard/companies/${company.id}/set-parent`}>
            <Button variant='ghost' size='sm'>Change or clear parent</Button>
          </Link>
        </div>
      ) : (
        <div className='flex items-center gap-2'>
          <span className='text-muted-foreground text-sm'>No parent company.</span>
          <Link href={`/dashboard/companies/${company.id}/set-parent`}>
            <Button variant='outline' size='sm'>
              <IconPlus className='mr-2 h-4 w-4' />
              Add parent
            </Button>
          </Link>
        </div>
      )}

      {/* Locations – add other locations for this company */}
      <div className='space-y-4'>
        <div className='flex items-center justify-between'>
          <h2 className='text-xl font-semibold'>
            Locations ({company.Location?.length ?? 0})
          </h2>
          <Link href={`/dashboard/companies/${company.id}/locations/new`}>
            <Button size='sm'>
              <IconPlus className='mr-2 h-4 w-4' />
              Add location
            </Button>
          </Link>
        </div>
        {company.Location && company.Location.length > 0 ? (
          <ul className='space-y-2'>
            {company.Location.map((loc) => (
              <li key={loc.id}>
                <Link
                  href={`/dashboard/companies/${company.id}/locations/${loc.id}`}
                  className='text-primary hover:underline'
                >
                  {loc.addressRaw || 'Address not specified'}
                </Link>
                <Link href={`/dashboard/companies/${company.id}/locations/${loc.id}`}>
                  <Button variant='ghost' size='sm' className='ml-2'>
                    View
                  </Button>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className='text-muted-foreground text-sm'>No locations yet. Add one to get started.</p>
        )}
      </div>

      {/* Child companies – only show when this company has children; list each with link to its page */}
      {company.other_Company && company.other_Company.length > 0 ? (
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <h2 className='text-xl font-semibold'>Child Companies ({company.other_Company.length})</h2>
            <Link href={`/dashboard/companies/new?parentId=${company.id}`}>
              <Button size='sm'>
                <IconPlus className='mr-2 h-4 w-4' />
                Add child company
              </Button>
            </Link>
          </div>
          <ul className='space-y-2'>
            {company.other_Company.map((child) => (
              <li key={child.id} className='flex items-center justify-between gap-2'>
                <Link
                  href={`/dashboard/companies/${child.id}`}
                  className='text-primary font-medium hover:underline'
                >
                  {child.name}
                </Link>
                <Link href={`/dashboard/companies/${child.id}`}>
                  <Button variant='outline' size='sm'>View Details</Button>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className='flex items-center gap-2'>
          <Link href={`/dashboard/companies/new?parentId=${company.id}`}>
            <Button variant='outline' size='sm'>
              <IconPlus className='mr-2 h-4 w-4' />
              Add child company
            </Button>
          </Link>
        </div>
      )}

      {/* Interactions */}
      <CompanyInteractions companyId={company.id} />
    </div>
  );
}
