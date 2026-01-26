"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useGeocodeTarget(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/targets/${id}/geocode`, { method: "POST" });
      if (!r.ok) throw new Error("geocode failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["target", id] });
      qc.invalidateQueries({ queryKey: ["targets"] });
    },
  });
}
