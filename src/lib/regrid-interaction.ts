import type { MouseEvent } from 'react';
import { pinLatLngClipboardText } from '@/lib/regrid-copy';
import { regridUrl } from '@/lib/regrid-url';

type RegridClickOpts = {
  onCopied?: () => void;
  onCopyFailed?: () => void;
};

/**
 * Plain left-click: open Regrid in a new tab and copy pin lat/lng.
 * Opens synchronously in the click handler so popup blockers do not block the tab.
 * Cmd/Ctrl/Shift/Alt-click and non–left-button clicks keep the anchor’s default behavior.
 */
export function handleRegridAnchorClick(
  e: MouseEvent<HTMLAnchorElement>,
  lat: number,
  lng: number,
  opts?: RegridClickOpts,
): void {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  if (e.button !== 0) return;

  e.preventDefault();
  const url = regridUrl(lat, lng);
  window.open(url, '_blank', 'noopener,noreferrer');

  void navigator.clipboard
    .writeText(pinLatLngClipboardText(lat, lng))
    .then(() => {
      opts?.onCopied?.();
    })
    .catch(() => {
      opts?.onCopyFailed?.();
    });
}
