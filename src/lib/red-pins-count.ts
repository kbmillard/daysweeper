import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';

function coordKey(lat: number, lng: number) {
  return `${Number(lng.toFixed(5))},${Number(lat.toFixed(5))}`;
}

/**
 * Returns the count of red pins: MapPin rows when the table exists (including 0),
 * else KML-based count for legacy environments.
 */
export async function getRedPinsCount(): Promise<number> {
  try {
    const count = await prisma.mapPin.count({ where: { hidden: false } });
    return count;
  } catch {
    // table may not exist yet; fall back to KML-based count below
  }

  let hiddenSet = new Set<string>();
  try {
    const hidden = await prisma.hiddenDot.findMany({ select: { latitude: true, longitude: true } });
    hiddenSet = new Set(hidden.map((h) => coordKey(Number(h.latitude), Number(h.longitude))));
  } catch {
    // tables may not exist yet
  }

  let kmlCount = 0;
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
      const kmlPins: Array<{ lat: number; lng: number }> = [];
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
        kmlPins.push({ lat, lng });
      }
      const MAX_KML = 1600;
      kmlCount = kmlPins
        .slice(0, MAX_KML)
        .filter((p) => !hiddenSet.has(coordKey(p.lat, p.lng))).length;
    }
  }

  return kmlCount;
}
