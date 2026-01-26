'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useRoute, useUpdateRoute, useReplaceStops } from '@/lib/routes';
import { useTargets } from '@/lib/targets';
import { useDebounce } from '@/hooks/use-debounce';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useUser } from '@clerk/nextjs';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconGripVertical } from '@tabler/icons-react';
import { normalizeTierLabel } from '@/taxonomy/automotive';

interface Stop {
  id: string;
  targetId: string;
  seq: number;
  target: {
    id: string;
    company: string;
    addressRaw: string;
    website: string | null;
    phone: string | null;
    email: string | null;
  };
}

function SortableStop({ stop, onRemove }: { stop: Stop; onRemove: (id: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: stop.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border bg-card p-3"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground"
      >
        <IconGripVertical className="h-5 w-5" />
      </button>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="w-8 text-center">
            {stop.seq}
          </Badge>
          <span className="font-medium">{stop.target.company}</span>
        </div>
        <p className="text-sm text-muted-foreground">{stop.target.addressRaw}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onRemove(stop.id)}
      >
        Remove
      </Button>
    </div>
  );
}

export default function RouteBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const routeId = params.id as string;

  const { data: route, isLoading } = useRoute(routeId);
  const updateRoute = useUpdateRoute(routeId);
  const replaceStops = useReplaceStops(routeId);

  const [name, setName] = useState('');
  const [assignToMe, setAssignToMe] = useState(false);
  const [scheduledFor, setScheduledFor] = useState('');
  const [stops, setStops] = useState<Stop[]>([]);

  const [search, setSearch] = useState('');
  const [state, setState] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const filters = {
    q: debouncedSearch || undefined,
    state: state || undefined
  };

  const { data: availableTargets } = useTargets(filters);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  useEffect(() => {
    if (route) {
      setName(route.name || '');
      setAssignToMe(!!route.assignedToUserId);
      setScheduledFor(
        route.scheduledFor
          ? new Date(route.scheduledFor).toISOString().slice(0, 16)
          : ''
      );
      setStops(route.stops || []);
    }
  }, [route]);

  const stopTargetIds = useMemo(() => stops.map((s) => s.targetId), [stops]);
  const stopIds = useMemo(() => stops.map((s) => s.id), [stops]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = stopIds.indexOf(active.id as string);
    const newIndex = stopIds.indexOf(over.id as string);

    const newStops = arrayMove(stops, oldIndex, newIndex).map((stop, index) => ({
      ...stop,
      seq: index + 1
    }));

    setStops(newStops);
  };

  const handleAddStop = (targetId: string) => {
    if (stopTargetIds.includes(targetId)) {
      toast.error('Company already in route');
      return;
    }

    const target = availableTargets?.find((t: any) => t.id === targetId);
    if (!target) return;

    const newStop: Stop = {
      id: `temp-${Date.now()}`,
      targetId: target.id,
      seq: stops.length + 1,
      target: {
        id: target.id,
        company: target.company,
        addressRaw: target.addressRaw,
        website: target.website,
        phone: target.phone,
        email: target.email
      }
    };

    setStops([...stops, newStop]);
  };

  const handleRemoveStop = (stopId: string) => {
    const newStops = stops
      .filter((s) => s.id !== stopId)
      .map((stop, index) => ({
        ...stop,
        seq: index + 1
      }));
    setStops(newStops);
  };

  const handleSaveOrder = async () => {
    try {
      await replaceStops.mutateAsync(stopTargetIds);
      toast.success('Route order saved');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save order');
    }
  };

  const handleSaveRoute = async () => {
    if (!name.trim()) {
      toast.error('Route name is required');
      return;
    }

    try {
      await updateRoute.mutateAsync({
        name: name.trim(),
        assignedToUserId: assignToMe ? user?.id || null : null,
        scheduledFor: scheduledFor || null
      });
      toast.success('Route saved');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save route');
    }
  };

  const extractCity = (address: string): string => {
    const parts = address.split(',').map((p) => p.trim());
    if (parts.length >= 2) {
      return parts[parts.length - 2];
    }
    return address.split(' ')[0] || 'N/A';
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading route...</div>
        </div>
      </PageContainer>
    );
  }

  if (!route) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Route not found</div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="flex flex-1 flex-col space-y-4">
        {/* Header Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Route Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-sm font-medium">Route Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Route name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Scheduled Date</label>
                <Input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="assignToMe"
                    checked={assignToMe}
                    onChange={(e) => setAssignToMe(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="assignToMe" className="text-sm font-medium">
                    Assign to me
                  </label>
                </div>
              </div>
            </div>
            <Button onClick={handleSaveRoute} disabled={updateRoute.isPending}>
              {updateRoute.isPending ? 'Saving...' : 'Save Route'}
            </Button>
          </CardContent>
        </Card>

        {/* Two Pane Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left Pane: Available Companies */}
          <Card>
            <CardHeader>
              <CardTitle>Available Companies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Input
                  placeholder="Search companies..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">All States</option>
                  <option value="ACCOUNT">Account</option>
                  <option value="NEW_UNCONTACTED">New - Uncontacted</option>
                  <option value="NEW_CONTACTED_NO_ANSWER">New - No Answer</option>
                </select>
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {availableTargets && availableTargets.length > 0 ? (
                  availableTargets.map((target: any) => (
                    <div
                      key={target.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{target.company}</div>
                        <div className="text-sm text-muted-foreground">
                          {extractCity(target.addressRaw)}
                          {target.supplyTier && (
                            <>
                              {' • '}
                              {normalizeTierLabel(target.supplyTier)}
                            </>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={stopTargetIds.includes(target.id) ? 'secondary' : 'default'}
                        disabled={stopTargetIds.includes(target.id)}
                        onClick={() => handleAddStop(target.id)}
                      >
                        {stopTargetIds.includes(target.id) ? 'Added' : 'Add'}
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-8">
                    No companies found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Right Pane: Route Stops */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Route Stops ({stops.length})</CardTitle>
                <Button
                  onClick={handleSaveOrder}
                  disabled={replaceStops.isPending || stops.length === 0}
                  size="sm"
                >
                  {replaceStops.isPending ? 'Saving...' : 'Save Order'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {stops.length > 0 ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={stopIds}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {stops.map((stop) => (
                        <SortableStop
                          key={stop.id}
                          stop={stop}
                          onRemove={handleRemoveStop}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-8">
                  No stops yet. Add companies from the left pane.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
