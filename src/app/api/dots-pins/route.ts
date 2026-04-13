import AdmZip from 'adm-zip';
import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { prisma } from '@/lib/prisma';
import {
  pinResearchDefaultCacheKey,
  type PinPlaceResearchResult
} from '@/lib/pin-place-research';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function coordKey(lat: number, lng: number) {
  return `${Number(lng.toFixed(5))},${Number(lat.toFixed(5))}`;
}

export type RedPin = {
  lng: number;
  lat: number;
  id?: string;
  source: 'kml' | 'user';
  label?: string;
  addressRaw?: string;
  phone?: string;
  email?: string;
  website?: string;
  industry?: string;
  summary?: string;
  alternativeNames?: string[];
  accountState?: string;
  targetId?: string;
};

/**
 * GET - Red pins from MapPin when that table exists (including empty — no KML reintroduction).
 * KML fallback only when MapPin is unavailable (e.g. DB not migrated yet).
 */
export async function GET() {
  try {
    let mapPinTableAvailable = false;
    let dbPins: RedPin[] = [];
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
      // Use kml so map colors match LastLeg route targets (active=blue). MapPin rows are the
      // canonical synced dot layer (KML/build pipeline), not ad-hoc "user" drop semantics.
      dbPins = userPins.map((p) => ({
        lng: Number(p.longitude),
        lat: Number(p.latitude),
        id: p.id,
        source: 'kml' as const,
        label: cachedMap.get(pinResearchDefaultCacheKey(Number(p.latitude), Number(p.longitude)))?.chosen?.name ?? undefined,
        addressRaw: cachedMap.get(pinResearchDefaultCacheKey(Number(p.latitude), Number(p.longitude)))?.chosen?.formattedAddress ?? undefined,
        phone: cachedMap.get(pinResearchDefaultCacheKey(Number(p.latitude), Number(p.longitude)))?.chosen?.phone ?? undefined,
        website: cachedMap.get(pinResearchDefaultCacheKey(Number(p.latitude), Number(p.longitude)))?.chosen?.website ?? undefined,
        summary: cachedMap.get(pinResearchDefaultCacheKey(Number(p.latitude), Number(p.longitude)))?.webSummary ?? undefined
      }));
    } catch {
      // MapPin table may not exist yet — use KML fallback below
    }

    if (mapPinTableAvailable) {
      return NextResponse.json(
        { pins: dbPins },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Fallback when MapPin is not available
    let hiddenSet = new Set<string>();
    try {
      const hidden = await prisma.hiddenDot.findMany({ select: { latitude: true, longitude: true } });
      hiddenSet = new Set(hidden.map((h) => coordKey(Number(h.latitude), Number(h.longitude))));
    } catch {
      // ignore
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
    const pins: RedPin[] = kmlPins
      .slice(0, MAX_KML)
      .filter((p) => !hiddenSet.has(coordKey(p.lat, p.lng)))
      .map((p) => ({ ...p, source: 'kml' as const }));

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
