import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Hard-delete all app data (keep migrations). Requires header X-Confirm: PURGE.
export async function POST(req: Request) {
  const confirm = req.headers.get("x-confirm");
  if (confirm !== "PURGE") {
    return NextResponse.json({ error: "Missing or invalid X-Confirm header" }, { status: 400 });
  }
  // If you need auth, wrap with Clerk auth() role check here.
  await prisma.$transaction([
    prisma.warehouseItem.deleteMany({}),
    prisma.meeting.deleteMany({}),
    prisma.targetNote.deleteMany({}),
    prisma.routeStop.deleteMany({}),
    prisma.route.deleteMany({}),
    prisma.target.deleteMany({}),
  ]);
  return NextResponse.json({ ok: true, purged: true });
}
