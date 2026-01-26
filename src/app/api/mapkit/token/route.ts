import { NextResponse } from "next/server";

export async function GET() {
  // Apple MapKit integration disabled - not configured
  return NextResponse.json({ error: "Apple MapKit not configured" }, { status: 501 });
}
