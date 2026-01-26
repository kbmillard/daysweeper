import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const KEY = "capability_presets";

export async function GET() {
  const row = await prisma.metaKV.findUnique({ where: { key: KEY } });
  return NextResponse.json(row?.value ?? { manufacturing: [], logisticsOps: [], packagingLifecycle: [], relationshipTags: [] });
}

export async function PUT(req: Request) {
  try {
    const payload = await req.json(); // shape: { manufacturing:[], logisticsOps:[], packagingLifecycle:[], relationshipTags:[] }
    const upsert = await prisma.metaKV.upsert({
      where: { key: KEY },
      update: { value: payload },
      create: { key: KEY, value: payload }
    });
    return NextResponse.json(upsert.value);
  } catch (e:any) {
    return NextResponse.json({ error: e.message ?? "save failed" }, { status: 500 });
  }
}
