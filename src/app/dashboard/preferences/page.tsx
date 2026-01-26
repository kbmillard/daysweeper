"use client";
import * as React from "react";
import FacetBar from "@/components/prefs/FacetBar";

export default function PreferencesPage() {
  const [prefs, setPrefs] = React.useState<any>(null);
  React.useEffect(() => { fetch("/api/user/prefs").then(r => r.json()).then(setPrefs); }, []);
  const [widgets, setWidgets] = React.useState<string[]>([]);

  React.useEffect(() => { if (prefs) setWidgets(prefs.widgets || []); }, [prefs]);

  const toggleWidget = (w: string) => {
    setWidgets(prev => prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w]);
  };
  const saveWidgets = async () => {
    await fetch("/api/user/prefs", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...(prefs || {}), widgets }) });
  };

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-lg font-semibold">Preferences</h1>
      <div>
        <div className="text-sm font-medium mb-2">Capability facets</div>
        <FacetBar />
      </div>
      <div>
        <div className="text-sm font-medium mb-2">Dashboard widgets</div>
        <div className="flex gap-2 flex-wrap">
          {["overviewCards", "upcomingMeetings", "recentNotes", "inventorySummary"].map(w => (
            <button key={w} onClick={() => toggleWidget(w)} className={`text-xs rounded-full px-3 py-1 border ${widgets.includes(w) ? "bg-blue-600 text-white" : ""}`}>{w}</button>
          ))}
          <button onClick={saveWidgets} className="text-xs border rounded-full px-3 py-1">Save</button>
        </div>
      </div>
    </div>
  );
}
