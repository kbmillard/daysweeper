/** Company status options for CRM pipeline */
export const COMPANY_STATUSES = [
  'Contacted - no answer',
  'Contacted - not interested',
  'Contacted - meeting set',
  'Account'
] as const;

export type CompanyStatus = (typeof COMPANY_STATUSES)[number];

/** Legacy DB value; display and store as "Account" */
const APR_ACCOUNT_LEGACY = 'APR Account';

/** Normalize status for display: show "Account" instead of "APR Account" */
export function displayStatus(status: string | null): string | null {
  if (!status) return null;
  return status === APR_ACCOUNT_LEGACY ? 'Account' : status;
}

/** Normalize status for storage/API: accept legacy and save as "Account" */
export function normalizeStatus(status: string | null): string | null {
  if (!status || status === '') return null;
  return status === APR_ACCOUNT_LEGACY ? 'Account' : status;
}

/** Whether the API should accept this value (includes legacy for backward compat) */
export function isValidStatus(value: string): boolean {
  if (!value) return false;
  return (
    (COMPANY_STATUSES as readonly string[]).includes(value) || value === APR_ACCOUNT_LEGACY
  );
}
