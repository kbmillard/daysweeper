"use client";

import Link from "next/link";
import { useRoutes, useCreateRoute, useDeleteRoute } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function RoutesPage() { 
  return <RoutesList />; 
}

function RoutesList() {
  const { data: routes = [], isLoading } = useRoutes();
  const create = useCreateRoute();
  const del = useDeleteRoute();
  const [name, setName] = useState("");

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Input placeholder="New route name" value={name} onChange={(e)=>setName(e.target.value)} className="w-64" />
        <Button onClick={() => { if (!name.trim()) return; create.mutate({ name: name.trim() }); setName(""); }}>
          New Route
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
            ) : routes.map((r:any)=>(
              <tr key={r.id} className="hover:bg-muted/30">
                <td className="px-3 py-2"><Link href={`/dashboard/routes/${r.id}`} className="underline">{r.name}</Link></td>
                <td className="px-3 py-2">{r.assignedToUserId ?? "-"}</td>
                <td className="px-3 py-2">{r.scheduledFor ? new Date(r.scheduledFor).toLocaleDateString() : "-"}</td>
                <td className="px-3 py-2">{r._count?.stops ?? 0}</td>
                <td className="px-3 py-2"><Button variant="destructive" size="sm" onClick={() => del.mutate(r.id)}>Delete</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
