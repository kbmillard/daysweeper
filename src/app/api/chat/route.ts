import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// OPENAI default; set OPENAI_API_KEY in env
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(req: Request) {
  const { messages, targetId, routeId } = await req.json();

  let context = "";
  if (targetId) {
    const t = await prisma.target.findUnique({
      where: { id: String(targetId) },
      include: { TargetNote: { orderBy: { createdAt: "desc" }, take: 10 } },
    });
    if (t) {
      const noteText = t.TargetNote.map((n) => `- ${n.content} [tags: ${(n.tags || []).join(", ")}]`).join("\n");
      context += `Company: ${t.company}\nAddress: ${t.addressRaw}\nAccountState: ${t.accountState}\nNotes:\n${noteText}\n`;
    }
  }
  if (routeId) {
    const r = await prisma.route.findUnique({
      where: { id: String(routeId) },
      include: { stops: { orderBy: { seq: "asc" }, include: { target: true } } },
    });
    if (r) {
      const stops = r.stops.map((s) => `${s.seq}. ${s.target.company} (${s.target.addressRaw || ""})`).join("\n");
      context += `\nRoute: ${r.name}\nAssignedTo: ${r.assignedToUserId || "-"}\nDate: ${r.scheduledFor || "-"}\nStops:\n${stops}\n`;
    }
  }

  const sys = {
    role: "system",
    content:
      "You are Daysweeper's sales assistant. Use the provided context (companies, routes, notes) to answer briefly and practically. Suggest next best actions.",
  };
  const ctx = context ? [{ role: "system", content: `CONTEXT:\n${context}` }] : [];
  const payload = {
    model: "gpt-4o-mini",
    messages: [sys, ...ctx, ...messages],
    temperature: 0.3,
  };

  if (!OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 500 });
  }

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    return NextResponse.json({ error: t || "chat failed" }, { status: 502 });
  }
  const j = await r.json();
  return NextResponse.json({ reply: j.choices?.[0]?.message?.content ?? "" });
}
