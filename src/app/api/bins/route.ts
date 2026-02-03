import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const items = await prisma.warehouseItem.findMany({
      orderBy: { updatedAt: "desc" },
      take: 2000,
    });

    const withNumbers = items.map((item) => ({
      ...item,
      price: item.price ? Number(item.price) : null,
    }));

    return NextResponse.json(withNumbers);
  } catch (error: unknown) {
    console.error("Error fetching bins:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch bins";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
