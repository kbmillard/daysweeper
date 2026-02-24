'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { IconBrandApple } from '@tabler/icons-react';
import { toast } from 'sonner';
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
  const { getToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyingToken, setCopyingToken] = useState(false);

  const handleCopyRouteToken = async () => {
    setCopyingToken(true);
    try {
      const token = await getToken();
      if (!token) {
        toast.error('Not signed in');
        return;
      }
      await navigator.clipboard.writeText(token);
      toast.success('Route token copied. Paste it in LastLeg app settings if targets don’t load.');
    } catch {
      toast.error('Could not copy token');
    } finally {
      setCopyingToken(false);
    }
  };

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
        credentials: 'include',
        body: JSON.stringify({ locationId, companyId })
      });
      let data: { error?: string } = {};
      try {
        data = await res.json();
      } catch {
        data = { error: res.status === 401 ? 'Please sign in to add stops to your LastLeg route.' : `Server error (${res.status})` };
      }

      if (!res.ok) {
        const msg = data.error ?? `Server error (${res.status})`;
        setError(msg);
        toast.error(msg);
        return;
      }

      setOpen(false);
      toast.success('Added to LastLeg. Open the app and pull to refresh to see it.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setError(msg);
      toast.error(msg);
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
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Add this company and address to your route in the LastLeg app. Then open LastLeg and pull to refresh to load your route.</p>
                <p className="text-muted-foreground text-xs">
                  If targets don’t load in the app, copy your route token and paste it in LastLeg’s settings (Authorization: Bearer).
                </p>
                <Button type="button" variant="secondary" size="sm" onClick={handleCopyRouteToken} disabled={copyingToken}>
                  {copyingToken ? 'Copying…' : 'Copy route token'}
                </Button>
              </div>
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
