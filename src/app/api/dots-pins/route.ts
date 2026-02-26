import AdmZip from 'adm-zip';
import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function coordKey(lat: number, lng: number) {
  return `${Number(lng.toFixed(5))},${Number(lat.toFixed(5))}`;
}

export type RedPin = { lng: number; lat: number; id?: string; source: 'kml' | 'user' };

/**
 * GET - Red pins: KML dots (minus hidden) + user-dropped MapPins. Each pin has source and optional id for delete.
 * If MapPin/HiddenDot tables are missing, falls back to KML-only so red pins still show.
 */
export async function GET() {
  try {
    let hiddenSet = new Set<string>();
    try {
      const hidden = await prisma.hiddenDot.findMany({ select: { latitude: true, longitude: true } });
      hiddenSet = new Set(hidden.map((h) => coordKey(Number(h.latitude), Number(h.longitude))));
    } catch {
      // tables may not exist yet; use no hidden dots
    }

    let kmlPins: Array<{ lng: number; lat: number }> = [];
    const kmzPath = path.join(process.cwd(), 'JSON', 'round2', 'Dots.kmz');
    if (fs.existsSync(kmzPath)) {
      const buffer = fs.readFileSync(kmzPath);
      const zip = new AdmZip(buffer);
      const entries = zip.getEntries();
      const kmlEntry = entries.find((e) => e.entryName.endsWith('.kml') && !e.isDirectory);
      if (kmlEntry) {
        const kmlContent = kmlEntry.getData().toString('utf-8');
        const placemarkRegex = /<Placemark[^>]*>([\s\S]*?)<\/Placemark>/gi;
        const seen = new Set<string>();
        let pm: RegExpExecArray | null;
        while ((pm = placemarkRegex.exec(kmlContent)) !== null) {
          const block = pm[1];
          if (/<visibility>\s*0\s*<\/visibility>/i.test(block)) continue;
          const coordMatch = /<coordinates>\s*([^<]+)<\/coordinates>/i.exec(block);
          if (!coordMatch) continue;
          const parts = coordMatch[1].trim().split(/[\s,]+/);
          const lng = parseFloat(parts[0]);
          const lat = parseFloat(parts[1]);
          if (Number.isNaN(lng) || Number.isNaN(lat)) continue;
          if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
          const key = coordKey(lat, lng);
          if (seen.has(key)) continue;
          seen.add(key);
          kmlPins.push({ lng, lat });
        }
      }
    }
    const MAX_KML = 1600;
    const filteredKml: RedPin[] = kmlPins
      .slice(0, MAX_KML)
      .filter((p) => !hiddenSet.has(coordKey(p.lat, p.lng)))
      .map((p) => ({ ...p, source: 'kml' as const }));

    let userPinsList: RedPin[] = [];
    try {
      const userPins = await prisma.mapPin.findMany({
        where: { hidden: false },
        select: { id: true, latitude: true, longitude: true }
      });
      userPinsList = userPins.map((p) => ({
        lng: Number(p.longitude),
        lat: Number(p.latitude),
        id: p.id,
        source: 'user' as const
      }));
    } catch {
      // MapPin table may not exist yet; return only KML pins
    }

    const pins: RedPin[] = [...filteredKml, ...userPinsList];

    return NextResponse.json(
      { pins },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e) {
    return NextResponse.json(
      { pins: [], error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    );
  }
}
