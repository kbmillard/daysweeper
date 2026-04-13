'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { COMPANY_STATUSES, displayStatus } from '@/constants/company-status';
import { toast } from 'sonner';
import { IconPlus } from '@tabler/icons-react';

export type CompanyEditableData = {
  id: string;
  name: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  status: string | null;
  /** Stored in company.metadata.productType */
  productType: string | null;
  isSeller: boolean;
};

type Props = {
  company: CompanyEditableData;
  /** If provided, saving phone will also write to this location's phone field */
  primaryLocationId?: string | null;
};

export default function CompanyEditableFields({ company, primaryLocationId }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [productTypeOptions, setProductTypeOptions] = useState<string[]>([]);
  const [typesLoaded, setTypesLoaded] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [addingType, setAddingType] = useState(false);

  const [form, setForm] = useState({
    name: company.name ?? '',
    website: company.website ?? '',
    phone: company.phone ?? '',
    email: company.email ?? '',
    status: displayStatus(company.status) ?? '',
    productType: company.productType ?? '',
    isSeller: company.isSeller ?? false
  });

  useEffect(() => {
    setForm({
      name: company.name ?? '',
      website: company.website ?? '',
      phone: company.phone ?? '',
      email: company.email ?? '',
      status: displayStatus(company.status) ?? '',
      productType: company.productType ?? '',
      isSeller: company.isSeller ?? false
    });
  }, [
    company.id,
    company.name,
    company.website,
    company.phone,
    company.email,
    company.status,
    company.productType,
    company.isSeller
  ]);

  useEffect(() => {
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
  }, []);

  const selectOptions = useMemo(() => {
    const set = new Set(productTypeOptions);
    if (form.productType.trim()) set.add(form.productType.trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [productTypeOptions, form.productType]);

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
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
        setForm((prev) => ({ ...prev, productType: name }));
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

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Company name is required');
      return;
    }
    setSaving(true);
    try {
      const phone = form.phone.trim() || null;

      const [companyRes, locationRes] = await Promise.all([
        fetch(`/api/companies/${company.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name.trim(),
            website: form.website.trim() || null,
            phone,
            email: form.email.trim() || null,
            status: form.status.trim() || null,
            productType: form.productType.trim() || null,
            isSeller: form.isSeller
          })
        }),
        primaryLocationId
          ? fetch(`/api/locations/${primaryLocationId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ phone })
            })
          : Promise.resolve(null)
      ]);

      const companyData = await companyRes.json();
      if (!companyRes.ok) {
        toast.error(companyData.error ?? 'Failed to save');
        return;
      }
      if (locationRes && !locationRes.ok) {
        const locData = await locationRes.json();
        toast.error(locData.error ?? 'Failed to save phone to location');
        return;
      }
      toast.success('Company saved');
      router.refresh();
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0'>
        <CardTitle>Company Details</CardTitle>
        <Button onClick={handleSave} disabled={saving} size='sm'>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='flex items-center gap-2 rounded-md border p-3'>
          <Checkbox
            id='isSeller'
            checked={form.isSeller}
            onCheckedChange={(c) => setForm((prev) => ({ ...prev, isSeller: Boolean(c) }))}
          />
          <Label htmlFor='isSeller' className='cursor-pointer text-sm font-normal leading-snug'>
            Mark as seller (competitor / vendor research — grey pin on map when address is geocoded)
          </Label>
        </div>

        <div className='grid gap-4 md:grid-cols-2'>
          <div>
            <Label htmlFor='name'>Company name</Label>
            <Input
              id='name'
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder='Company name'
              className='mt-1'
            />
          </div>
          <div>
            <Label htmlFor='status'>Status</Label>
            <Select
              value={form.status || '__none__'}
              onValueChange={(v) => handleChange('status', v === '__none__' ? '' : v)}
            >
              <SelectTrigger id='status' className='mt-1'>
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
            <Label htmlFor='website'>Website</Label>
            <Input
              id='website'
              type='url'
              value={form.website}
              onChange={(e) => handleChange('website', e.target.value)}
              placeholder='https://…'
              className='mt-1'
            />
          </div>
          <div>
            <Label htmlFor='phone'>Phone</Label>
            <Input
              id='phone'
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder='Phone'
              className='mt-1'
            />
          </div>
          <div>
            <Label htmlFor='email'>Email</Label>
            <Input
              id='email'
              type='email'
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder='Email'
              className='mt-1'
            />
          </div>
          <div>
            <Label htmlFor='product-type'>Product type</Label>
            <div className='mt-1 flex w-full gap-2'>
              <Select
                value={form.productType.trim() ? form.productType.trim() : '__none__'}
                onValueChange={(v) => handleChange('productType', v === '__none__' ? '' : v)}
                disabled={!typesLoaded}
              >
                <SelectTrigger id='product-type' className='min-h-9 min-w-0 w-full flex-1'>
                  <SelectValue
                    placeholder={typesLoaded ? 'Select product type' : 'Loading…'}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='__none__'>— None —</SelectItem>
                  {selectOptions.map((t) => (
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
        </div>
      </CardContent>

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
    </Card>
  );
}
