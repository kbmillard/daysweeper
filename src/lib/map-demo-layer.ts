import type { MapPinLayers } from '@/components/map/map-pin-layers-control';

export type MapLayerMode = 'custom' | 'demo';

/**
 * When true, `/map/companies` is view-only (overlay blocks table + header Import/Add). Set false to
 * restore the full list.
 */
export const FREEZE_COMPANIES_LIST_FOR_DEMO = false;

/**
 * **Demo corridor** map mode only shows these `Company.id` values (plus the same routing rules).
 * One buyer company per state along **Michigan → South Carolina** (no West Virginia). Edit ids if your DB differs.
 */
export const DEMO_MAP_COMPANY_IDS: readonly string[] = [
  'fceaa1d4-be6d-42f4-aa4b-5db00074a3d2', // MI
  '8edbf868-50e9-438b-8431-5a9f75e0486c', // IN
  '421dd397-285e-4733-a53d-5e89421f667f', // OH
  '04467a7f-9029-4438-9b35-e1a0608c9168', // KY
  '6f134b78-d639-46df-9aa2-326b22d31f1d', // VA
  '3c27f5ad-daba-4688-a148-848c50779a86', // TN
  'e88382bf-5cde-47b0-b999-9768d1dcd72c', // NC
  '199993b1-6eb9-4919-90f9-373dd0f7a2d5' // SC
] as const;

export function getDemoMapCompanyIds(): string[] {
  return [...DEMO_MAP_COMPANY_IDS];
}

export function isMapDemoLayerConfigured(): boolean {
  return DEMO_MAP_COMPANY_IDS.length > 0;
}

/** In demo mode all three pin families stay “on” for routing UX; data is filtered to the demo subset. */
export function effectivePinLayers(mode: MapLayerMode, custom: MapPinLayers): MapPinLayers {
  if (mode === 'demo') {
    return { containers: true, companies: true, sellers: true };
  }
  return custom;
}
