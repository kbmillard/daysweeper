/**
 * Neon returns this when the project's data transfer quota is exceeded.
 * Build-time DB scripts should not fail the whole Vercel deploy in that case.
 */
export function isNeonDataTransferQuotaExceeded(err) {
  const msg = String(err?.message ?? err ?? '');
  return /exceeded the data transfer quota|data transfer quota/i.test(msg);
}
