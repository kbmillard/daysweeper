'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const LASTLEG_ADD_URL_TEMPLATE =
  process.env.NEXT_PUBLIC_LASTLEG_ADD_URL ?? 'lastleg://add?address=';

type Props = {
  address: string;
  variant?: 'default' | 'ghost' | 'outline' | 'link' | 'destructive' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  children?: React.ReactNode;
};

export function AddToLastLegButton({
  address,
  variant = 'outline',
  size = 'sm',
  children = 'Add to LastLeg'
}: Props) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    const trimmed = (address ?? '').trim();
    if (!trimmed) {
      toast.error('No address to send');
      return;
    }
    try {
      await navigator.clipboard.writeText(trimmed);
      setCopied(true);
      toast.success('Address copied for LastLeg');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy address');
    }
    // Open app URL if configured (e.g. lastleg://add?address=...) after a short delay so toast is visible
    if (LASTLEG_ADD_URL_TEMPLATE) {
      const url = `${LASTLEG_ADD_URL_TEMPLATE}${encodeURIComponent(trimmed)}`;
      setTimeout(() => {
        try {
          window.location.href = url;
        } catch {
          // Ignore if scheme not supported (e.g. on desktop without app)
        }
      }, 300);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={!address?.trim()}
    >
      {copied ? 'Copied' : children}
    </Button>
  );
}
