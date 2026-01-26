import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") || "").trim();
  const limit = Math.min(50, Number(u.searchParams.get("limit") || 10));
  if (q.length < 2) return NextResponse.json({ target: [], route: [], inventory: [] });

  const [target, route, inventory] = await Promise.all([
    prisma.target.findMany({
      where: { OR: [{ company: { contains: q, mode: "insensitive" } }, { addressRaw: { contains: q, mode: "insensitive" } }] },
      take: limit, select: { id: true, company: true, addressRaw: true }
    }),
    prisma.route.findMany({
      where: { OR: [{ name: { contains: q, mode: "insensitive" } }] },
      take: limit, select: { id: true, name: true, assignedToUserId: true }
    }),
    prisma.warehouseItem.findMany({
      where: { OR: [{ partNumber: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }, { bin: { contains: q, mode: "insensitive" } }] },
      take: limit, select: { id: true, partNumber: true, description: true, bin: true }
    })
  ]);

  return NextResponse.json({ target, route, inventory });
}
