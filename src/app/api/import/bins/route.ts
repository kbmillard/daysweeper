import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

// Accepts CSV file or JSON array of warehouse items
// Expected fields: partNumber, description, bin, quantity, price

type BinRow = {
  partNumber: string;
  description?: string | null;
  bin?: string | null;
  quantity?: number | null;
  price?: number | null;
  meta?: any;
};

export const runtime = "nodejs";

// Helper to parse CSV text
function parseCSV(csvText: string): BinRow[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  // Parse header
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  
  // Find column indices
  const partNumberIdx = headers.findIndex(h => 
    /part.?number|partnum|part#|sku/i.test(h)
  );
  const descriptionIdx = headers.findIndex(h => 
    /description|desc/i.test(h)
  );
  const binIdx = headers.findIndex(h => 
    /bin|location|warehouse/i.test(h)
  );
  const quantityIdx = headers.findIndex(h => 
    /quantity|qty|amount|stock/i.test(h)
  );
  const priceIdx = headers.findIndex(h => 
    /price|cost/i.test(h)
  );

  if (partNumberIdx === -1) {
    throw new Error('CSV must have a part number column (partNumber, partnum, part#, or sku)');
  }

  // Parse rows
  const rows: BinRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    if (values[partNumberIdx]?.trim()) {
      rows.push({
        partNumber: values[partNumberIdx].trim(),
        description: descriptionIdx >= 0 ? values[descriptionIdx] || null : null,
        bin: binIdx >= 0 ? values[binIdx] || null : null,
        quantity: quantityIdx >= 0 ? parseInt(values[quantityIdx] || '0', 10) || 0 : 0,
        price: priceIdx >= 0 ? parseFloat(values[priceIdx] || '0') || null : null,
      });
    }
  }

  return rows;
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") || "";
    
    let rows: BinRow[] = [];

    if (contentType.includes("text/csv") || contentType.includes("application/vnd.ms-excel")) {
      // Handle CSV file upload
      const formData = await req.formData();
      const file = formData.get("file") as File;
      
      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }

      const csvText = await file.text();
      rows = parseCSV(csvText);
    } else {
      // Handle JSON
      const body = await req.json().catch(() => null);
      rows = Array.isArray(body) 
        ? body 
        : Array.isArray(body?.items) 
          ? body.items 
          : [];
    }

    if (!rows.length) {
      return NextResponse.json(
        { error: "Provide CSV file or JSON array of items" },
        { status: 400 }
      );
    }

    let upserted = 0;
    const CHUNK = 250;

    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK).filter(r => 
        (r.partNumber || "").trim().length > 0
      );

      const tx = slice.map((r) => {
        const partNumber = String(r.partNumber).trim();
        const now = new Date();
        
        return prisma.warehouseItem.upsert({
          where: { partNumber },
          create: {
            partNumber,
            description: r.description || null,
            bin: r.bin || null,
            quantity: r.quantity || 0,
            price: r.price !== null && r.price !== undefined ? r.price : null,
            meta: r.meta || null,
            createdAt: now,
            updatedAt: now,
          },
          update: {
            description: r.description !== undefined ? r.description : undefined,
            bin: r.bin !== undefined ? r.bin : undefined,
            quantity: r.quantity !== undefined ? r.quantity : undefined,
            price: r.price !== undefined ? (r.price !== null ? r.price : null) : undefined,
            meta: r.meta !== undefined ? r.meta : undefined,
            updatedAt: now,
          },
        });
      });

      await prisma.$transaction(tx);
      upserted += slice.length;
    }

    return NextResponse.json({
      ok: true,
      upserted,
      message: `Successfully imported ${upserted} warehouse items`,
    });
  } catch (error: any) {
    console.error("Error importing bins:", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to import bins" },
      { status: 500 }
    );
  }
}
