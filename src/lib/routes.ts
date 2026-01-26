"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type RouteDTO = {
  id: string;
  name: string;
  assignedToUserId?: string | null;
  assignedToName?: string | null;
  assignedToEmail?: string | null;
  scheduledFor?: string | null;
  _count?: { stops: number };
  created?: string;
};

export type RouteDetailDTO = {
  id: string;
  name: string;
  assignedToUserId?: string | null;
  assignedToName?: string | null;
  assignedToEmail?: string | null;
  scheduledFor?: string | null;
  stops: Array<{
    id: string;
    seq: number;
    target: { id: string; company: string; addressRaw?: string | null; latitude?: string | number | null; longitude?: string | number | null };
  }>;
};

export function useRoutes(assignedTo?: string) {
  return useQuery({
    queryKey: ["routes", assignedTo],
    queryFn: async () => {
      let url = `/api/routes`;
      if (assignedTo) {
        url += `?assignedTo=${encodeURIComponent(assignedTo)}`;
      }
      const r = await fetch(url);
      if (!r.ok) return [];
      return (await r.json()) as RouteDTO[];
    },
  });
}

export function useRoute(id: string) {
  return useQuery({
    queryKey: ["route", id],
    enabled: !!id,
    queryFn: async () => {
      const r = await fetch(`/api/routes/${id}`);
      if (!r.ok) throw new Error("Failed to load route");
      return (await r.json()) as RouteDetailDTO;
    },
  });
}

export function useCreateRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; assignedToUserId?: string; scheduledFor?: string }) => {
      const r = await fetch(`/api/routes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error("Create route failed");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routes"] }),
  });
}

export function useUpdateRoute(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<{ name: string; assignedToUserId?: string | null; scheduledFor?: string | null }>) => {
      const r = await fetch(`/api/routes/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error("Update route failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["route", id] });
      qc.invalidateQueries({ queryKey: ["routes"] });
    },
  });
}

export function useDeleteRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/routes/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Delete route failed");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routes"] }),
  });
}

export function useReplaceStops(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (targetIds: string[]) => {
      const r = await fetch(`/api/routes/${id}/stops`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetIds }),
      });
      if (!r.ok) throw new Error("Save stops failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["route", id] });
    },
  });
}

export function usePatchStopOutcome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ stopId, outcome, note }: { stopId: string; outcome: "VISITED"|"NO_ANSWER"|"WRONG_ADDRESS"|"FOLLOW_UP"; note?: string }) => {
      const r = await fetch(`/api/routes/stops/${stopId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outcome, note }),
      });
      if (!r.ok) throw new Error("Outcome update failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["routes"] });
      qc.invalidateQueries({ queryKey: ["route"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });
}

export function useOptimizeRoute(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/routes/${id}/optimize`, { method: "POST" });
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        throw new Error(`Optimize failed: ${text || r.status}`);
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["route", id] });
      qc.invalidateQueries({ queryKey: ["routes"] });
    },
  });
}
