import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const b = await req.json();
    const existing = await prisma.target.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const patch: any = {};
    if (!existing.website && b.website) patch.website = b.website;
    if (!existing.phone && b.phone) patch.phone = b.phone;
    if (!existing.email && b.email) patch.email = b.email;
    if (!existing.addressRaw && b.addressRaw !== undefined) patch.addressRaw = String(b.addressRaw);
    if (!existing.supplyTier && b.supplyTier) patch.supplyTier = b.supplyTier;
    if (!existing.supplyGroup && b.supplyGroup) patch.supplyGroup = b.supplyGroup;
    if (!existing.supplySubtype && b.supplySubtype) patch.supplySubtype = b.supplySubtype;

    if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true, message: "Nothing to merge" });
    const updated = await prisma.target.update({ where: { id }, data: patch });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Merge failed" }, { status: 500 });
  }
}
