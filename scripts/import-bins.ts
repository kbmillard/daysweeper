// Load environment variables FIRST, before any imports
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

// Now import everything else
import { prisma } from "../src/lib/prisma";
import * as XLSX from "xlsx";
import * as fs from "fs";

async function importBins() {
  try {
    const filePath = path.join(process.cwd(), "bins.xls");
    console.log(`Reading file: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }

    const buf = fs.readFileSync(filePath);
    const wb = XLSX.read(buf, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

    console.log(`Found ${rows.length} rows in file`);

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

    console.log("Detected headers:", headers);

    const upserts = rows
      .map((r, idx) => {
        const pn = String(r[headers.partNumber] || "").trim();
        if (!pn) {
          console.log(`Skipping row ${idx + 1}: no part number`);
          return null;
        }
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

    console.log(`Importing ${upserts.length} items...`);
    await prisma.$transaction(upserts);
    console.log(`✅ Successfully imported ${upserts.length} items!`);
  } catch (e: any) {
    console.error("Import failed:", e.message);
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

importBins();
