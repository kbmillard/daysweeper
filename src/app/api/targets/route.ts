import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? undefined;
  const state = url.searchParams.get("state") ?? undefined;
  const tier = url.searchParams.get("tier") ?? undefined;
  const group = url.searchParams.get("group") ?? undefined;
  const subtype = url.searchParams.get("subtype") ?? undefined;

  const where: any = {};
  if (q) where.company = { contains: q, mode: "insensitive" };
  if (state) where.accountState = state;
  if (tier) where.supplyTier = tier;
  if (group) where.supplyGroup = group;
  if (subtype) where.supplySubtype = subtype;

  const rows = await prisma.target.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const data = {
      company: String(b.company ?? "").trim(),
      addressRaw: String(b.addressRaw ?? ""), // <= default so Prisma never gets null
      website: b.website ?? null,
      phone: b.phone ?? null,
      email: b.email ?? null,
      accountState: b.accountState ?? "NEW_UNCONTACTED",
      supplyTier: b.supplyTier ?? null,
      supplyGroup: b.supplyGroup ?? null,
      supplySubtype: b.supplySubtype ?? null,
    };
    if (!data.company) {
      return NextResponse.json({ error: "company is required" }, { status: 400 });
    }
    const created = await prisma.target.create({ data: data as any });
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Create failed" }, { status: 500 });
  }
}
