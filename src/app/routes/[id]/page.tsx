"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useRoute, useReplaceStops, useUpdateRoute } from "@/lib/routes";
import { useTargets } from "@/lib/targets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import OutcomeButtons from "@/components/routes/OutcomeButtons";

export default function RouteBuilderPage() {
  const params = useParams();
  const id = String(params?.id);
  const { data: route, isLoading } = useRoute(id);
  const { data: targets = [] } = useTargets({});
  const replaceStops = useReplaceStops(id);
  const updateRoute = useUpdateRoute(id);

  const [name, setName] = useState("");
  useEffect(() => { if (route?.name) setName(route.name); }, [route?.name]);

  const stopTargetIds = useMemo(() => (route?.stops ?? []).map(s => s.target.id), [route?.stops]);
  const [ordered, setOrdered] = useState<string[]>(stopTargetIds);
  useEffect(() => setOrdered(stopTargetIds), [stopTargetIds.join(",")]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const available = useMemo(() => {
    const set = new Set(ordered);
    return (targets as any[]).filter(t => !set.has(t.id));
  }, [targets, ordered]);

  if (isLoading || !route) return <div className="p-4">Loading…</div>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input className="w-64" value={name} onChange={(e) => setName(e.target.value)} />
        <Button onClick={() => updateRoute.mutate({ name })}>Save Name</Button>
      </div>

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
            <Button size="sm" onClick={() => replaceStops.mutate(ordered)}>Save Order</Button>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => {
            const { active, over } = e;
            if (!over || active.id === over.id) return;
            setOrdered((curr) => {
              const oldIndex = curr.indexOf(String(active.id));
              const newIndex = curr.indexOf(String(over.id));
              return arrayMove(curr, oldIndex, newIndex);
            });
          }}>
            <SortableContext items={ordered} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {ordered.map((tid, idx) => {
                  const stop = route.stops.find(s => s.target.id === tid);
                  return (
                    <SortableStop 
                      key={tid} 
                      id={tid} 
                      idx={idx} 
                      targets={targets as any[]} 
                      stopId={stop?.id}
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
  );
}

function SortableStop({ 
  id, 
  idx, 
  targets, 
  stopId, 
  onRemove 
}: { 
  id: string; 
  idx: number; 
  targets: any[]; 
  stopId?: string;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const t = targets.find((x) => x.id === id);
  
  return (
    <div ref={setNodeRef} style={style} className="flex flex-col gap-2 rounded border p-2 bg-card">
      <div className="flex items-center justify-between" {...attributes} {...listeners}>
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 text-xs grid place-items-center rounded bg-muted">{idx + 1}</div>
          <div>
            <div className="font-medium">{t?.company ?? id}</div>
            <div className="text-xs text-muted-foreground">{t?.addressRaw ?? ""}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            className="text-xs rounded border px-2 py-1" 
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            Remove
          </button>
        </div>
      </div>
      {stopId && (
        <div className="pl-9">
          <OutcomeButtons stopId={stopId} />
        </div>
      )}
    </div>
  );
}
