/**
 * One-off script to update location pin drop coordinates
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const UPDATES: { addressContains: string; lat: number; lng: number }[] = [
  { addressContains: '1760 SK Blvd', lat: 34.235778, lng: -83.484231 },
  { addressContains: '130 Byassee Dr.', lat: 38.7766, lng: -90.3662 },
  { addressContains: '46501 Commerce Center Dr', lat: 42.384389, lng: -83.503433 },
  { addressContains: '1400 E Outer Drive', lat: 42.333239, lng: -83.155683 }
];

async function main() {
  for (const { addressContains, lat, lng } of UPDATES) {
    const result = await prisma.location.updateMany({
      where: {
        addressRaw: { contains: addressContains, mode: 'insensitive' }
      },
      data: {
        latitude: lat,
        longitude: lng,
        updatedAt: new Date()
      }
    });
    console.log(
      `Updated ${result.count} location(s) matching "${addressContains}" → ${lat}, ${lng}`
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
