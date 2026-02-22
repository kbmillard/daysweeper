import { NextRequest, NextResponse } from 'next/server';
import { geocodeAddress } from '@/lib/geocode-server';

/**
 * POST - Geocode a single address (Nominatim then Mapbox).
 * Returns latitude, longitude, and parsed address components for form autofill.
 */
export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();

    if (!address || typeof address !== 'string') {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }

    const trimmed = address.trim();
    if (!trimmed) {
      return NextResponse.json(
        { error: 'Address cannot be empty' },
        { status: 400 }
      );
    }

    const result = await geocodeAddress(trimmed);
    if (!result) {
      return NextResponse.json(
        { error: 'Could not geocode address' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      latitude: result.latitude,
      longitude: result.longitude,
      addressNormalized: result.addressNormalized ?? undefined,
      addressComponents: result.addressComponents ?? undefined
    });
  } catch (error: unknown) {
    console.error('Geocode API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Geocoding failed'
      },
      { status: 500 }
    );
  }
}
