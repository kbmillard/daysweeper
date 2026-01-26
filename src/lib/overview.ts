'use client';

import { useQuery } from '@tanstack/react-query';

export function useOverview(range: string = '30d') {
  return useQuery({
    queryKey: ['overview', range],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/overview?range=${range}`);
      if (!res.ok) throw new Error('Failed to fetch overview');
      return res.json();
    }
  });
}
