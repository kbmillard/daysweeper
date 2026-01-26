"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

export function useTargets(params: TargetFilters = {}) {
  return useQuery({
    queryKey: ["targets", params],
    queryFn: async () => {
      const res = await fetch(`/api/targets?${qs({ ...params, tags: params.tags?.join(",") })}`);
      if (!res.ok) return [];
      return res.json();
    }
  });
}

export function useTarget(id: string) {
  return useQuery({
    queryKey: ["target", id],
    enabled: !!id,
    queryFn: async () => {
      const r = await fetch(`/api/targets/${id}`);
      if (!r.ok) throw new Error("Failed to load target");
      return r.json();
    }
  });
}

export function useCreateTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch(`/api/targets`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!r.ok) throw new Error("Create failed");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["targets"] })
  });
}

export function useUpdateTarget(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch(`/api/targets/${id}`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!r.ok) throw new Error("Update failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["targets"] });
      qc.invalidateQueries({ queryKey: ["target", id] });
    }
  });
}
