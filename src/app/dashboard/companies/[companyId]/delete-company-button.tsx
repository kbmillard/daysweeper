'use client';
import { AlertModal } from '@/components/modal/alert-modal';
import { Button } from '@/components/ui/button';
import { IconTrash } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

export function DeleteCompanyButton({ companyId, companyName }: { companyId: string; companyName: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onConfirm = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/companies/${companyId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? 'Failed to delete company');
        return;
      }
      toast.success(`${companyName} deleted`);
      router.push('/dashboard/companies');
    } catch {
      toast.error('Failed to delete company');
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
      <Button variant='destructive' size='sm' onClick={() => setOpen(true)}>
        <IconTrash className='mr-2 h-4 w-4' />
        Delete company
      </Button>
    </>
  );
}
