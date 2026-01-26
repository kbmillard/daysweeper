"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";

type RouteType = {
  id: string;
  stops: Array<{
    id: string;
    seq: number;
    target: { id: string; company: string; addressRaw?: string | null };
  }>;
};

type Note = {
  id: string;
  content: string;
  tags: string[];
  userId: string;
  createdAt: string;
  routeId?: string | null;
  routeStopId?: string | null;
  targetId: string;
  mentions?: string[];
};

const MENTION_RE = /([A-Za-z0-9][A-Za-z0-9\s\-\&]{2,50})/g;

function linkifyCompanies(text: string, companies: { id: string; name: string; slug: string }[]) {
  // naive: replace exact company names with links (longest first)
  const sorted = [...companies].sort((a, b) => b.name.length - a.name.length);
  let html = text;
  for (const c of sorted) {
    const esc = c.name.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    const reg = new RegExp(`\\b${esc}\\b`, "gi");
    html = html.replace(reg, `<a class="underline text-blue-600" href="/dashboard/companies/${c.id}">${c.name}</a>`);
  }
  return html;
}

export default function RouteActivity({ routeId, initialRoute }: { routeId: string; initialRoute: RouteType }) {
  const [route, setRoute] = React.useState<RouteType>(initialRoute);
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [content, setContent] = React.useState("");
  const [tags, setTags] = React.useState<string[]>([]);
  const [stopId, setStopId] = React.useState<string | undefined>(route.stops?.[0]?.id);
  const [targetId, setTargetId] = React.useState<string | undefined>(route.stops?.[0]?.target?.id);
  const [outcome, setOutcome] = React.useState<string>("VISITED");
  const [schedule, setSchedule] = React.useState(false);
  const [startAt, setStartAt] = React.useState<string>("");

  const companyIndex = React.useMemo(
    () =>
      (route.stops || []).map((s) => ({
        id: s.target.id,
        name: s.target.company,
        slug: s.target.company.toLowerCase().replace(/\s+/g, "-")
      })),
    [route]
  );

  const load = async () => {
    const r = await fetch(`/api/routes/${routeId}`, { cache: "no-store" }).then((r) => r.json());
    setRoute(r);
    // pull all target notes for these stops
    const allNotes: Note[] = [];
    for (const s of r.stops) {
      const ns = await fetch(`/api/targets/${s.target.id}/notes`).then((r) => r.json());
      for (const n of ns) {
        allNotes.push(n);
      }
    }
    allNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setNotes(allNotes);
  };
  React.useEffect(() => {
    load();
  }, [routeId]);

  const onSelectStop = (stopId: string) => {
    setStopId(stopId);
    const st = route.stops.find((s) => s.id === stopId);
    setTargetId(st?.target?.id);
  };

  const submit = async () => {
    if (!targetId) return;
    // 1) optional outcome → PATCH stop
    if (stopId && outcome) {
      await fetch(`/api/routes/stops/${stopId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outcome, visitedAt: new Date().toISOString() })
      });
    }
    // 2) create note on target, attach route/stop ids, compute mentions
    const mentions = Array.from(
      new Set(
        (content.match(MENTION_RE) || [])
          .map((s) => s.toLowerCase().trim().replace(/\s+/g, "-"))
          .filter((x) => companyIndex.some((c) => c.slug === x))
      )
    );
    await fetch(`/api/targets/${targetId}/notes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content,
        tags,
        userId: "web",
        routeId,
        routeStopId: stopId,
        mentions
      })
    });

    // 3) optional schedule
    if (schedule && startAt) {
      await fetch(`/api/meetings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: `Meeting: ${content.slice(0, 80) || "Route meeting"}`,
          startAt,
          targetId,
          routeId,
          routeStopId: stopId,
          location: route.stops.find((s) => s.id === stopId)?.target?.addressRaw ?? ""
        })
      });
    }

    setContent("");
    setTags([]);
    setSchedule(false);
    setStartAt("");
    toast.success("Outcome and note saved");
    await load();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* left: composer */}
      <div className="col-span-1 space-y-3">
        <h3 className="font-semibold">Log outcome / note</h3>
        <div className="space-y-2 p-3 rounded border">
          <label className="text-sm">Stop</label>
          <select className="border rounded px-2 py-1 w-full" value={stopId || ""} onChange={(e) => onSelectStop(e.target.value)}>
            {(route.stops || []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.seq}. {s.target.company}
              </option>
            ))}
          </select>

          <label className="text-sm">Outcome</label>
          <select className="border rounded px-2 py-1 w-full" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            <option value="VISITED">Visited</option>
            <option value="NO_ANSWER">No Answer</option>
            <option value="WRONG_ADDRESS">Wrong Address</option>
            <option value="FOLLOW_UP">Follow-Up</option>
          </select>

          <label className="text-sm">Note</label>
          <textarea
            className="w-full border rounded p-2 min-h-[120px]"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type. Company names auto-link. Add free tags with commas."
          />

          <label className="text-sm">Tags (comma separated)</label>
          <input
            className="border rounded px-2 py-1 w-full"
            value={tags.join(", ")}
            onChange={(e) => setTags(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
          />

          <div className="flex items-center gap-2">
            <input id="sch" type="checkbox" checked={schedule} onChange={(e) => setSchedule(e.target.checked)} />
            <label htmlFor="sch">Also schedule a meeting</label>
            {schedule && (
              <input
                type="datetime-local"
                className="border rounded px-2 py-1"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={submit} className="px-3 py-1 rounded bg-blue-600 text-white">
              Save
            </button>
            {schedule && (
              <a
                className="px-3 py-1 rounded border"
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  alert("Meeting will appear after save; ICS link in detail view.");
                }}
              >
                Create ICS
              </a>
            )}
          </div>
        </div>
      </div>

      {/* right: timeline */}
      <div className="col-span-2 space-y-3">
        <h3 className="font-semibold">Route Notes</h3>
        <div className="space-y-3">
          {notes.length === 0 && <div className="text-sm text-muted-foreground">No notes yet.</div>}
          {notes.map((n) => {
            const stop = route.stops.find((s) => s.id === n.routeStopId);
            const html = linkifyCompanies(
              n.content,
              (route.stops || []).map((s) => ({
                id: s.target.id,
                name: s.target.company,
                slug: s.target.company.toLowerCase().replace(/\s+/g, "-")
              }))
            );
            return (
              <div key={n.id} className="border rounded p-3">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <div>
                    Target:{" "}
                    {stop ? (
                      <Link className="underline" href={`/dashboard/companies/${stop.target.id}`}>
                        {stop.target.company}
                      </Link>
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                  <div>{new Date(n.createdAt).toLocaleString()}</div>
                </div>
                <div className="[&_a]:underline [&_a]:text-blue-600 mt-1" dangerouslySetInnerHTML={{ __html: html }} />
                {n.tags?.length > 0 && (
                  <div className="mt-2 flex gap-1 flex-wrap">
                    {n.tags.map((t) => (
                      <span key={t} className="text-[11px] border rounded px-2 py-0.5">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
