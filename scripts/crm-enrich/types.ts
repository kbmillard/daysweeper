/**
 * Types for CRM parent/subsidiary hierarchy v4/v5 and work queue.
 */

export interface AddressComponents {
  city?: string | null;
  state?: string | null;
  addressRegion?: string | null; // alias for state (some geocoders)
  postal_code?: string | null;
  postalCode?: string | null; // alias for postal_code
  country?: string | null;
  street?: string | null;
}

export interface CompanyFlat {
  externalId: string;
  name: string;
  website: string | null;
  companyKey: string | null;
  tier?: string | null;
  segment?: string | null;
  category?: string | null;
  subtypeGroup?: string | null;
  subtype?: string | null;
  parentExternalId: string | null;
  parentName: string | null;
  subsidiaryExternalIds: string[];
  locationExternalIds: string[];
  keyProducts?: string[] | null;
  industryKeywords?: string[] | null;
  contactInfo?: { phone?: string; email?: string } | null;
}

export interface LocationFlat {
  externalId: string;
  companyExternalId: string;
  company: string;
  website: string | null;
  addressRaw: string;
  addressComponents?: AddressComponents | null;
  addressConfidence?: number | null;
  addressHasStreetNumber?: boolean | null;
  segment?: string | null;
  tier?: string | null;
  category?: string | null;
  subtypeGroup?: string | null;
  subtype?: string | null;
  packagingSignals?: string[] | null;
  capabilityTags?: string[] | null;
  capabilityTagsLikely?: string[] | null;
  parentCompanyExternalId?: string | null;
  parentCompany?: string | null;
  websiteMissing?: boolean | null;
  industryKeywords?: string[] | null;
  metadata?: Record<string, unknown> | null;
}

export interface FlatData {
  companies: CompanyFlat[];
  locations: LocationFlat[];
}

export interface HierarchyV4 {
  generatedAt: string;
  sourceFiles: string[];
  stats: Record<string, number>;
  changesFromV3?: Record<string, number>;
  flat: FlatData;
}

/** Optional work queue: which companies/locations to process. If missing, derived from hierarchy. */
export interface WorkQueueV4 {
  companyExternalIds?: string[];
  locationExternalIds?: string[];
}

/** Extracted address from a page (official domain). */
export interface ExtractedAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  raw: string;
  sourceUrl: string;
}

/** Changelog summary for v5. */
export interface ChangelogSummary {
  parentWebsitesFilled: number;
  subsidiaryWebsitesFilled: number;
  locationsWithStreetAddressFilled: number;
  companiesStillMissingWebsite: string[];
  locationsStillMissingStreetAddress: string[];
}
