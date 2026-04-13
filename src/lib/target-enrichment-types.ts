/**
 * Shape of `deep_snapshot` on lead/target payloads (map + LastLeg).
 */

export type DeepEnrichmentSnapshot = {
  legalName?: string;
  industry?: string;
  siteFunction?: string;
  parentCompany?: string;
  employeesRange?: string;
  estimatedRevenue?: string;
  products: string[];
  materialsHandled: string[];
  usesBulkContainers?: string;
  salesAngle: string[];
};
