import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 });
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" }); // reads xls/xlsx/csv

    // auto-detect column names (part number, description, bin, qty, price)
    const headers = Object.keys(rows[0] || {}).reduce(
      (acc: Record<string, string>, k) => {
        const lk = k.toLowerCase();
        if (lk.includes("part") && lk.includes("num")) acc.partNumber = k;
        if (lk.includes("desc")) acc.description = k;
        if (lk.includes("bin")) acc.bin = k;
        if (lk.includes("qty") || lk.includes("quantity")) acc.quantity = k;
        if (lk.includes("price") || lk.includes("cost")) acc.price = k;
        return acc;
      },
      {} as Record<string, string>
    );

    const upserts = rows
      .map((r) => {
        const pn = String(r[headers.partNumber] || "").trim();
        if (!pn) return null;
        const data: any = {
          partNumber: pn,
          description: (r[headers.description] ?? "").toString().slice(0, 512) || null,
          bin: (r[headers.bin] ?? "").toString().slice(0, 64) || null,
          quantity: Number.isFinite(Number(r[headers.quantity])) ? Number(r[headers.quantity]) : 0,
          price: r[headers.price] ? Number(r[headers.price]) : null
        };
        return prisma.warehouseItem.upsert({
          where: { partNumber: pn },
          update: data,
          create: data
        });
      })
      .filter(Boolean) as any[];

    await prisma.$transaction(upserts);
    return NextResponse.json({ ok: true, count: upserts.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "import failed" }, { status: 500 });
  }
}
