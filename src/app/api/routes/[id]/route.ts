import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clerkClient } from "@clerk/nextjs/server";

function deriveName(u: any): string | null {
  const parts = [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim();
  return parts || u?.username || u?.emailAddresses?.[0]?.emailAddress || null;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const route = await prisma.route.findUnique({
    where: { id: params.id },
    include: {
      stops: {
        orderBy: { seq: "asc" },
        include: { target: { select: { id: true, company: true, addressRaw: true, latitude: true, longitude: true } } }
      }
    }
  });
  if (!route) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(route);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const b = await req.json();
    const data: any = {};
    if (b.name !== undefined) data.name = String(b.name).trim();
    if (b.scheduledFor !== undefined) data.scheduledFor = b.scheduledFor ? new Date(b.scheduledFor) : null;

    if ("assignedToUserId" in b) {
      const id: string | null = b.assignedToUserId ?? null;
      data.assignedToUserId = id;
      if (id) {
        try {
          const client = await clerkClient();
          const u = await client.users.getUser(id);
          data.assignedToName = deriveName(u);
          data.assignedToEmail = u?.emailAddresses?.[0]?.emailAddress ?? null;
          const g = (u?.externalAccounts ?? []).find((ea: any) =>
            ea.provider === "google" || ea.provider === "oauth_google"
          );
          data.assignedToExternalId = g?.externalId ?? null;
        } catch {
          data.assignedToName = null;
          data.assignedToEmail = null;
          data.assignedToExternalId = null;
        }
      } else {
        data.assignedToName = null;
        data.assignedToEmail = null;
        data.assignedToExternalId = null;
      }
    }

    const updated = await prisma.route.update({ where: { id: params.id }, data });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Update failed" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    await prisma.route.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Delete failed" }, { status: 500 });
  }
}
