'use client';

import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { COMPANY_STATUSES, displayStatus } from '@/constants/company-status';
import { toast } from 'sonner';

type Props = {
  companyId: string;
  currentStatus: string | null;
  onUpdate?: (status: string | null) => void;
};

export default function CompanyStatusSelect({ companyId, currentStatus, onUpdate }: Props) {
  const [status, setStatus] = useState<string | null>(displayStatus(currentStatus));
  const [loading, setLoading] = useState(false);

  const handleChange = async (value: string) => {
    const newStatus = value === '__none__' ? null : value;
    setLoading(true);
    try {
      const res = await fetch(`/api/companies/${companyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus ?? '' })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to update status');
      }
      setStatus(newStatus);
      onUpdate?.(newStatus);
      toast.success('Status updated');
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Select
      value={status ?? '__none__'}
      onValueChange={handleChange}
      disabled={loading}
    >
      <SelectTrigger className='w-full max-w-xs'>
        <SelectValue placeholder='Select status' />
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
  );
}
