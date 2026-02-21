'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type Props = {
  companyId: string;
  locationId: string;
  basePath: 'dashboard' | 'map';
  variant?: 'default' | 'ghost' | 'outline' | 'link' | 'destructive' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  children?: React.ReactNode;
};

export function SetAsHeadquartersButton({
  companyId,
  locationId,
  basePath,
  variant = 'ghost',
  size = 'sm',
  children = 'Set as headquarters'
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/companies/${companyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryLocationId: locationId })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to set headquarters');
        return;
      }
      toast.success('Headquarters set');
      router.refresh();
    } catch {
      toast.error('Failed to set headquarters');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant={variant} size={size} onClick={handleClick} disabled={loading}>
      {loading ? 'Setting…' : children}
    </Button>
  );
}
