import { NextResponse } from "next/server";
import { SignJWT, importPKCS8 } from "jose";

function readRequired(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} missing`);
  return v;
}

export async function GET() {
  try {
    const teamId = readRequired("APPLE_TEAM_ID");
    const keyId  = readRequired("APPLE_MAPKIT_KEY_ID");
    let pk = readRequired("APPLE_MAPKIT_PRIVATE_KEY");
    // Handle base64 or raw PEM
    if (!pk.includes("BEGIN PRIVATE KEY")) {
      // assume base64 without headers
      pk = Buffer.from(pk, "base64").toString("utf8");
    }
    const origin = process.env.NEXT_PUBLIC_MAPKIT_ORIGIN || "";
    const origins = origin.split(",").map(s => s.trim()).filter(Boolean);

    const alg = "ES256";
    const privateKey = await importPKCS8(pk, alg);
    const now = Math.floor(Date.now()/1000);
    const jwt = await new SignJWT({ origin: origins })
      .setProtectedHeader({ alg, kid: keyId, typ: "JWT" })
      .setIssuer(teamId)
      .setIssuedAt(now)
      .setExpirationTime(now + 30 * 60) // 30 minutes
      .sign(privateKey);

    // MapKit expects raw token text
    return new Response(jwt, { headers: { "content-type": "text/plain" } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "token error" }, { status: 500 });
  }
}
