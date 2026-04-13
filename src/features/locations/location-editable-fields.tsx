'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  IconMapPin,
  IconBuilding,
  IconPlus
} from '@tabler/icons-react';
import { parseDmsCoordinates } from '@/lib/geocode-address';
import { notifyLocationsMapUpdate } from '@/lib/locations-map-update';
import { toast } from 'sonner';
import { COMPANY_STATUSES, displayStatus } from '@/constants/company-status';
import { parseLocationMetadata } from '@/lib/location-primary-sync-metadata';
import { productTypeFromMetadata } from '@/lib/product-type-from-metadata';

type AddressComponents = {
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
} | null;

type LocationEditableData = {
  id: string;
  externalId: string | null;
  companyId: string;
  addressRaw: string;
  addressNormalized: string | null;
  addressComponents: AddressComponents;
  latitude: number | null;
  longitude: number | null;
  locationName?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  metadata?: unknown;
};

type CompanyEditableData = {
  id: string;
  name: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  /** Pipeline status (company row); used when this location is HQ */
  status?: string | null;
  /** From company.metadata.productType when isPrimaryLocation */
  productType?: string | null;
  primaryLocationId?: string | null;
};

type Props = {
  location: LocationEditableData;
  company: CompanyEditableData;
  /** When true, only show Location Details card (hide Company card). Use for primary address on company page. */
  locationOnly?: boolean;
  /** When true, show "Contact at this location" card (phone/email/website) that saves to Location, not Company. Use on location detail page. */
  editableLocationContact?: boolean;
  /** This row is the company headquarters — status/product type follow the company record */
  isPrimaryLocation?: boolean;
};

function strAddr(v: unknown): string {
  return typeof v === 'string' && v.trim() ? v.trim() : '';
}

function statusFromLocationMetadata(metadata: unknown): string | null {
  const m = parseLocationMetadata(metadata);
  const s = m.status;
  return typeof s === 'string' && s.trim() ? s.trim() : null;
}

