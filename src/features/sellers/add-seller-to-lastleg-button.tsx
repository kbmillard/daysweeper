'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { IconBrandApple } from '@tabler/icons-react';
import { toast } from 'sonner';

type Props = {
  sellerId: string;
  sellerName: string;
  disabled?: boolean;
};

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || navigator.maxTouchPoints > 0;
}

function openLastLegApp(): void {
  try {
    setTimeout(() => {
      window.location.href = 'lastleg://';
    }, 300);
  } catch {
    /* ignore */
  }
}

export function AddSellerToLastLegButton({ sellerId, sellerName, disabled }: Props) {
  const [loading, setLoading] = useState(false);

  const onClick = async () => {
    if (loading || disabled) return;
    setLoading(true);
    try {
      const res = await fetch('/api/lastleg/add-to-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sellerId })
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      if (isMobileDevice()) {
        toast.success('Added — opening LastLeg…');
        openLastLegApp();
      } else {
        toast.success('Added to LastLeg. Pull to refresh in the app.');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button type='button' variant='default' size='sm' disabled={disabled || loading} onClick={() => void onClick()}>
      <IconBrandApple className='mr-2 h-4 w-4' />
      {loading ? 'Adding…' : `Add “${sellerName.slice(0, 24)}${sellerName.length > 24 ? '…' : ''}” to LastLeg`}
    </Button>
  );
}
