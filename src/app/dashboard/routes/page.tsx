"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRoutes, useCreateRoute, useDeleteRoute } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";

export default function RoutesPage() {
  return <RoutesList />;
}

function RoutesList() {
  const router = useRouter();
  const { data: routes = [], isLoading } = useRoutes();
  const create = useCreateRoute();
  const deleteMut = useDeleteRoute();
  const [name, setName] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Route name is required");
      return;
    }

    try {
      const route = await create.mutateAsync({ name: name.trim() });
      toast.success("Route created successfully");
      setName("");
      router.push(`/dashboard/routes/${route.id}`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to create route");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this route?")) return;
    
    try {
      await deleteMut.mutateAsync(id);
      toast.success("Route deleted successfully");
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete route");
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Input 
          placeholder="New route name" 
          value={name} 
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleCreate();
            }
          }}
          className="w-64" 
        />
        <Button
          onClick={handleCreate}
          disabled={create.isPending || !name.trim()}
        >
          {create.isPending ? "Creating..." : "New Route"}
        </Button>
      </div>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Assigned</th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left"># Stops</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td className="p-4" colSpan={5}>Loading…</td></tr>
            ) : routes.length === 0 ? (
              <tr><td className="p-4 text-muted-foreground" colSpan={5}>No routes yet.</td></tr>
            ) : (
              routes.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2"><Link href={`/dashboard/routes/${r.id}`} className="underline">{r.name}</Link></td>
                  <td className="px-3 py-2">{r.assignedToUserId ?? "-"}</td>
                  <td className="px-3 py-2">{r.scheduledFor ? new Date(r.scheduledFor).toLocaleDateString() : "-"}</td>
                  <td className="px-3 py-2">{r._count?.stops ?? 0}</td>
                  <td className="px-3 py-2">
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={() => handleDelete(r.id)}
                      disabled={deleteMut.isPending}
                    >
                      {deleteMut.isPending ? "Deleting..." : "Delete"}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
