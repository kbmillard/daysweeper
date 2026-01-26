import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") || "").trim();
  const limit = Math.min(25, Number(u.searchParams.get("limit") || 10));

  const res = await clerkClient.users.getUserList({
    query: q,
    limit,
  });

  const items = res.data.map(u => ({
    id: u.id,
    name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || u.emailAddresses?.[0]?.emailAddress || "User",
    email: u.emailAddresses?.[0]?.emailAddress || "",
    imageUrl: u.imageUrl || null
  }));
  return NextResponse.json({ items });
}
