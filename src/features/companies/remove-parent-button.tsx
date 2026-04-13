'use client';

import { AlertModal } from '@/components/modal/alert-modal';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

export function RemoveParentButton({
  companyId,
  buttonText = 'Remove'
}: {
  companyId: string;
  buttonText?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const onConfirm = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/companies/${companyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentCompanyId: null })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to remove parent');
        return;
      }
      toast.success('Parent company removed');
      router.refresh();
    } catch {
      toast.error('Failed to remove parent');
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
        description='The parent company link will be removed from the database. This company will not be deleted.'
        confirmLabel='Remove'
      />
      <Button
        type='button'
        variant='outline'
        size='sm'
        disabled={loading}
        onClick={() => setOpen(true)}
      >
        {loading ? '…' : buttonText}
      </Button>
    </>
  );
}
