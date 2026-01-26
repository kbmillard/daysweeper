"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRoutes, useCreateRoute, useDeleteRoute } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUser } from "@clerk/nextjs";
import { useState } from "react";
import { toast } from "sonner";

export default function RoutesPage() { 
  return <RoutesList />; 
}

function RoutesList() {
  const router = useRouter();
  const { user } = useUser();
  const [filterAssigned, setFilterAssigned] = useState<string>("all");
  const assignedTo = filterAssigned === "me" ? user?.id : filterAssigned === "unassigned" ? "unassigned" : undefined;
  const { data: routes = [], isLoading } = useRoutes(assignedTo);
  const create = useCreateRoute();
  const del = useDeleteRoute();
  const [name, setName] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      const created = await create.mutateAsync({ name: name.trim() });
      setName("");
      toast.success("Route created");
      router.push(`/dashboard/routes/${created.id}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to create route");
    }
  };

  const handleDelete = async (routeId: string, routeName: string) => {
    if (!confirm(`Delete route "${routeName}"?`)) return;
    try {
      await del.mutateAsync(routeId);
      toast.success("Route deleted");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete route");
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Input placeholder="New route name" value={name} onChange={(e)=>setName(e.target.value)} className="w-64" 
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim() && !create.isPending) {
              handleCreate();
            }
          }}
        />
        <Button 
          onClick={handleCreate}
          disabled={!name.trim() || create.isPending}
        >
          {create.isPending ? "Creating..." : "New Route"}
        </Button>
        <Select value={filterAssigned} onValueChange={setFilterAssigned}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by assignment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Routes</SelectItem>
            <SelectItem value="me">My Routes</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
          </SelectContent>
        </Select>
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
            ) : routes.map((r:any)=>(
              <tr key={r.id} className="hover:bg-muted/30">
                <td className="px-3 py-2"><Link href={`/dashboard/routes/${r.id}`} className="underline">{r.name}</Link></td>
                <td className="px-3 py-2">{r.assignedToName ?? r.assignedToEmail ?? r.assignedToUserId ?? "—"}</td>
                <td className="px-3 py-2">{r.scheduledFor ? new Date(r.scheduledFor).toLocaleDateString() : "-"}</td>
                <td className="px-3 py-2">{r._count?.stops ?? 0}</td>
                <td className="px-3 py-2"><Button variant="destructive" size="sm" onClick={() => handleDelete(r.id, r.name)} disabled={del.isPending}>Delete</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