export default function LocationEditableFields({
  location,
  company,
  locationOnly = false,
  editableLocationContact = false,
  isPrimaryLocation = false
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const companiesBase = pathname.startsWith('/map') ? '/map' : '/dashboard';
  const [savingLocation, setSavingLocation] = useState(false);
  const [savingLocationContact, setSavingLocationContact] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [productTypeOptions, setProductTypeOptions] = useState<string[]>([]);
  const [typesLoaded, setTypesLoaded] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [addingType, setAddingType] = useState(false);

  const [locForm, setLocForm] = useState({
    addressRaw: location.addressRaw ?? '',
    addressNormalized: location.addressNormalized ?? '',
    city: (location.addressComponents as AddressComponents)?.city ?? '',
    state: (location.addressComponents as AddressComponents)?.state ?? '',
    postal_code: (location.addressComponents as AddressComponents)?.postal_code ?? '',
    country: (location.addressComponents as AddressComponents)?.country ?? '',
    latitude: location.latitude != null ? String(location.latitude) : '',
    longitude: location.longitude != null ? String(location.longitude) : ''
  });

  useEffect(() => {
    setLocForm({
      addressRaw: location.addressRaw ?? '',
      addressNormalized: location.addressNormalized ?? '',
      city: (location.addressComponents as AddressComponents)?.city ?? '',
      state: (location.addressComponents as AddressComponents)?.state ?? '',
      postal_code: (location.addressComponents as AddressComponents)?.postal_code ?? '',
      country: (location.addressComponents as AddressComponents)?.country ?? '',
      latitude: location.latitude != null ? String(location.latitude) : '',
      longitude: location.longitude != null ? String(location.longitude) : ''
    });
  }, [
    location.id,
    location.addressRaw,
    location.addressNormalized,
    location.addressComponents,
    location.latitude,
    location.longitude
  ]);

  const [compForm, setCompForm] = useState({
    name: company.name ?? '',
    website: company.website ?? '',
    phone: company.phone ?? '',
    email: company.email ?? ''
  });

  const buildLocContactForm = useCallback(
    () => ({
      locationName: location.locationName ?? '',
      phone: location.phone ?? '',
      email: location.email ?? '',
      website: location.website ?? '',
      status:
        displayStatus(
          isPrimaryLocation ? (company.status ?? null) : statusFromLocationMetadata(location.metadata)
        ) ?? '',
      productType: isPrimaryLocation
        ? (company.productType ?? '').trim()
        : productTypeFromMetadata(location.metadata)
    }),
    [
      location.locationName,
      location.phone,
      location.email,
      location.website,
      location.metadata,
      isPrimaryLocation,
      company.status,
      company.productType
    ]
  );

  const [locContactForm, setLocContactForm] = useState(buildLocContactForm);

  useEffect(() => {
    if (editableLocationContact) {
      setLocContactForm(buildLocContactForm());
    }
  }, [editableLocationContact, location.id, buildLocContactForm]);

  useEffect(() => {
    if (!editableLocationContact) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/product-types');
        const data = await res.json();
        if (!res.ok) {
          if (!cancelled) toast.error(data.error ?? 'Could not load product types');
          return;
        }
        if (!cancelled && Array.isArray(data.types)) {
          setProductTypeOptions(data.types);
        }
      } catch {
        if (!cancelled) toast.error('Could not load product types');
      } finally {
        if (!cancelled) setTypesLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editableLocationContact]);

  const selectProductTypeOptions = useMemo(() => {
    const set = new Set(productTypeOptions);
    if (locContactForm.productType.trim()) set.add(locContactForm.productType.trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [productTypeOptions, locContactForm.productType]);

  const handleLocChange = (field: keyof typeof locForm, value: string) => {
    setLocForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCompChange = (field: keyof typeof compForm, value: string) => {
    setCompForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleLocContactChange = (field: keyof typeof locContactForm, value: string) => {
    setLocContactForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddProductType = async () => {
    const name = newTypeName.trim();
    if (!name) {
      toast.error('Enter a product type name');
      return;
    }
    setAddingType(true);
    try {
      const res = await fetch('/api/product-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to add product type');
        return;
      }
      if (Array.isArray(data.types)) {
        setProductTypeOptions(data.types);
        setLocContactForm((prev) => ({ ...prev, productType: name }));
      }
      setNewTypeName('');
      setAddOpen(false);
      toast.success('Product type added');
    } catch {
      toast.error('Failed to add product type');
    } finally {
      setAddingType(false);
    }
  };

  const handleAutofillAddress = async () => {
    const addr = locForm.addressRaw.trim();
    if (!addr) {
      toast.error('Enter an address first');
      return;
    }
    setAutofilling(true);
    try {
      const res = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Could not geocode address');
        return;
      }
      const ac = (data.addressComponents ?? {}) as Record<string, unknown>;
      // Replace components from geocoder only — do not keep stale city/ZIP/coords when the API omits a field.
      setLocForm((prev) => ({
        ...prev,
        city: strAddr(ac.city),
        state: strAddr(ac.state),
        postal_code: strAddr(ac.postal_code),
        country: strAddr(ac.country),
        addressNormalized:
          data.addressNormalized != null && String(data.addressNormalized).trim()
            ? String(data.addressNormalized).trim()
            : prev.addressNormalized,
        latitude: data.latitude != null ? String(data.latitude) : '',
        longitude: data.longitude != null ? String(data.longitude) : ''
      }));
      toast.success('City, state, ZIP, country filled from address');
    } catch {
      toast.error('Could not autofill address');
    } finally {
      setAutofilling(false);
    }
  };

  const handleSaveLocationContact = async () => {
    setSavingLocationContact(true);
    try {
      const locationBody: Record<string, unknown> = {
        locationName: locContactForm.locationName.trim() || null,
        phone: locContactForm.phone.trim() || null,
        email: locContactForm.email.trim() || null,
        website: locContactForm.website.trim() || null,
        ...(editableLocationContact && { userTookOwnershipOfPrimaryFields: true })
      };
      if (!isPrimaryLocation) {
        locationBody.status = locContactForm.status.trim() || null;
        locationBody.productType = locContactForm.productType.trim() || null;
      }

      const res = await fetch(`/api/locations/${location.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(locationBody)
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to save contact');
        return;
      }

      if (isPrimaryLocation && editableLocationContact) {
        const cr = await fetch(`/api/companies/${company.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: locContactForm.status.trim() || null,
            productType: locContactForm.productType.trim() || null
          })
        });
        const cd = await cr.json();
        if (!cr.ok) {
          toast.error(cd.error ?? 'Saved location contact but failed to update company status/type');
          router.refresh();
          return;
        }
      }

      if (data.warning) {
        toast.warning(data.warning);
      } else {
        toast.success('Location contact saved');
      }
      router.refresh();
    } catch {
      toast.error('Failed to save contact');
    } finally {
      setSavingLocationContact(false);
    }
  };

  const handleSaveLocation = async () => {
    if (!locForm.addressRaw.trim()) {
      toast.error('Address is required');
      return;
    }
    setSavingLocation(true);
    try {
      const lat = locForm.latitude.trim() !== '' ? Number(locForm.latitude) : undefined;
      const lng = locForm.longitude.trim() !== '' ? Number(locForm.longitude) : undefined;
      if (lat !== undefined && (Number.isNaN(lat) || lat < -90 || lat > 90)) {
        toast.error('Latitude must be -90 to 90');
        return;
      }
      if (lng !== undefined && (Number.isNaN(lng) || lng < -180 || lng > 180)) {
        toast.error('Longitude must be -180 to 180');
        return;
      }

      const addressComponents: AddressComponents =
        locForm.city || locForm.state || locForm.postal_code || locForm.country
          ? {
              ...(locForm.city && { city: locForm.city }),
              ...(locForm.state && { state: locForm.state }),
              ...(locForm.postal_code && { postal_code: locForm.postal_code }),
              ...(locForm.country && { country: locForm.country })
            }
          : null;

      const res = await fetch(`/api/locations/${location.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addressRaw: locForm.addressRaw.trim(),
          addressNormalized: locForm.addressNormalized.trim() || null,
          addressComponents,
          ...(lat !== undefined && { latitude: lat }),
          ...(lng !== undefined && { longitude: lng }),
          ...(editableLocationContact && { userTookOwnershipOfPrimaryFields: true })
        })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to save location');
        return;
      }
      if (lat !== undefined || lng !== undefined) notifyLocationsMapUpdate();
      toast.success('Location saved');
      router.refresh();
    } catch {
      toast.error('Failed to save location');
    } finally {
      setSavingLocation(false);
    }
  };

  const handleSaveCompany = async () => {
    if (!compForm.name.trim()) {
      toast.error('Company name is required');
      return;
    }
    setSavingCompany(true);
    try {
      const res = await fetch(`/api/companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: compForm.name.trim(),
          website: compForm.website.trim() || null,
          phone: compForm.phone.trim() || null,
          email: compForm.email.trim() || null
        })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to save company');
        return;
      }
      toast.success('Company saved');
      router.refresh();
    } catch {
      toast.error('Failed to save company');
    } finally {
      setSavingCompany(false);
    }
  };

  return (
    <div className={locationOnly ? '' : 'grid gap-6 grid-cols-1 lg:grid-cols-2'}>
      {/* Location Details */}
      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0'>
          <div>
            <CardTitle className='flex items-center gap-2'>
              <IconMapPin className='h-5 w-5' />
              Location Details
            </CardTitle>
            <CardDescription>Address and location information</CardDescription>
          </div>
          <Button onClick={handleSaveLocation} disabled={savingLocation} size='sm'>
            {savingLocation ? 'Saving…' : 'Save'}
          </Button>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='text-sm'>
            <span className='text-muted-foreground'>Company: </span>
            <Link
              href={`${companiesBase}/companies/${company.id}`}
              className='font-medium text-primary hover:underline'
            >
              {company.name}
            </Link>
          </div>
          <div>
            <div className='flex items-center justify-between gap-2'>
              <Label htmlFor='addressRaw'>Address</Label>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={handleAutofillAddress}
                disabled={autofilling || !locForm.addressRaw.trim()}
              >
                {autofilling ? 'Filling…' : 'Autofill city, state, ZIP'}
              </Button>
            </div>
            <Input
              id='addressRaw'
              value={locForm.addressRaw}
              onChange={(e) => handleLocChange('addressRaw', e.target.value)}
              placeholder='Full address'
              className='mt-1'
            />
          </div>
          {!locationOnly && (
            <div>
              <Label htmlFor='addressNormalized'>Normalized Address</Label>
              <Input
                id='addressNormalized'
                value={locForm.addressNormalized}
                onChange={(e) => handleLocChange('addressNormalized', e.target.value)}
                placeholder='Normalized address'
                className='mt-1'
              />
            </div>
          )}
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <Label htmlFor='city'>City</Label>
              <Input
                id='city'
                value={locForm.city}
                onChange={(e) => handleLocChange('city', e.target.value)}
                placeholder='City'
                className='mt-1'
              />
            </div>
            <div>
              <Label htmlFor='state'>State</Label>
              <Input
                id='state'
                value={locForm.state}
                onChange={(e) => handleLocChange('state', e.target.value)}
                placeholder='State'
                className='mt-1'
              />
            </div>
            <div>
              <Label htmlFor='postal_code'>ZIP</Label>
              <Input
                id='postal_code'
                value={locForm.postal_code}
                onChange={(e) => handleLocChange('postal_code', e.target.value)}
                placeholder='ZIP'
                className='mt-1'
              />
            </div>
            <div>
              <Label htmlFor='country'>Country</Label>
              <Input
                id='country'
                value={locForm.country}
                onChange={(e) => handleLocChange('country', e.target.value)}
                placeholder='Country'
                className='mt-1'
              />
            </div>
          </div>
          <div>
            <Label htmlFor='coordinatesPaste'>Paste coordinates (Google Earth format)</Label>
            <Input
              id='coordinatesPaste'
              placeholder='e.g. 42°04′17.96″N 88°17′47.01″W'
              className='mt-1 font-mono'
              onPaste={(e) => {
                const pasted = e.clipboardData.getData('text');
                const parsed = parseDmsCoordinates(pasted);
                if (parsed) {
                  e.preventDefault();
                  setLocForm((prev) => ({
                    ...prev,
                    latitude: parsed.lat.toFixed(6),
                    longitude: parsed.lng.toFixed(6)
                  }));
                  toast.success('Coordinates pasted');
                }
              }}
            />
          </div>
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <Label htmlFor='latitude'>Latitude</Label>
              <Input
                id='latitude'
                value={locForm.latitude}
                onChange={(e) => handleLocChange('latitude', e.target.value)}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text');
                  const parsed = parseDmsCoordinates(pasted);
                  if (parsed) {
                    e.preventDefault();
                    setLocForm((prev) => ({
                      ...prev,
                      latitude: parsed.lat.toFixed(6),
                      longitude: parsed.lng.toFixed(6)
                    }));
                    toast.success('Coordinates pasted from Google Earth');
                  }
                }}
                placeholder='e.g. 42.333239 or paste DMS'
                className='mt-1 font-mono'
              />
            </div>
            <div>
              <Label htmlFor='longitude'>Longitude</Label>
              <Input
                id='longitude'
                value={locForm.longitude}
                onChange={(e) => handleLocChange('longitude', e.target.value)}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text');
                  const parsed = parseDmsCoordinates(pasted);
                  if (parsed) {
                    e.preventDefault();
                    setLocForm((prev) => ({
                      ...prev,
                      latitude: parsed.lat.toFixed(6),
                      longitude: parsed.lng.toFixed(6)
                    }));
                    toast.success('Coordinates pasted from Google Earth');
                  }
                }}
                placeholder='e.g. -83.155683'
                className='mt-1 font-mono'
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {!locationOnly && editableLocationContact && (
      <>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0'>
          <div>
            <CardTitle className='flex items-center gap-2'>
              <IconBuilding className='h-5 w-5' />
              Contact at this location
            </CardTitle>
            <CardDescription>
              {isPrimaryLocation
                ? 'HQ contact fields; status and product type are saved on the company record (same as Company details).'
                : 'Contact, site-only status, and product type for this location — does not change the company record.'}
            </CardDescription>
          </div>
          <Button onClick={handleSaveLocationContact} disabled={savingLocationContact} size='sm'>
            {savingLocationContact ? 'Saving…' : 'Save'}
          </Button>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div>
            <Label htmlFor='locName'>Location name</Label>
            <Input
              id='locName'
              value={locContactForm.locationName}
              onChange={(e) => handleLocContactChange('locationName', e.target.value)}
              placeholder='Location name'
              className='mt-1'
            />
          </div>
          <div>
            <Label htmlFor='locPhone'>Phone</Label>
            <Input
              id='locPhone'
              value={locContactForm.phone}
              onChange={(e) => handleLocContactChange('phone', e.target.value)}
              placeholder='Location phone'
              className='mt-1'
            />
          </div>
          <div>
            <Label htmlFor='locEmail'>Email</Label>
            <Input
              id='locEmail'
              type='email'
              value={locContactForm.email}
              onChange={(e) => handleLocContactChange('email', e.target.value)}
              placeholder='Location email'
              className='mt-1'
            />
          </div>
          <div>
            <Label htmlFor='locWebsite'>Website</Label>
            <Input
              id='locWebsite'
              value={locContactForm.website}
              onChange={(e) => handleLocContactChange('website', e.target.value)}
              placeholder='https://...'
              className='mt-1'
            />
          </div>
          <div>
            <Label htmlFor='locStatus'>Status</Label>
            <Select
              value={locContactForm.status || '__none__'}
              onValueChange={(v) => handleLocContactChange('status', v === '__none__' ? '' : v)}
            >
              <SelectTrigger id='locStatus' className='mt-1'>
                <SelectValue placeholder='Status' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='__none__'>— No status —</SelectItem>
                {COMPANY_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor='loc-product-type'>Product type</Label>
            <div className='mt-1 flex w-full gap-2'>
              <Select
                value={locContactForm.productType.trim() ? locContactForm.productType.trim() : '__none__'}
                onValueChange={(v) => handleLocContactChange('productType', v === '__none__' ? '' : v)}
                disabled={!typesLoaded}
              >
                <SelectTrigger id='loc-product-type' className='min-h-9 min-w-0 w-full flex-1'>
                  <SelectValue placeholder={typesLoaded ? 'Select product type' : 'Loading…'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='__none__'>— None —</SelectItem>
                  {selectProductTypeOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type='button'
                variant='outline'
                size='icon'
                className='shrink-0'
                onClick={() => setAddOpen(true)}
                aria-label='Add product type'
              >
                <IconPlus className='h-4 w-4' />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add product type</DialogTitle>
          </DialogHeader>
          <Input
            value={newTypeName}
            onChange={(e) => setNewTypeName(e.target.value)}
            placeholder='e.g. engine components'
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleAddProductType();
              }
            }}
          />
          <DialogFooter>
            <Button type='button' variant='outline' onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type='button' onClick={() => void handleAddProductType()} disabled={addingType}>
              {addingType ? 'Adding…' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>
      )}
      {!locationOnly && !editableLocationContact && (
      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0'>
          <div>
            <CardTitle className='flex items-center gap-2'>
              <IconBuilding className='h-5 w-5' />
              Company
            </CardTitle>
            <CardDescription>Parent company information</CardDescription>
          </div>
          <Button onClick={handleSaveCompany} disabled={savingCompany} size='sm'>
            {savingCompany ? 'Saving…' : 'Save'}
          </Button>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div>
            <Label htmlFor='companyName'>Company name</Label>
            <Input
              id='companyName'
              value={compForm.name}
              onChange={(e) => handleCompChange('name', e.target.value)}
              placeholder='Company name'
              className='mt-1'
            />
          </div>
          <div>
            <Label htmlFor='website'>Website</Label>
            <Input
              id='website'
              value={compForm.website}
              onChange={(e) => handleCompChange('website', e.target.value)}
              placeholder='https://...'
              className='mt-1'
            />
          </div>
          <div>
            <Label htmlFor='email'>Email</Label>
            <Input
              id='email'
              type='email'
              value={compForm.email}
              onChange={(e) => handleCompChange('email', e.target.value)}
              placeholder='Email'
              className='mt-1'
            />
          </div>
          <div>
            <Label htmlFor='phone'>Phone</Label>
            <Input
              id='phone'
              value={compForm.phone}
              onChange={(e) => handleCompChange('phone', e.target.value)}
              placeholder='Phone'
              className='mt-1'
            />
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  );
}
