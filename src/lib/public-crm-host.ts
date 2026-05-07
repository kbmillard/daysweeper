/** Hostname served without Clerk login (public read-only CRM). */
export const PUBLIC_CRM_HOSTNAME = 'crm.recyclicbravery.com';

export function isPublicCrmHostname(host: string | null | undefined): boolean {
  if (!host) return false;
  const first = host.split(',')[0].trim();
  const hostname = first.split(':')[0].toLowerCase();
  return hostname === PUBLIC_CRM_HOSTNAME;
}
