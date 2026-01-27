"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useRoute, useUpdateRoute, useReplaceStops, useOptimizeRoute } from "@/lib/routes";
import { useTargets } from "@/lib/targets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@clerk/nextjs";
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import RouteMapInteractive from "@/components/routes/RouteMapInteractive";
import AssignControl from "@/components/routes/AssignControl";
import OutcomeButtons from "@/components/routes/OutcomeButtons";
import RouteActivity from "@/components/routes/RouteActivity";
import { toast } from "sonner";

export default function RoutePageClient({ canReassign }: { canReassign: boolean }) {
  const id = String((useParams() as any).id);
  const { data: route, isLoading, refetch } = useRoute(id);
  const { data: targets = [] } = useTargets({});
  const replaceStops = useReplaceStops(id);
  const updateRoute = useUpdateRoute(id);
  const optimizeRoute = useOptimizeRoute(id);
  const { user } = useUser();

  const [name, setName] = useState("");
  const [date, setDate] = useState<string | "">("");
  useEffect(() => {
    if (route?.name) setName(route.name);
    if (route?.scheduledFor) setDate(new Date(route.scheduledFor).toISOString().slice(0, 10));
  }, [route?.name, route?.scheduledFor]);

  const stopTargetIds = useMemo(() => (route?.stops ?? []).map(s => s.target.id), [route?.stops?.length]);
  const [ordered, setOrdered] = useState<string[]>(stopTargetIds);
  useEffect(() => setOrdered(stopTargetIds), [stopTargetIds.join(",")]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const available = useMemo(() => {
    const set = new Set(ordered);
    return (targets as any[]).filter(t => !set.has(t.id));
  }, [targets, ordered]);

  // Get stop objects with route data (includes lat/lon from route.stops)
  const stopObjs = ordered.map((tid) => {
    const target = (targets as any[]).find((t) => t.id === tid);
    const stop = route?.stops?.find((s) => s.target.id === tid);
    return {
      ...target,
      id: tid,
      latitude: stop?.target?.latitude ?? target?.latitude,
      longitude: stop?.target?.longitude ?? target?.longitude,
    };
  }).filter(Boolean) as any[];

  // Listen for route refresh events (from map append, assign, etc.)
  useEffect(() => {
    const handler = () => refetch();
    window.addEventListener("route:refresh", handler);
    return () => window.removeEventListener("route:refresh", handler);
  }, [refetch]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "/") {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>('[data-route-search]');
        searchInput?.focus();
      } else if (e.key === "r" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("route:redraw"));
      } else if (e.key === "o" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleOptimize();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleOptimize = async () => {
    const missing = stopObjs.filter((t: any) => !(t.latitude && t.longitude));
    if (missing.length > 0) {
      toast.error("All stops must have coordinates to optimize");
      return;
    }
    try {
      await optimizeRoute.mutateAsync();
      await refetch();
      toast.success("Route optimized successfully");
    } catch (error: any) {
      toast.error(error.message || "Optimization failed");
    }
  };

  const handleAddStop = (targetId: string) => {
    setOrdered((cur) => [...cur, targetId]);
    toast.success("Stop added to route");
  };

  const handleSaveOrder = async () => {
    try {
      await replaceStops.mutateAsync(ordered);
      await refetch();
      toast.success("Route order saved");
    } catch (error: any) {
      toast.error(error.message || "Failed to save order");
    }
  };

  if (isLoading || !route) return <div className="p-4">Loading…</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background border-b p-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Input className="w-64" value={name} onChange={(e) => setName(e.target.value)} />
          <Button onClick={() => updateRoute.mutate({ name }, { onSuccess: () => { refetch(); toast.success("Route name saved"); } })}>Save Name</Button>

          <Input type="date" className="w-44" value={date} onChange={(e) => setDate(e.target.value)} />
          <Button size="sm" variant="secondary"
            onClick={() => updateRoute.mutate({ scheduledFor: date || undefined }, { onSuccess: () => { refetch(); toast.success("Date saved"); } })}>
            Save Date
          </Button>

          <AssignControl 
            routeId={id} 
            currentAssigneeId={route.assignedToUserId} 
            currentAssigneeName={route.assignedToName}
            currentAssigneeEmail={route.assignedToEmail}
            meId={user?.id || undefined} 
            canReassign={canReassign} 
          />

          <Button size="sm" variant="secondary" disabled={optimizeRoute.isPending || stopObjs.length < 2} onClick={handleOptimize}>
            {optimizeRoute.isPending ? "Optimizing..." : "Optimize"}
          </Button>

          <a className="rounded border px-2 py-1 text-xs" href={`/api/routes/${id}/ical`} target="_blank">Download .ics</a>
          {route?.scheduledFor && (
            <>
              <a className="rounded border px-2 py-1 text-xs" target="_blank"
                href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(route.name)}&dates=${new Date(route.scheduledFor).toISOString().replace(/[-:]/g, "").split(".")[0]}Z/${new Date(new Date(route.scheduledFor).getTime() + 60 * 60 * 1000).toISOString().replace(/[-:]/g, "").split(".")[0]}Z&details=Route%20in%20Daysweeper`}>
                Add to Google
              </a>
              <a className="rounded border px-2 py-1 text-xs" target="_blank"
                href={`https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(route.name)}&body=Route%20via%20Daysweeper`}>
                Add to Outlook
              </a>
            </>
          )}
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
        {/* Left: Map + Stops */}
        <div className="lg:col-span-2 flex flex-col space-y-4 overflow-auto">
          <RouteMapInteractive route={route} routeId={id} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-md border p-3">
              <div className="mb-2 font-medium">Available Companies</div>
              <div className="max-h-[40vh] overflow-auto space-y-2">
                {available.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between rounded border p-2">
                    <div>
                      <div className="font-medium">{t.company}</div>
                      <div className="text-xs text-muted-foreground">{t.addressRaw ?? ""}</div>
                    </div>
                    <Button size="sm" onClick={() => handleAddStop(t.id)}>Add</Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-medium">Route Stops</div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveOrder}>Save Order</Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      const missing = stopObjs
                        .filter((t: any) => !(t.latitude && t.longitude));
                      if (missing.length === 0) {
                        toast.info("All stops have coordinates");
                        return;
                      }

                      for (const t of missing) {
                        await fetch(`/api/targets/${t.id}/geocode`, { method: "POST" });
                      }
                      await refetch();
                      toast.success("Geocoding completed");
                    }}
                  >
                    Geocode Missing
                  </Button>
                </div>
              </div>

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
                if (!over || active.id === over.id) return;
                setOrdered((curr) => arrayMove(curr, curr.indexOf(String(active.id)), curr.indexOf(String(over.id))));
              }}>
                <SortableContext items={ordered} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2 max-h-[40vh] overflow-auto">
                    {ordered.map((tid, idx) => {
                      const stop = route?.stops?.find((s) => s.target.id === tid);
                      return (
                        <SortableStop
                          key={tid}
                          id={tid}
                          idx={idx}
                          stopId={stop?.id}
                          targets={targets as any[]}
                          routeStops={route?.stops}
                          onRemove={() => setOrdered((cur) => cur.filter(x => x !== tid))}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </div>
        </div>

        {/* Right Rail: Route Activity */}
        <div className="lg:col-span-1 overflow-auto">
          {route && (
            <RouteActivity routeId={id} initialRoute={route} />
          )}
        </div>
      </div>
    </div>
  );
}

function SortableStop({
  id,
  idx,
  targets,
  stopId,
  routeStops,
  onRemove
}: {
  id: string;
  idx: number;
  targets: any[];
  stopId?: string;
  routeStops?: Array<{ id: string; target: { id: string; latitude?: string | number | null; longitude?: string | number | null } }>;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const t = targets.find((x) => x.id === id);
  const stop = routeStops?.find((s) => s.target.id === id);
  const lat = stop?.target?.latitude ?? t?.latitude;
  const lon = stop?.target?.longitude ?? t?.longitude;

  return (
    <div ref={setNodeRef} style={style} className="rounded border p-2 bg-card space-y-2">
      <div className="flex items-center justify-between" {...attributes} {...listeners}>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-6 h-6 grid place-items-center rounded bg-muted text-xs cursor-grab">{idx + 1}</div>
          <div className="flex-1">
            <div className="font-medium">{t?.company ?? id}</div>
            <div className="text-xs text-muted-foreground">{t?.addressRaw ?? ""}</div>
            {lat && lon && (
              <div className="flex gap-2 text-xs mt-1">
                <a target="_blank" className="underline" href={`http://maps.apple.com/?daddr=${lat},${lon}`}>Apple Maps</a>
                <a target="_blank" className="underline" href={`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`}>Google Maps</a>
              </div>
            )}
          </div>
        </div>
        <button className="text-xs rounded border px-2 py-1 hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); onRemove(); }}>Remove</button>
      </div>
      {stopId && (
        <div className="pl-9">
          <OutcomeButtons stopId={stopId} onDone={() => {}} />
        </div>
      )}
    </div>
  );
}
