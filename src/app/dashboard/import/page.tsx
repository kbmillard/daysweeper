"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function ImportPage() {
  const [json, setJson] = React.useState("[]");
  const [result, setResult] = React.useState<string>("");

  const run = async () => {
    try {
      const parsed = JSON.parse(json);
      const r = await fetch("/api/import/targets", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(parsed),
      });
      const j = await r.json();
      setResult(JSON.stringify(j, null, 2));
    } catch (e: any) {
      setResult(String(e?.message || e));
    }
  };

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-lg font-semibold tracking-tight">Bulk Import (JSON)</h1>
      <p className="text-sm text-muted-foreground">Paste a JSON array of targets. Fields: company, addressRaw, website, phone, email, accountState, supplyTier, supplyGroup, supplySubtype.</p>
      <Textarea value={json} onChange={(e)=>setJson(e.target.value)} className="min-h-[240px]" />
      <Button onClick={run}>Import</Button>
      {result && <pre className="rounded border p-3 text-xs bg-card whitespace-pre-wrap">{result}</pre>}
    </div>
  );
}
