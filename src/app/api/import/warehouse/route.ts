import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split("\n").filter((line) => line.trim());
    if (lines.length < 2) {
      return NextResponse.json({ error: "CSV must have header and at least one row" }, { status: 400 });
    }

    // Parse CSV (handle quoted values and commas)
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim().replace(/"/g, ""));
    const rows = lines.slice(1).map((line) => {
      const values = parseCSVLine(line);
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = (values[idx] || "").trim().replace(/^"|"$/g, "");
      });
      return row;
    });

    // Normalize column names (flexible matching)
    const normalizeKey = (key: string): string => {
      const lower = key.toLowerCase();
      if (lower.includes("part") || lower.includes("sku") || lower.includes("item")) return "partNumber";
      if (lower.includes("desc") || lower.includes("name") || lower.includes("title")) return "description";
      if (lower.includes("bin") || lower.includes("location") || lower.includes("shelf")) return "bin";
      if (lower.includes("qty") || lower.includes("quantity") || lower.includes("stock") || lower.includes("count")) return "quantity";
      if (lower.includes("price") || lower.includes("cost") || lower.includes("amount")) return "price";
      return key;
    };

    const normalizedRows = rows.map((row) => {
      const normalized: Record<string, any> = {};
      Object.keys(row).forEach((key) => {
        const normalizedKey = normalizeKey(key);
        normalized[normalizedKey] = row[key];
      });
      return normalized;
    });

    // Process rows - upsert by partNumber
    const items = normalizedRows
      .filter((r) => r.partNumber && String(r.partNumber).trim())
      .map((r) => {
        const partNumber = String(r.partNumber).trim();
        const description = r.description ? String(r.description).trim() : null;
        const bin = r.bin ? String(r.bin).trim() : null;
        const quantity = r.quantity ? parseInt(String(r.quantity).replace(/[^0-9-]/g, ""), 10) || 0 : 0;
        // Parse price and ensure it's a valid decimal (max 12 digits, 2 decimal places)
        let price: number | null = null;
        if (r.price) {
          const parsed = parseFloat(String(r.price).replace(/[^0-9.-]/g, ""));
          if (!isNaN(parsed) && isFinite(parsed)) {
            // Round to 2 decimal places and ensure it fits in Decimal(12,2)
            price = Math.round(parsed * 100) / 100;
            if (Math.abs(price) > 9999999999.99) {
              price = null; // Too large for Decimal(12,2)
            }
          }
        }
        
        // Store all other columns in meta
        const meta: Record<string, any> = {};
        Object.keys(r).forEach((key) => {
          if (!["partNumber", "description", "bin", "quantity", "price"].includes(key)) {
            meta[key] = r[key];
          }
        });

        return {
          partNumber,
          description,
          bin,
          quantity,
          price: price != null ? price : null,
          meta: Object.keys(meta).length > 0 ? meta : null,
        };
      });

    if (items.length === 0) {
      return NextResponse.json({ error: "No valid rows with partNumber found" }, { status: 400 });
    }

    // Upsert by partNumber (unique constraint)
    const results = await prisma.$transaction(
      items.map((item) =>
        prisma.warehouseItem.upsert({
          where: { partNumber: item.partNumber },
          update: {
            description: item.description ?? undefined,
            bin: item.bin ?? undefined,
            quantity: item.quantity,
            price: item.price != null ? item.price : undefined,
            meta: item.meta ?? undefined,
            updatedAt: new Date(),
          },
          create: {
            partNumber: item.partNumber,
            description: item.description,
            bin: item.bin,
            quantity: item.quantity,
            price: item.price,
            meta: item.meta,
          } as any,
        })
      )
    );

    return NextResponse.json({
      ok: true,
      processed: items.length,
      created: results.length,
      message: `Processed ${items.length} items (upserted by partNumber)`,
    });
  } catch (e: any) {
    console.error("Warehouse import error:", e);
    return NextResponse.json({ error: e?.message ?? "Import failed" }, { status: 500 });
  }
}
