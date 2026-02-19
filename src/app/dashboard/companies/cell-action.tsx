'use client';
import { AlertModal } from '@/components/modal/alert-modal';
import { Button } from '@/components/ui/button';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

interface CellActionProps {
  companyId: string;
  companyName: string;
}

export function CellAction({ companyId, companyName }: CellActionProps) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
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
      router.refresh();
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
      <div className='flex items-center gap-2'>
        <Button variant='outline' size='sm' onClick={() => router.push(`/dashboard/companies/${companyId}`)}>
          <IconEdit className='mr-2 h-4 w-4' /> Edit
        </Button>
        <Button variant='destructive' size='sm' onClick={() => setOpen(true)} disabled={loading}>
          <IconTrash className='mr-2 h-4 w-4' /> Delete
        </Button>
      </div>
    </>
  );
}
