"use client";
import * as React from "react";

type Item = { id: string; partNumber: string; description?: string | null; bin?: string | null; quantity: number; price?: number | string | null };

export default function InventoryPage() {
  const [q, setQ] = React.useState("");
  const [rows, setRows] = React.useState<Item[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [take, setTake] = React.useState(50);
  const [file, setFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);

  const load = async (p = page) => {
    const r = await fetch(`/api/inventory?q=${encodeURIComponent(q)}&page=${p}&take=${take}`).then((r) => r.json());
    setRows(r.items || []);
    setTotal(r.total || 0);
  };
  React.useEffect(() => {
    load(1);
  }, []);

  const onImport = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/inventory/import", { method: "POST", body: fd });
      const data = await r.json();
      setUploading(false);
      if (r.ok) {
        await load(1);
        setFile(null);
        // Reset file input
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) fileInput.value = "";
        alert(`Successfully imported ${data.count || 0} items`);
      } else {
        alert(`Import failed: ${data.error || "Unknown error"}`);
      }
    } catch (e: any) {
      setUploading(false);
      alert(`Import failed: ${e.message || "Network error"}`);
    }
  };

  const updateCell = async (id: string, patch: Partial<{ description?: string | null; bin?: string | null; quantity?: number; price?: number | null }>) => {
    const r = await fetch(`/api/inventory/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch)
    });
    if (r.ok) await load();
  };

  const importBinsXls = async () => {
    setUploading(true);
    try {
      const r = await fetch("/api/inventory/import-bins", { method: "POST" });
      const data = await r.json();
      
      if (r.ok) {
        await load(1);
        alert(`Successfully imported ${data.count || 0} items from bins.xls`);
      } else {
        alert(`Import failed: ${data.error || "Unknown error"}`);
      }
    } catch (e: any) {
      alert(`Import failed: ${e.message || "Network error"}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Inventory (Warehouse)</h1>
        <div className="flex gap-2 items-center">
          <button
            className="border rounded px-3 py-1 bg-green-600 text-white disabled:opacity-50"
            disabled={uploading}
            onClick={importBinsXls}
            title="Import bins.xls from project root"
          >
            {uploading ? "Importing…" : "Import bins.xls"}
          </button>
          <input
            className="border rounded px-2 py-1"
            placeholder="Search part/desc/bin"
            value={q}
            onChange={(e) => setTimeout(() => setQ(e.target.value), 0)}
            onKeyDown={(e) => e.key === "Enter" && load(1)}
          />
          <button className="border rounded px-3 py-1" onClick={() => load(1)}>
            Search
          </button>
          <input 
            type="file" 
            accept=".xls,.xlsx,.csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)} 
          />
          {file && (
            <span className="text-xs text-muted-foreground">
              {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </span>
          )}
          <button
            className="border rounded px-3 py-1 bg-blue-600 text-white disabled:opacity-50"
            disabled={!file || uploading}
            onClick={onImport}
          >
            {uploading ? "Uploading…" : "Import CSV/XLS/XLSX"}
          </button>
        </div>
      </div>

      <div className="rounded border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="p-2 text-left">Part #</th>
              <th className="p-2 text-left">Description</th>
              <th className="p-2 text-left">Bin</th>
              <th className="p-2 text-right">Qty</th>
              <th className="p-2 text-right">Price</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2 font-mono">{r.partNumber}</td>
                <td className="p-2">
                  <InlineEdit value={r.description || ""} onSave={(v) => updateCell(r.id, { description: v })} />
                </td>
                <td className="p-2">
                  <InlineEdit value={r.bin || ""} onSave={(v) => updateCell(r.id, { bin: v })} />
                </td>
                <td className="p-2 text-right">
                  <InlineEdit value={String(r.quantity)} onSave={(v) => updateCell(r.id, { quantity: Number(v) || 0 })} />
                </td>
                <td className="p-2 text-right">
                  <InlineEdit
                    value={r.price != null ? String(r.price) : ""}
                    onSave={(v) => updateCell(r.id, { price: v ? Number(v) : null })}
                  />
                </td>
                <td className="p-2 text-right">
                  <button
                    className="text-red-600"
                    onClick={async () => {
                      await fetch(`/api/inventory/${r.id}`, { method: "DELETE" });
                      load();
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="p-4 text-sm text-muted-foreground" colSpan={6}>
                  No items
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <div>{total} total</div>
        <div className="flex items-center gap-2">
          <button
            className="border rounded px-2 py-1"
            onClick={() => {
              if (page > 1) {
                setPage((p) => p - 1);
                load(page - 1);
              }
            }}
            disabled={page <= 1}
          >
            Prev
          </button>
          <div>Page {page}</div>
          <button
            className="border rounded px-2 py-1"
            onClick={() => {
              if (page * take < total) {
                setPage((p) => p + 1);
                load(page + 1);
              }
            }}
            disabled={page * take >= total}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function InlineEdit({ value, onSave }: { value: string; onSave: (v: string) => Promise<void> | void }) {
  const [v, setV] = React.useState(value);
  const [editing, setE] = React.useState(false);
  return (
    <div
      onBlur={() => {
        if (editing) {
          setE(false);
          if (v !== value) onSave(v);
        }
      }}
      onDoubleClick={() => setE(true)}
    >
      {editing ? (
        <input className="border rounded px-1 py-0.5 w-full" autoFocus value={v} onChange={(e) => setV(e.target.value)} />
      ) : (
        <span className="cursor-text">{value || <span className="text-muted-foreground">—</span>}</span>
      )}
    </div>
  );
}
