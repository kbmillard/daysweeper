import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const q = u.searchParams.get("q")?.trim();
  const page = Number(u.searchParams.get("page") ?? 1);
  const take = Number(u.searchParams.get("take") ?? 50);
  const where: any = q
    ? {
        OR: [
          { partNumber: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { bin: { contains: q, mode: "insensitive" } }
        ]
      }
    : {};
  const [items, count] = await Promise.all([
    prisma.warehouseItem.findMany({
      where,
      orderBy: { partNumber: "asc" },
      skip: (page - 1) * take,
      take
    }),
    prisma.warehouseItem.count({ where })
  ]);
  return NextResponse.json({ items, total: count });
}

export async function POST(req: Request) {
  try {
    const b = await req.json(); // { partNumber, description?, bin?, quantity?, price? }
    if (!b.partNumber) return NextResponse.json({ error: "partNumber required" }, { status: 400 });
    const item = await prisma.warehouseItem.upsert({
      where: { partNumber: String(b.partNumber) },
      update: {
        description: b.description ?? undefined,
        bin: b.bin ?? undefined,
        quantity: b.quantity ?? undefined,
        price: b.price ?? undefined,
        meta: b.meta ?? undefined
      },
      create: {
        partNumber: String(b.partNumber),
        description: b.description ?? null,
        bin: b.bin ?? null,
        quantity: Number.isFinite(b.quantity) ? b.quantity : 0,
        price: b.price ?? null,
        meta: b.meta ?? null
      }
    });
    return NextResponse.json(item, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "save failed" }, { status: 500 });
  }
}
