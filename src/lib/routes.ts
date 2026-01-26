'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface RouteFilters {
  assignedTo?: 'me';
}

export function useRoutes(filters: RouteFilters = {}) {
  const params = new URLSearchParams();
  if (filters.assignedTo) {
    params.append('assignedTo', filters.assignedTo);
  }

  return useQuery({
    queryKey: ['routes', filters],
    queryFn: async () => {
      const res = await fetch(`/api/routes?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch routes');
      return res.json();
    }
  });
}

export function useRoute(id: string | undefined) {
  return useQuery({
    queryKey: ['route', id],
    queryFn: async () => {
      if (!id) throw new Error('Route ID is required');
      const res = await fetch(`/api/routes/${id}`);
      if (!res.ok) throw new Error('Failed to fetch route');
      return res.json();
    },
    enabled: !!id
  });
}

export function useCreateRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; assignedToUserId?: string | null; scheduledFor?: string | null }) => {
      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create route');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    }
  });
}

export function useUpdateRoute(id: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name?: string; assignedToUserId?: string | null; scheduledFor?: string | null }) => {
      if (!id) throw new Error('Route ID is required');
      const res = await fetch(`/api/routes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update route');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route', id] });
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    }
  });
}

export function useReplaceStops(id: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (targetIds: string[]) => {
      if (!id) throw new Error('Route ID is required');
      const res = await fetch(`/api/routes/${id}/stops`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetIds })
      });
      if (!res.ok) throw new Error('Failed to replace stops');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route', id] });
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    }
  });
}

export function useDeleteRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/routes/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete route');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    }
  });
}
