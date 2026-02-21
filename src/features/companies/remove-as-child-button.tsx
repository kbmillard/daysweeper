'use client';

import { AlertModal } from '@/components/modal/alert-modal';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

type Props = {
  childCompanyId: string;
  childCompanyName: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg';
};

export function RemoveAsChildButton({
  childCompanyId,
  childCompanyName,
  variant = 'outline',
  size = 'sm'
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onConfirm = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/companies/${childCompanyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentCompanyId: null })
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? 'Failed to remove as child');
        return;
      }
      toast.success(`"${childCompanyName}" is no longer a child company`);
      router.refresh();
    } catch {
      toast.error('Failed to remove as child');
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
        title="Remove as child?"
        description={`This will unlink "${childCompanyName}" from this parent. The company will remain in the system but no longer appear as a child.`}
      />
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        Remove as child
      </Button>
    </>
  );
}
