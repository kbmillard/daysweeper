import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const toNum = (n: any) => (Number.isFinite(Number(n)) ? Number(n) : null);
const d = (a: [number, number], b: [number, number]) => {
  const dx = a[0] - b[0], dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
};

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const route = await prisma.route.findUnique({
      where: { id: params.id },
      include: { stops: { orderBy: { seq: "asc" }, include: { target: true } } }
    });
    if (!route) return NextResponse.json({ error: "not found" }, { status: 404 });
    const pts = route.stops.map((s, i) => {
      const lat = toNum(s.target?.latitude), lon = toNum(s.target?.longitude);
      if (lat == null || lon == null) throw new Error("missing coords");
      return { idx: i, id: s.id, p: [lon, lat] as [number, number] };
    });
    let rem = [...pts];
    const out: any[] = [rem.shift()!];
    while (rem.length) {
      const last = out[out.length - 1].p;
      const k = rem.reduce((best, cur, idx) => {
        const dist = d(last, cur.p);
        return dist < best.dist ? { idx, dist } : best;
      }, { idx: 0, dist: Infinity }).idx;
      out.push(rem.splice(k, 1)[0]);
    }
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < out.length; i++) {
        await tx.routeStop.update({ where: { id: out[i].id }, data: { seq: i + 1 } });
      }
    });
    return NextResponse.json({ ok: true, newOrder: out.map(o => o.id) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "nearest neighbor failed" }, { status: 500 });
  }
}
