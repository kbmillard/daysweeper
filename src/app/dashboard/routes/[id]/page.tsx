"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useRoute, useUpdateRoute, useReplaceStops } from "@/lib/routes";
import { useTargets } from "@/lib/targets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@clerk/nextjs";
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import RouteMap from "@/components/routes/RouteMap";
import { useGeocodeTarget } from "@/lib/geocode";
import { appleGeocodeBatch } from "@/lib/apple-geocode";

export default function RouteBuilderPage() {
  const id = String((useParams() as any).id);
  const { data: route, isLoading, refetch } = useRoute(id);
  const { data: targets = [] } = useTargets({});
  const replaceStops = useReplaceStops(id);
  const updateRoute = useUpdateRoute(id);
  const { user } = useUser();

  const [name, setName] = useState("");
  const [date, setDate] = useState<string | "">("");
  useEffect(() => {
    if (route?.name) setName(route.name);
    if (route?.scheduledFor) setDate(new Date(route.scheduledFor).toISOString().slice(0,10));
  }, [route?.name, route?.scheduledFor]);

  const stopTargetIds = useMemo(() => (route?.stops ?? []).map(s => s.target.id), [route?.stops?.length]);
  const [ordered, setOrdered] = useState<string[]>(stopTargetIds);
  useEffect(() => setOrdered(stopTargetIds), [stopTargetIds.join(",")]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const available = useMemo(() => {
    const set = new Set(ordered);
    return (targets as any[]).filter(t => !set.has(t.id));
  }, [targets, ordered]);

  const stopObjs = ordered
    .map((tid) => (targets as any[]).find((t) => t.id === tid))
    .filter(Boolean) as any[];

  if (isLoading || !route) return <div className="p-4">Loading…</div>;

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input className="w-64" value={name} onChange={(e) => setName(e.target.value)} />
        <Button onClick={() => updateRoute.mutate({ name }, { onSuccess: () => refetch() })}>Save Name</Button>

        <Input type="date" className="w-44" value={date} onChange={(e) => setDate(e.target.value)} />
        <Button size="sm" variant="secondary"
          onClick={() => updateRoute.mutate({ scheduledFor: date || undefined }, { onSuccess: () => refetch() })}>
          Save Date
        </Button>

        <Button size="sm"
          onClick={() => updateRoute.mutate({ assignedToUserId: user?.id ?? undefined }, { onSuccess: () => refetch() })}>
          Assign to me
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <a className="rounded border px-2 py-1 text-xs" href={`/api/routes/${id}/ical`} target="_blank">Download .ics</a>
        {route?.scheduledFor && (
          <>
            <a className="rounded border px-2 py-1 text-xs" target="_blank"
               href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(route.name)}&dates=${new Date(route.scheduledFor).toISOString().replace(/[-:]/g,"").split(".")[0]}Z/${new Date(new Date(route.scheduledFor).getTime()+60*60*1000).toISOString().replace(/[-:]/g,"").split(".")[0]}Z&details=Route%20in%20Daysweeper`}>
              Add to Google
            </a>
            <a className="rounded border px-2 py-1 text-xs" target="_blank"
               href={`https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(route.name)}&body=Route%20via%20Daysweeper`}>
              Add to Outlook
            </a>
          </>
        )}
      </div>

      <RouteMap stops={stopObjs} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-md border p-3">
          <div className="mb-2 font-medium">Available Companies</div>
          <div className="max-h-[60vh] overflow-auto space-y-2">
            {available.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between rounded border p-2">
                <div>
                  <div className="font-medium">{t.company}</div>
                  <div className="text-xs text-muted-foreground">{t.addressRaw ?? ""}</div>
                </div>
                <Button size="sm" onClick={() => setOrdered((cur) => [...cur, t.id])}>Add</Button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="font-medium">Route Stops</div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => replaceStops.mutate(ordered, { onSuccess: () => refetch() })}>Save Order</Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  const missing = stopObjs
                    .filter((t: any) => !(t.latitude && t.longitude));
                  if (missing.length === 0) return;

                  for (const t of missing) {
                    await fetch(`/api/targets/${t.id}/geocode`, { method: "POST" });
                  }
                  await refetch();
                }}
              >
                Geocode Missing
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  const missing = stopObjs
                    .filter((t: any) => !(t.latitude && t.longitude))
                    .map((t: any) => ({ id: t.id, query: t.addressRaw || t.company }));
                  if (missing.length === 0) return;

                  const results = await appleGeocodeBatch(missing);
                  for (const r of results) {
                    await fetch(`/api/targets/${r.id}`, {
                      method: "PATCH",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ latitude: String(r.lat), longitude: String(r.lon) }),
                    });
                  }
                  await refetch();
                }}
              >
                Geocode Missing (Apple)
              </Button>
            </div>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
            if (!over || active.id === over.id) return;
            setOrdered((curr) => arrayMove(curr, curr.indexOf(String(active.id)), curr.indexOf(String(over.id))));
          }}>
            <SortableContext items={ordered} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {ordered.map((tid, idx) => <SortableStop key={tid} id={tid} idx={idx} targets={targets as any[]} onRemove={() => setOrdered((cur) => cur.filter(x => x !== tid))} />)}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </div>
  );
}

function SortableStop({ id, idx, targets, onRemove }: { id: string; idx: number; targets: any[]; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const t = targets.find((x) => x.id === id);
  return (
    <div ref={setNodeRef} style={style} className="flex items-center justify-between rounded border p-2 bg-card" {...attributes} {...listeners}>
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 grid place-items-center rounded bg-muted text-xs">{idx + 1}</div>
        <div>
          <div className="font-medium">{t?.company ?? id}</div>
          <div className="text-xs text-muted-foreground">{t?.addressRaw ?? ""}</div>
          {t?.latitude && t?.longitude && (
            <div className="flex gap-2 text-xs mt-1">
              <a target="_blank" className="underline" href={`http://maps.apple.com/?daddr=${t.latitude},${t.longitude}`}>Apple Maps</a>
              <a target="_blank" className="underline" href={`https://www.google.com/maps/search/?api=1&query=${t.latitude},${t.longitude}`}>Google Maps</a>
            </div>
          )}
        </div>
      </div>
      <button className="text-xs rounded border px-2 py-1" onClick={onRemove}>Remove</button>
    </div>
  );
}
