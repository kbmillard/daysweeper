import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import {
  pinResearchDefaultCacheKey,
  type PinPlaceResearchResult
} from '@/lib/pin-place-research';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/suggested-stops
 * Returns red prospect pins only for the LastLeg iOS app.
 * These should match the Daysweeper red-dot layer exactly.
 *
 * Response:
 * {
 *   stops: Array<{
 *     lat: number,
 *     lng: number,
 *     type: 'prospect',
 *     label: string,
 *     addressRaw?: string
 *   }>
 * }
 *
 * No auth required — same as /api/dots-pins.
 */

type SuggestedStop = {
  lat: number;
  lng: number;
  type: 'prospect';
  label: string;
  addressRaw?: string;
};

function coordKey(lat: number, lng: number) {
  return `${Number(lng.toFixed(5))},${Number(lat.toFixed(5))}`;
}

export async function GET() {
  const stops: SuggestedStop[] = [];

  // --- Red dots: MapPin only when table exists (no KML duplicate / reintroduction) ---
  try {
    let mapPinTableAvailable = false;
    try {
      const userPins = await prisma.mapPin.findMany({
        where: { hidden: false },
        select: { id: true, latitude: true, longitude: true }
      });
      mapPinTableAvailable = true;
      const keys = userPins.map((p) =>
        pinResearchDefaultCacheKey(Number(p.latitude), Number(p.longitude))
      );
      const cachedRows = keys.length
        ? await prisma.metaKV.findMany({
            where: { key: { in: keys } },
            select: { key: true, value: true }
          })
        : [];
      const cachedMap = new Map<string, PinPlaceResearchResult>();
      for (const row of cachedRows) {
        const value = row.value as Record<string, unknown>;
        if (value?.schema === 'pin_place_research_v2' && value.payload) {
          cachedMap.set(row.key, value.payload as PinPlaceResearchResult);
        }
      }
      for (const p of userPins) {
        const lat = Number(p.latitude);
        const lng = Number(p.longitude);
        const cached = cachedMap.get(pinResearchDefaultCacheKey(lat, lng));
        stops.push({
          lat,
          lng,
          type: 'prospect',
          label: cached?.chosen?.name?.trim() || 'Prospect',
          addressRaw: cached?.chosen?.formattedAddress ?? undefined
        });
      }
    } catch {
      // MapPin table may not exist
    }

    if (!mapPinTableAvailable) {
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

            const nameMatch = /<name>\s*([^<]+)<\/name>/i.exec(block);
            const label = nameMatch ? nameMatch[1].trim() : 'Prospect';

            stops.push({ lat, lng, type: 'prospect', label });
          }
        }
      }
    }
  } catch {
    // Prospect parsing failed — return an empty set below
  }

  return NextResponse.json(
    { stops, total: stops.length },
    { headers: { 'Cache-Control': 'public, max-age=300' } } // cache 5 min — KML rarely changes
  );
}
