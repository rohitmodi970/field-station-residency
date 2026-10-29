'use client';

import { useState, useEffect, useCallback } from 'react';
import type { UserLocation } from '@/lib/force-agent/types';

export const LOCATION_STORAGE_KEY = 'force_user_location';

/**
 * Reverse geocode latitude and longitude into human-readable city, state, country.
 * Queries our same-origin /api/agent/location/geocode endpoint (bypasses browser CORS & ad-blockers),
 * with client-side proximity fallback for major metropolitan centroids.
 */
export async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number
): Promise<{
  city?: string;
  region?: string;
  country?: string;
  postalCode?: string;
  formattedAddress?: string;
}> {
  // 1. Same-origin server proxy endpoint (not blocked by Brave Shields or CORS)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch('/api/agent/location/geocode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ latitude, longitude }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.city || data.formattedAddress) {
        return {
          city: data.city || undefined,
          region: data.region || undefined,
          country: data.country || undefined,
          postalCode: data.postalCode || undefined,
          formattedAddress: data.formattedAddress || undefined,
        };
      }
    }
  } catch (err) {
    console.warn('[Location] Internal reverse geocode endpoint failed:', err);
  }

  // 2. High-precision offline metro centroid fallback
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

  for (const metro of KNOWN_METROS) {
    const dLat = ((metro.lat - latitude) * Math.PI) / 180;
    const dLon = ((metro.lon - longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((latitude * Math.PI) / 180) *
        Math.cos((metro.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const dist = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    if (dist <= metro.radiusKm) {
      return {
        city: metro.city,
        region: metro.region,
        country: metro.country,
        formattedAddress: `${metro.city}, ${metro.region}, ${metro.country}`,
      };
    }
  }

  // 3. Fallback to coordinate string (never guess physical city from IANA timezone string)
  return {
    formattedAddress: `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`,
  };
}

export function useUserLocation() {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unsupported'>('prompt');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const requestLocation = useCallback(async (): Promise<UserLocation | null> => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setError('Geolocation is not supported by your browser.');
      setPermissionState('unsupported');
      return null;
    }

    setIsLoading(true);
    setError(null);

    return new Promise<UserLocation | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, accuracy, altitude, heading, speed } = position.coords;
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

          // Reverse geocode to get city, region, country
          const geoDetails = await reverseGeocodeCoordinates(latitude, longitude);

          const newLocation: UserLocation = {
            latitude,
            longitude,
            accuracy,
            altitude: altitude ?? null,
            heading: heading ?? null,
            speed: speed ?? null,
            city: geoDetails.city,
            region: geoDetails.region,
            country: geoDetails.country,
            postalCode: geoDetails.postalCode,
            formattedAddress: geoDetails.formattedAddress,
            timezone,
            timestamp: position.timestamp || Date.now(),
          };

          setLocation(newLocation);
          setPermissionState('granted');
          setIsLoading(false);

          try {
            localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(newLocation));
            window.dispatchEvent(new CustomEvent('force:location-updated', { detail: newLocation }));
          } catch {}

          resolve(newLocation);
        },
        (err) => {
          setIsLoading(false);
          let message = 'Could not retrieve your location.';
          if (err.code === err.PERMISSION_DENIED) {
            message = 'Location access was denied. Please allow location access in your browser settings.';
            setPermissionState('denied');
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            message = 'Location information is currently unavailable.';
          } else if (err.code === err.TIMEOUT) {
            message = 'The request to obtain your location timed out.';
          }
          setError(message);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 120000, // 2 minutes cache
        }
      );
    });
  }, []);

  // Load cached location from localStorage on mount & listen to permission changes
  useEffect(() => {
    try {
      const cached = localStorage.getItem(LOCATION_STORAGE_KEY);
      if (cached) {
        const parsed: UserLocation = JSON.parse(cached);
        if (parsed.latitude && parsed.longitude) {
          const isMismatchedCalcutta =
            (parsed.city === 'Calcutta' || parsed.formattedAddress?.includes('estimated from timezone')) &&
            (Math.abs(parsed.latitude - 22.57) > 2 || Math.abs(parsed.longitude - 88.36) > 2);

          if (!isMismatchedCalcutta) {
            setLocation(parsed);
          } else {
            // Immediately re-geocode with accurate server proxy endpoint & metro proximity
            reverseGeocodeCoordinates(parsed.latitude, parsed.longitude).then((geo) => {
              const corrected: UserLocation = {
                ...parsed,
                city: geo.city,
                region: geo.region,
                country: geo.country,
                postalCode: geo.postalCode,
                formattedAddress: geo.formattedAddress,
              };
              setLocation(corrected);
              try {
                localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(corrected));
                window.dispatchEvent(new CustomEvent('force:location-updated', { detail: corrected }));
              } catch {}
            });
          }
        }
      }
    } catch {}

    if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((status) => {
          setPermissionState(status.state as 'prompt' | 'granted' | 'denied');
          status.onchange = () => {
            setPermissionState(status.state as 'prompt' | 'granted' | 'denied');
            if (status.state === 'granted') {
              void requestLocation();
            } else if (status.state === 'denied') {
              setError('Location permission was denied in your browser settings.');
            }
          };
        })
        .catch(() => {
          // Permissions API query not supported for geolocation in some browsers
          if (!('geolocation' in navigator)) {
            setPermissionState('unsupported');
          }
        });
    } else if (typeof navigator !== 'undefined' && !('geolocation' in navigator)) {
      setPermissionState('unsupported');
    }
  }, [requestLocation]);

  const clearLocation = useCallback(() => {
    setLocation(null);
    setError(null);
    try {
      localStorage.removeItem(LOCATION_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent('force:location-updated', { detail: null }));
    } catch {}
  }, []);

  return {
    location,
    permissionState,
    isLoading,
    error,
    requestLocation,
    clearLocation,
    hasLocationAccess: Boolean(location && location.latitude && location.longitude),
  };
}
