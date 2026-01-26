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

export function useTargets(filters: TargetFilters = {}) {
  const params = new URLSearchParams();
  if (filters.q) params.append('q', filters.q);
  if (filters.state) params.append('state', filters.state);
  if (filters.tier) params.append('tier', filters.tier);
  if (filters.group) params.append('group', filters.group);
  if (filters.subtype) params.append('subtype', filters.subtype);
  if (filters.tags) {
    filters.tags.forEach((tag) => params.append('tags', tag));
  }

  return useQuery({
    queryKey: ['targets', filters],
    queryFn: async () => {
      const res = await fetch(`/api/targets?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch targets');
      return res.json();
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create target');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['targets'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
    }
  });
}

export function useUpdateTarget(id: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      if (!id) throw new Error('Target ID is required');
      const res = await fetch(`/api/targets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update target');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['target', id] });
      queryClient.invalidateQueries({ queryKey: ['targets'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
    }
  });
}
