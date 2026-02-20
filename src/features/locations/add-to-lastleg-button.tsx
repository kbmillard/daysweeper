'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { IconBrandApple } from '@tabler/icons-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';

type Props = {
  locationId: string;
  addressRaw: string;
  companyId: string;
  baseUrl?: string;
  latitude?: number | null;
  longitude?: number | null;
};

export function AddToLastLegButton({
  locationId,
  companyId
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setError(null);
  };

  const handleYes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/lastleg/add-to-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, companyId })
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error ?? `Server error (${res.status})`);
        return;
      }

      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Add to LastLeg"
      >
        <IconBrandApple className="mr-2 h-4 w-4" />
        Add to LastLeg
      </Button>
      <AlertDialog open={open} onOpenChange={handleOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send to LastLeg?</AlertDialogTitle>
            <AlertDialogDescription>
              Add this company and address to your route in the LastLeg app.
            </AlertDialogDescription>
            {error && (
              <p className="text-destructive font-medium text-sm">{error}</p>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>No</AlertDialogCancel>
            <AlertDialogAction onClick={handleYes} disabled={loading}>
              {loading ? 'Adding…' : 'Yes'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
