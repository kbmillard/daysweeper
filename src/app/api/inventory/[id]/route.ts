import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const row = await prisma.warehouseItem.findUnique({ where: { id: params.id } });
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const b = await req.json();
    const updated = await prisma.warehouseItem.update({
      where: { id: params.id },
      data: {
        description: b.description ?? undefined,
        bin: b.bin ?? undefined,
        quantity: b.quantity ?? undefined,
        price: b.price ?? undefined,
        meta: b.meta ?? undefined
      }
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "update failed" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await prisma.warehouseItem.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
