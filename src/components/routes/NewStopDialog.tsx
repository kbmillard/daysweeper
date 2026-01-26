"use client";
import * as React from "react";

export default function NewStopDialog({
  open, onClose, lat, lon, routeId
}: { open: boolean; onClose: () => void; lat: number; lon: number; routeId: string }) {
  const [company, setCompany] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-neutral-900 rounded shadow-xl w-full max-w-lg p-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold mb-2">New Company at pin</h3>
        <div className="space-y-2">
          <label className="text-sm">Company Name *</label>
          <input className="w-full border rounded px-2 py-1" value={company} onChange={e => setCompany(e.target.value)} placeholder="Acme Plastics" />

          <label className="text-sm">Address</label>
          <input className="w-full border rounded px-2 py-1" value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St, City, ST" />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm">Phone</label>
              <input className="w-full border rounded px-2 py-1" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="text-sm">Website</label>
              <input className="w-full border rounded px-2 py-1" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://…" />
            </div>
          </div>
        </div>
        {error && <div className="text-sm text-red-600 mt-2">{error}</div>}

        <div className="flex justify-end gap-2 mt-3">
          <button className="border rounded px-3 py-1" onClick={onClose}>Cancel</button>
          <button
            className="bg-blue-600 text-white rounded px-3 py-1"
            disabled={!company.trim() || saving}
            onClick={async () => {
              try {
                setSaving(true);
                setError(null);
                // 1) create target (no auto-populate)
                const created = await fetch("/api/targets", {
                  method: "POST", headers: { "content-type": "application/json" },
                  body: JSON.stringify({ company: company.trim(), addressRaw: address || "", phone: phone || null, website: website || null })
                }).then(r => r.json());
                if (!created?.id) throw new Error("Create failed");
                // 2) patch coords explicitly (no auto unless you want)
                await fetch(`/api/targets/${created.id}`, {
                  method: "PATCH", headers: { "content-type": "application/json" },
                  body: JSON.stringify({ latitude: String(lat), longitude: String(lon), addressNormalized: address || null, accuracy: "manual-pin", meta: { source: "web-pin" } })
                });
                // 3) append to route
                await fetch(`/api/routes/${routeId}/stops/append`, {
                  method: "POST", headers: { "content-type": "application/json" },
                  body: JSON.stringify({ targetId: created.id })
                });
                onClose();
                // let parent refresh list/map
                window.dispatchEvent(new CustomEvent("route:refresh"));
              } catch (e: any) {
                setError(e?.message || "Save failed");
              } finally { setSaving(false); }
            }}
          >Save & Add to Route</button>
        </div>
      </div>
    </div>
  );
}
