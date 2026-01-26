'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface TargetFilters {
  q?: string;
  state?: string;
  tier?: string;
  group?: string;
  subtype?: string;
  tags?: string[];
}

const qs = (o: Record<string, any>) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null && String(v).length > 0)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(Array.isArray(v) ? v.join(',') : v)}`)
    .join('&');

export function useTargets(filters: TargetFilters = {}) {
  return useQuery({
    queryKey: ['targets', filters],
    queryFn: async () => {
      const res = await fetch(`/api/targets?${qs({ ...filters, tags: filters.tags?.join(',') })}`);
      // Do NOT throw; return [] to avoid crashing consumers
      if (!res.ok) return [];
      return (await res.json()) as any[];
    }
  });
}

export function useTarget(id: string | undefined) {
  return useQuery({
    queryKey: ['target', id],
    queryFn: async () => {
      if (!id) throw new Error('Target ID is required');
      const res = await fetch(`/api/targets/${id}`);
      if (!res.ok) throw new Error('Failed to fetch target');
      return res.json();
    },
    enabled: !!id
  });
}

export function useCreateTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch(`/api/targets`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!r.ok) throw new Error('Create failed');
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['targets'] })
  });
}

export function useUpdateTarget(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      if (!id) throw new Error('Target ID is required');
      const r = await fetch(`/api/targets/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!r.ok) throw new Error('Update failed');
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['target', id] });
      qc.invalidateQueries({ queryKey: ['targets'] });
    }
  });
}
