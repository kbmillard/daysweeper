'use client';

import { AlertModal } from '@/components/modal/alert-modal';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

type Props = {
  companyId: string;
  variant?: 'default' | 'ghost' | 'outline' | 'link' | 'destructive' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  children?: React.ReactNode;
};

export function RemoveAsHeadquartersButton({
  companyId,
  variant = 'outline',
  size = 'sm',
  children = 'Remove as HQ (primary location)'
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const onConfirm = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/companies/${companyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryLocationId: null })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to clear headquarters');
        return;
      }
      toast.success('Primary location cleared');
      router.refresh();
    } catch {
      toast.error('Failed to clear headquarters');
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
        description='The primary location flag will be cleared in the database. No location row is deleted.'
        confirmLabel='Remove'
      />
      <Button variant={variant} size={size} onClick={() => setOpen(true)} disabled={loading}>
        {loading ? 'Updating…' : children}
      </Button>
    </>
  );
}
