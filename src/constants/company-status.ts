/** Company status options for CRM pipeline */
export const COMPANY_STATUSES = [
  'Contacted - no answer',
  'Contacted - answered - not interested',
  'Contacted - answered - meeting set',
  'APR Account'
] as const;

export type CompanyStatus = (typeof COMPANY_STATUSES)[number];
