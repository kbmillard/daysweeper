'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useNotes(targetId: string | undefined) {
  return useQuery({
    queryKey: ['notes', targetId],
    queryFn: async () => {
      if (!targetId) throw new Error('Target ID is required');
      const res = await fetch(`/api/targets/${targetId}/notes`);
      if (!res.ok) throw new Error('Failed to fetch notes');
      return res.json();
    },
    enabled: !!targetId
  });
}

export function useCreateNote(targetId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { content: string; tags?: string[]; mentions?: string[] }) => {
      if (!targetId) throw new Error('Target ID is required');
      const res = await fetch(`/api/targets/${targetId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create note');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', targetId] });
      queryClient.invalidateQueries({ queryKey: ['targets'] });
    }
  });
}
