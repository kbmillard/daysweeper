"use client";
import * as React from "react";

type Presets = {
  manufacturing: string[];
  logisticsOps: string[];
  packagingLifecycle: string[];
  relationshipTags: string[];
};

const groups: (keyof Presets)[] = ["manufacturing","logisticsOps","packagingLifecycle","relationshipTags"];

export default function PresetsAdmin({ initial }: { initial: Presets }) {
  const [data, setData] = React.useState<Presets>(initial);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  const add = (g: keyof Presets, v: string) => {
    const s = v.trim(); if (!s) return;
    setData(prev => ({ ...prev, [g]: Array.from(new Set([...(prev[g]||[]), s])) }));
  };
  const del = (g: keyof Presets, v: string) => {
    setData(prev => ({ ...prev, [g]: (prev[g]||[]).filter(x => x !== v) }));
  };
  const save = async () => {
    try {
      setSaving(true); setMsg(null);
      const r = await fetch("/api/presets/capabilities", { method: "PUT", headers: { "content-type":"application/json" }, body: JSON.stringify(data) });
      if (!r.ok) throw new Error(await r.text());
      setMsg("Saved");
    } catch (e) {
      setMsg("Error");
    } finally {
      setSaving(false);
      setTimeout(()=> setMsg(null), 1200);
    }
  };

  return (
    <div className="space-y-6">
      {groups.map((g) => (<Group key={g} label={g} values={data[g] ?? []} onAdd={(v)=>add(g,v)} onDel={(v)=>del(g,v)} />))}
      <button onClick={save} className="border rounded px-3 py-1 text-sm bg-blue-600 text-white" disabled={saving}>
        {saving ? "Saving…" : "Save presets"}
      </button>
      {msg && <span className={`text-xs ${msg==="Saved" ? "text-green-600" : "text-red-600"}`}>{msg}</span>}
    </div>
  );
}

function Group({ label, values, onAdd, onDel }:{ label: string; values: string[]; onAdd:(v:string)=>void; onDel:(v:string)=>void }) {
  const [input, setInput] = React.useState("");
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{label}</div>
      <div className="flex gap-2">
        <input value={input} onChange={e=>setInput(e.target.value)} placeholder={`Add to ${label}`} className="border rounded px-2 py-1 w-80" />
        <button onClick={()=> { onAdd(input); setInput(""); }} className="border rounded px-3 py-1 text-sm">Add</button>
      </div>
      <div className="flex flex-wrap gap-1">
        {(values||[]).map(v => (
          <span key={v} className="text-xs rounded px-2 py-1 border">
            {v} <button onClick={()=>onDel(v)} className="opacity-60">×</button>
          </span>
        ))}
      </div>
    </div>
  );
}
