'use client';

import type { DeepEnrichmentSnapshot } from '@/lib/target-enrichment-types';

export type TargetLeadForMap = {
  id: string;
  company: string;
  deep_snapshot: DeepEnrichmentSnapshot | null;
};

type Props = {
  target: TargetLeadForMap | null;
  loading?: boolean;
};

export function EnrichedInsightCard({ target, loading = false }: Props) {
  if (loading) {
    return (
      <div className='mb-4 ios-glass rounded-2xl p-4 text-[14px]'>
        <p className='text-[12px] text-gray-600 italic'>Loading enrichment…</p>
      </div>
    );
  }

  const snap = target?.deep_snapshot;
  if (!snap) return null;

  return (
    <div className='mb-4 ios-glass rounded-2xl p-4 text-[14px] space-y-2'>
      <p className='ios-section-label mb-1'>Enriched insight</p>
      {snap.legalName && (
        <p className='font-semibold text-[15px] text-black'>{snap.legalName}</p>
      )}
      {(snap.industry || snap.siteFunction) && (
        <p className='text-gray-700 font-medium'>
          {[snap.industry, snap.siteFunction].filter(Boolean).join(' · ')}
        </p>
      )}
      {(snap.parentCompany || snap.employeesRange || snap.estimatedRevenue) && (
        <p className='text-gray-700'>
          {[snap.parentCompany, snap.employeesRange, snap.estimatedRevenue]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
      {snap.products.length > 0 && (
        <p className='text-gray-800'>
          <span className='font-medium'>Products:</span> {snap.products.slice(0, 4).join(', ')}
        </p>
      )}
      {snap.materialsHandled.length > 0 && (
        <p className='text-gray-800'>
          <span className='font-medium'>Materials:</span> {snap.materialsHandled.slice(0, 4).join(', ')}
        </p>
      )}
      {snap.usesBulkContainers && (
        <p className='text-gray-800'>{snap.usesBulkContainers}</p>
      )}
      {snap.salesAngle.length > 0 && (
        <ul className='mt-1 list-disc list-inside space-y-0.5 text-gray-800'>
          {snap.salesAngle.slice(0, 3).map((angle: string, idx: number) => (
            // eslint-disable-next-line react/no-array-index-key
            <li key={idx}>{angle}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
