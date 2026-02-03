import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await _req.json().catch(() => ({}));

    const update: {
      partNumber?: string;
      description?: string | null;
      bin?: string | null;
      quantity?: number;
      price?: number | null;
      meta?: unknown;
    } = {};
    if (body.partNumber !== undefined) update.partNumber = String(body.partNumber).trim();
    if (body.description !== undefined) update.description = body.description == null ? null : String(body.description);
    if (body.bin !== undefined) update.bin = body.bin == null ? null : String(body.bin);
    if (body.quantity !== undefined) update.quantity = Number(body.quantity) || 0;
    if (body.price !== undefined) update.price = body.price == null || body.price === "" ? null : Number(body.price);
    if (body.meta !== undefined) update.meta = body.meta;

    const item = await prisma.warehouseItem.update({
      where: { id },
      data: update as Prisma.WarehouseItemUpdateInput,
    });

    return NextResponse.json({
      ...item,
      price: item.price ? Number(item.price) : null,
    });
  } catch (error: unknown) {
    console.error("Error updating bin:", error);
    const message = error instanceof Error ? error.message : "Failed to update bin";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
