'use client';

import { useQuery } from '@tanstack/react-query';

export function useOverview(range = '30d') {
  return useQuery({
    queryKey: ['overview', range],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/overview?range=${range}`);
      if (!res.ok) {
        // never crash charts; return empty shape
        return {
          cards: { totalTargets: 0, newLeads: 0, accounts: 0, completionRate: 0 },
          charts: { byDay: [], stateDistribution: [] }
        };
      }
      return res.json();
    }
  });
}
