'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { COMPANY_STATUSES } from '@/constants/company-status';
import { toast } from 'sonner';

export type CompanyEditableData = {
  id: string;
  name: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  status: string | null;
  companyKey: string | null;
};

type Props = {
  company: CompanyEditableData;
};

export default function CompanyEditableFields({ company }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: company.name ?? '',
    website: company.website ?? '',
    phone: company.phone ?? '',
    email: company.email ?? '',
    status: company.status ?? '',
    companyKey: company.companyKey ?? ''
  });

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Company name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          website: form.website.trim() || null,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          status: form.status.trim() || null,
          companyKey: form.companyKey.trim() || null
        })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to save');
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
            <Label htmlFor='companyKey'>Company key</Label>
            <Input
              id='companyKey'
              value={form.companyKey}
              onChange={(e) => handleChange('companyKey', e.target.value)}
              placeholder='Company key'
              className='mt-1'
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
