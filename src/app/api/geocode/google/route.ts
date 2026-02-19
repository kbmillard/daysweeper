import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@googlemaps/google-maps-services-js';

const client = new Client({});

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();

    if (!address || typeof address !== 'string') {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Maps API key not configured' },
        { status: 500 }
      );
    }

    // Use Google Maps Geocoding API
    const response = await client.geocode({
      params: {
        address: address,
        key: apiKey
      }
    });

    if (response.data.status !== 'OK' || !response.data.results.length) {
      return NextResponse.json(
        {
          error: 'Geocoding failed',
          status: response.data.status,
          address: address
        },
        { status: 404 }
      );
    }

    const result = response.data.results[0];
    const location = result.geometry.location;

    return NextResponse.json({
      latitude: location.lat,
      longitude: location.lng,
      formattedAddress: result.formatted_address,
      addressComponents: result.address_components,
      placeId: result.place_id,
      locationType: result.geometry.location_type
    });
  } catch (error: unknown) {
    console.error('Geocoding error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Geocoding failed'
      },
      { status: 500 }
    );
  }
}
