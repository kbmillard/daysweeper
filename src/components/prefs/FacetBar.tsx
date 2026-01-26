"use client";
import * as React from "react";
import { CAPABILITY_PRESETS, slug } from "@/taxonomy/capabilities";

export default function FacetBar() {
  const [sel, setSel] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/user/prefs").then(r => r.json()).then(p => setSel(p.capabilityTags || []));
  }, []);

  const toggle = (label: string) => {
    const s = slug(label);
    setSel(prev => {
      const newSel = prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s];
      // live event for pages to filter
      setTimeout(() => window.dispatchEvent(new CustomEvent("prefs:capabilities", { detail: { value: newSel } })), 0);
      return newSel;
    });
  };

  const save = async () => {
    setSaving(true);
    const p = await fetch("/api/user/prefs", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ capabilityTags: sel }) }).then(r => r.json());
    setSaving(false);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {Object.values(CAPABILITY_PRESETS).flat().map(label => {
        const s = slug(label);
        const on = sel.includes(s);
        return (
          <button key={s}
            onClick={() => toggle(label)}
            className={`text-xs rounded-full px-3 py-1 border ${on ? "bg-blue-600 text-white" : ""}`}
          >{label}</button>
        );
      })}
      <button onClick={save} className="text-xs border rounded-full px-3 py-1">{saving ? "Saving…" : "Save"}</button>
    </div>
  );
}
