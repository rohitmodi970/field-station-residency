import { NextRequest, NextResponse } from 'next/server';

// Known offline city centroids for instant zero-latency / offline fallback
const KNOWN_METROS = [
  { city: 'Chennai', region: 'Tamil Nadu', country: 'India', lat: 13.0827, lon: 80.2707, radiusKm: 80 },
  { city: 'Bengaluru', region: 'Karnataka', country: 'India', lat: 12.9716, lon: 77.5946, radiusKm: 70 },
  { city: 'Hyderabad', region: 'Telangana', country: 'India', lat: 17.3850, lon: 78.4867, radiusKm: 70 },
  { city: 'Mumbai', region: 'Maharashtra', country: 'India', lat: 19.0760, lon: 72.8777, radiusKm: 70 },
  { city: 'Delhi', region: 'Delhi', country: 'India', lat: 28.6139, lon: 77.2090, radiusKm: 70 },
  { city: 'Kolkata', region: 'West Bengal', country: 'India', lat: 22.5726, lon: 88.3639, radiusKm: 70 },
  { city: 'Pune', region: 'Maharashtra', country: 'India', lat: 18.5204, lon: 73.8567, radiusKm: 50 },
  { city: 'Ahmedabad', region: 'Gujarat', country: 'India', lat: 23.0225, lon: 72.5714, radiusKm: 50 },
  { city: 'San Francisco', region: 'California', country: 'United States', lat: 37.7749, lon: -122.4194, radiusKm: 50 },
  { city: 'New York', region: 'New York', country: 'United States', lat: 40.7128, lon: -74.0060, radiusKm: 60 },
  { city: 'London', region: 'England', country: 'United Kingdom', lat: 51.5074, lon: -0.1278, radiusKm: 60 },
  { city: 'Singapore', region: 'Singapore', country: 'Singapore', lat: 1.3521, lon: 103.8198, radiusKm: 40 },
  { city: 'Tokyo', region: 'Tokyo', country: 'Japan', lat: 35.6762, lon: 139.6503, radiusKm: 60 },
  { city: 'Dubai', region: 'Dubai', country: 'United Arab Emirates', lat: 25.2048, lon: 55.2708, radiusKm: 50 },
];

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function cleanCityName(rawCity?: string, stateDistrict?: string): string {
  if (!rawCity && stateDistrict) return stateDistrict;
  if (!rawCity) return '';

  return rawCity
    .replace(/\s+(Corporation|City|Municipality|Division)$/i, '')
    .trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const lat = Number(body.latitude);
    const lon = Number(body.longitude);

    if (isNaN(lat) || isNaN(lon)) {
      return NextResponse.json({ error: 'Valid latitude and longitude required' }, { status: 400 });
    }

    // 1. Try OpenStreetMap Nominatim reverse geocode server-side (bypasses browser CORS & shields)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'en',
            'User-Agent': 'ForceApp/1.0 (contact@force.app)',
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};

        let city = cleanCityName(
          addr.city ||
          addr.town ||
          addr.village ||
          addr.municipality ||
          addr.suburb,
          addr.state_district
        );

        // If city is still empty or generic, check state_district
        if (!city && addr.state_district) {
          city = addr.state_district;
        }

        const region = addr.state || addr.province || addr.region || '';
        const country = addr.country || '';
        const postalCode = addr.postcode || '';
        const neighbourhood = addr.neighbourhood || addr.suburb || '';

        const locationNameParts = [neighbourhood, city, region, country].filter(Boolean);
        const formattedAddress = data.display_name || locationNameParts.join(', ');

        return NextResponse.json({
          city: city || undefined,
          region: region || undefined,
          country: country || undefined,
          postalCode: postalCode || undefined,
          formattedAddress,
          neighbourhood: neighbourhood || undefined,
          source: 'nominatim',
        });
      }
    } catch (err) {
      console.warn('[Geocode API] Nominatim server request failed, trying fallback:', err);
    }

    // 2. Try BigDataCloud free client-reverse geocode endpoint
    try {
      const bdcRes = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
      );
      if (bdcRes.ok) {
        const bdc = await bdcRes.json();
        const city = bdc.city || bdc.locality || '';
        const region = bdc.principalSubdivision || '';
        const country = bdc.countryName || '';
        const formattedAddress = [city, region, country].filter(Boolean).join(', ');

        if (city || region) {
          return NextResponse.json({
            city: city || undefined,
            region: region || undefined,
            country: country || undefined,
            postalCode: bdc.postcode || undefined,
            formattedAddress,
            source: 'bigdatacloud',
          });
        }
      }
    } catch (_err) {
      // Ignore and continue to proximity fallback
    }

    // 3. Known metro coordinate proximity matching (Guaranteed accurate offline fallback)
    for (const metro of KNOWN_METROS) {
      const dist = haversineDistanceKm(lat, lon, metro.lat, metro.lon);
      if (dist <= metro.radiusKm) {
        return NextResponse.json({
          city: metro.city,
          region: metro.region,
          country: metro.country,
          formattedAddress: `${metro.city}, ${metro.region}, ${metro.country}`,
          source: 'proximity_centroid',
        });
      }
    }

    return NextResponse.json({
      formattedAddress: `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`,
      source: 'coordinates_only',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Geocoding failed';
    console.error('[Geocode API] Error:', error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
