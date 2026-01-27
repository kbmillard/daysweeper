import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clerkClient } from "@clerk/nextjs/server";

function deriveName(u: any): string | null {
  const parts = [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim();
  return parts || u?.username || u?.emailAddresses?.[0]?.emailAddress || null;
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const assignedTo = u.searchParams.get("assignedTo");

  const where: any = {};
  if (assignedTo === "unassigned" || assignedTo === "") {
    where.assignedToUserId = null;
  } else if (assignedTo) {
    where.assignedToUserId = assignedTo;
  }

  const routes = await prisma.route.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    orderBy: { created: "desc" },
    include: { _count: { select: { stops: true } } },
  });

  return NextResponse.json(routes);
}

export async function POST(req: Request) {
  try {
    const b = await req.json();
    let name: string | null = null;
    let email: string | null = null;
    let ext: string | null = null;

    if (b.assignedToUserId) {
      try {
        const client = await clerkClient();
        const u = await client.users.getUser(b.assignedToUserId);
        name = deriveName(u);
        email = u?.emailAddresses?.[0]?.emailAddress ?? null;
        const g = (u?.externalAccounts ?? []).find((ea: any) =>
          ea.provider === "google" || ea.provider === "oauth_google"
        );
        ext = g?.externalId ?? null;
      } catch {}
    }

    const created = await prisma.route.create({
      data: {
        name: String(b.name ?? "").trim(),
        assignedToUserId: b.assignedToUserId ?? null,
        assignedToName: name,
        assignedToEmail: email,
        assignedToExternalId: ext,
        scheduledFor: b.scheduledFor ? new Date(b.scheduledFor) : null,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Create failed" }, { status: 500 });
  }
}
