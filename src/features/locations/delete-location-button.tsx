'use client';

import { AlertModal } from '@/components/modal/alert-modal';
import { Button } from '@/components/ui/button';
import { IconTrash } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

type Props = {
  locationId: string;
  companyId: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  basePath?: 'dashboard' | 'map';
  /** If true, refresh only (don't redirect). Use when deleting from a list on the same page. */
  refreshOnly?: boolean;
  /** Button label. Default "Delete". Use "Remove as location" for company location list. */
  buttonText?: string;
};

export function DeleteLocationButton({
  locationId,
  companyId,
  variant = 'destructive',
  size = 'sm',
  basePath = 'dashboard',
  refreshOnly = false,
  buttonText = 'Delete'
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const prefix = basePath === 'map' ? '/map' : '/dashboard';

  const onConfirm = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/locations/${locationId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? 'Failed to delete location');
        return;
      }
      toast.success('Location deleted');
      if (refreshOnly) {
        router.refresh();
      } else {
        router.push(`${prefix}/companies/${companyId}`);
        router.refresh();
      }
    } catch {
      toast.error('Failed to delete location');
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  return (
    <>
      <AlertModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={onConfirm}
        loading={loading}
      />
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <IconTrash className='mr-1.5 h-4 w-4' />
        {size === 'icon' ? null : buttonText}
      </Button>
    </>
  );
}
