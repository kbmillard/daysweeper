import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/suggested-stops
 * Returns combined red dots (KML + user MapPins) and blue company locations
 * for use by the LastLeg iOS app's "Suggest Stop" feature.
 *
 * Response:
 * {
 *   stops: Array<{
 *     lat: number,
 *     lng: number,
 *     type: 'prospect' | 'company',
 *     label: string,
 *     locationId?: string,
 *     companyId?: string,
 *     addressRaw?: string
 *   }>
 * }
 *
 * No auth required — same as /api/dots-pins and /api/locations/map.
 */

type SuggestedStop = {
  lat: number;
  lng: number;
  type: 'prospect' | 'company';
  label: string;
  locationId?: string;
  companyId?: string;
  addressRaw?: string;
};

function coordKey(lat: number, lng: number) {
  return `${Number(lng.toFixed(5))},${Number(lat.toFixed(5))}`;
}

export async function GET() {
  const stops: SuggestedStop[] = [];

  // --- Red dots: KML prospects ---
  try {
    let hiddenSet = new Set<string>();
    try {
      const hidden = await prisma.hiddenDot.findMany({
        select: { latitude: true, longitude: true }
      });
      hiddenSet = new Set(hidden.map((h) => coordKey(Number(h.latitude), Number(h.longitude))));
    } catch {
      // HiddenDot table may not exist
    }

    const kmzPath = path.join(process.cwd(), 'JSON', 'round2', 'Dots.kmz');
    if (fs.existsSync(kmzPath)) {
      const buffer = fs.readFileSync(kmzPath);
      const zip = new AdmZip(buffer);
      const kmlEntry = zip.getEntries().find((e) => e.entryName.endsWith('.kml') && !e.isDirectory);
      if (kmlEntry) {
        const kmlContent = kmlEntry.getData().toString('utf-8');
        const placemarkRegex = /<Placemark[^>]*>([\s\S]*?)<\/Placemark>/gi;
        const seen = new Set<string>();
        let pm: RegExpExecArray | null;
        let kmlCount = 0;
        const MAX_KML = 1600;
        while ((pm = placemarkRegex.exec(kmlContent)) !== null && kmlCount < MAX_KML) {
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
          if (seen.has(key) || hiddenSet.has(key)) continue;
          seen.add(key);
          kmlCount++;

          // Extract name if present
          const nameMatch = /<name>\s*([^<]+)<\/name>/i.exec(block);
          const label = nameMatch ? nameMatch[1].trim() : 'Prospect';

          stops.push({ lat, lng, type: 'prospect', label });
        }
      }
    }

    // User-dropped MapPins
    try {
      const userPins = await prisma.mapPin.findMany({
        where: { hidden: false },
        select: { id: true, latitude: true, longitude: true }
      });
      for (const p of userPins) {
        stops.push({
          lat: Number(p.latitude),
          lng: Number(p.longitude),
          type: 'prospect',
          label: 'Prospect'
        });
      }
    } catch {
      // MapPin table may not exist
    }
  } catch {
    // KML parsing failed — continue with company pins
  }

  // --- Blue dots: geocoded company locations ---
  try {
    const locations = await prisma.location.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
        Company: { hidden: false }
      },
      select: {
        id: true,
        companyId: true,
        addressRaw: true,
        latitude: true,
        longitude: true,
        Company: { select: { name: true } }
      },
      take: 2000
    });

    for (const loc of locations) {
      if (loc.latitude == null || loc.longitude == null) continue;
      stops.push({
        lat: Number(loc.latitude),
        lng: Number(loc.longitude),
        type: 'company',
        label: loc.Company?.name ?? 'Company',
        locationId: loc.id,
        companyId: loc.companyId ?? undefined,
        addressRaw: loc.addressRaw ?? undefined
      });
    }
  } catch {
    // DB error — return what we have
  }

  return NextResponse.json(
    { stops, total: stops.length },
    { headers: { 'Cache-Control': 'public, max-age=300' } } // cache 5 min — KML rarely changes
  );
}
