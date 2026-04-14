import type { SellerMapPin } from '@/lib/sellers-map-data';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function descriptionText(p: SellerMapPin): string {
  const lines: string[] = [];
  if (p.addressRaw) lines.push(`Address: ${p.addressRaw}`);
  if (p.phone) lines.push(`Phone: ${p.phone}`);
  if (p.website) lines.push(`Website: ${p.website}`);
  if (p.role) lines.push(`Role: ${p.role}`);
  if (p.importCategory) lines.push(`Category: ${p.importCategory}`);
  if (p.notes) lines.push(`Notes: ${p.notes}`);
  lines.push(`companyId: ${p.companyId}`);
  lines.push(`locationId: ${p.locationId}`);
  if (p.companyExternalId) lines.push(`companyExternalId: ${p.companyExternalId}`);
  if (p.locationExternalId) lines.push(`locationExternalId: ${p.locationExternalId}`);
  return lines.join('\n');
}

/** KML 2.2 document for Google Earth (folder of seller placemarks). */
export function buildSellersKml(pins: SellerMapPin[]): string {
  const placemarks = pins
    .map((p) => {
      const name = escapeXml(p.label.trim() || 'Seller');
      const desc = escapeXml(descriptionText(p));
      return `    <Placemark>
      <name>${name}</name>
      <description>${desc}</description>
      <styleUrl>#sellerPin</styleUrl>
      <Point>
        <coordinates>${p.lng},${p.lat},0</coordinates>
      </Point>
    </Placemark>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Daysweeper — Seller locations</name>
    <description>${escapeXml(`Exported from Daysweeper seller map data. ${pins.length} placemark(s).`)}</description>
    <Style id="sellerPin">
      <IconStyle>
        <color>ff6b6b6b</color>
        <scale>1.1</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>
        </Icon>
      </IconStyle>
    </Style>
    <Folder>
      <name>Sellers</name>
      <open>1</open>
${placemarks}
    </Folder>
  </Document>
</kml>
`;
}
