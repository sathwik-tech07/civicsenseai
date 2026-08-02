import type { IncidentLocation } from '../types';

export const DEFAULT_LOCATION: IncidentLocation = {
  lat: 12.9716,
  lng: 77.5946,
  street: 'MG Road Metro Transit Corridor',
  area: 'Central Business District',
  ward: 'Ward 1 - Metro Health Corridor',
  wardId: 'w-1',
  city: 'Bengaluru',
  state: 'Karnataka',
  postalCode: '560001',
  country: 'India',
  formattedAddress: 'MG Road Metro Transit Corridor, Ward 1, Bengaluru, Karnataka 560001',
  method: 'search',
};

export const MOCK_LOCATION_PRESETS: IncidentLocation[] = [
  {
    lat: 12.9716,
    lng: 77.5946,
    street: 'Victoria Hospital Access Road',
    area: 'Ward 4 Health Corridor',
    ward: 'Ward 4 - Riverside Residential',
    wardId: 'w-4',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560002',
    country: 'India',
    formattedAddress: 'Victoria Hospital Access Road, Ward 4, Bengaluru, Karnataka 560002',
    method: 'search',
  },
  {
    lat: 12.9796,
    lng: 77.5906,
    street: 'Ambedkar Veedhi Avenue',
    area: 'Vidhana Soudha Secretariat',
    ward: 'Ward 2 - Heritage Commercial Hub',
    wardId: 'w-2',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560001',
    country: 'India',
    formattedAddress: 'Ambedkar Veedhi Avenue, Vidhana Soudha, Bengaluru, Karnataka 560001',
    method: 'search',
  },
  {
    lat: 12.9719,
    lng: 77.5958,
    street: 'Vittal Mallya Road',
    area: 'UB City CBD Skyscraper Hub',
    ward: 'Ward 1 - Metro Health Corridor',
    wardId: 'w-1',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560001',
    country: 'India',
    formattedAddress: 'Vittal Mallya Road, UB City Tower, Bengaluru, Karnataka 560001',
    method: 'search',
  },
  {
    lat: 12.9352,
    lng: 77.6245,
    street: '100 Feet Intermediate Ring Road',
    area: 'Koramangala Tech Belt',
    ward: 'Ward 3 - Tech Innovation Belt',
    wardId: 'w-3',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560034',
    country: 'India',
    formattedAddress: '100 Feet Intermediate Ring Road, Ward 3, Bengaluru, Karnataka 560034',
    method: 'search',
  },
  {
    lat: 12.9863,
    lng: 77.7348,
    street: 'ITPL Main Road',
    area: 'Whitefield Industrial Corridor',
    ward: 'Ward 5 - Industrial Freight Zone',
    wardId: 'w-5',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560066',
    country: 'India',
    formattedAddress: 'ITPL Main Road, Whitefield Tech Zone, Bengaluru, Karnataka 560066',
    method: 'search',
  },
];

/**
 * Browser Geolocation API wrapper with Promise & fallback
 */
export async function getCurrentLocationGPS(): Promise<IncidentLocation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Browser Geolocation API not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = Math.round(pos.coords.accuracy);

        // Reverse Geocode GPS coordinates into IncidentLocation
        const loc = createLocationFromCoords(lat, lng, 'gps', accuracy);
        resolve(loc);
      },
      (err) => {
        console.warn('GPS position acquisition failed:', err.message);
        reject(err);
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 30000,
      }
    );
  });
}

/**
 * Reverse Geocode coordinates to complete IncidentLocation Object
 */
export function createLocationFromCoords(
  lat: number,
  lng: number,
  method: 'gps' | 'search' | 'map_picker' = 'map_picker',
  accuracyMeters?: number
): IncidentLocation {
  // Find nearest mock preset or synthesize reverse geocoded address
  const nearest = MOCK_LOCATION_PRESETS.find(
    (p) => Math.abs(p.lat - lat) < 0.05 && Math.abs(p.lng - lng) < 0.05
  );

  if (nearest) {
    return {
      ...nearest,
      lat,
      lng,
      accuracyMeters,
      method,
      formattedAddress: `${nearest.street}, ${nearest.ward}, ${nearest.city}, ${nearest.state} ${nearest.postalCode}`,
    };
  }

  const wardNum = Math.floor(Math.abs(lat * 100) % 5) + 1;
  const wardNames = [
    'Ward 1 - Metro Health Corridor',
    'Ward 2 - Heritage Commercial Hub',
    'Ward 3 - Tech Innovation Belt',
    'Ward 4 - Riverside Residential',
    'Ward 5 - Industrial Freight Zone',
  ];

  return {
    lat,
    lng,
    street: `Sector ${Math.floor(lat * 1000 % 20) + 1} Arterial Corridor`,
    area: `District ${wardNum} Metro Belt`,
    ward: wardNames[wardNum - 1],
    wardId: `w-${wardNum}`,
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: `5600${wardNum}0`,
    country: 'India',
    formattedAddress: `Sector ${Math.floor(lat * 1000 % 20) + 1} Corridor, ${wardNames[wardNum - 1]}, Bengaluru, Karnataka 5600${wardNum}0`,
    accuracyMeters,
    method,
  };
}

/**
 * Search Address Autocomplete Engine
 */
export function searchAddressSuggestions(query: string): IncidentLocation[] {
  if (!query || query.trim().length < 2) return MOCK_LOCATION_PRESETS;
  const q = query.toLowerCase();

  return MOCK_LOCATION_PRESETS.filter(
    (loc) =>
      loc.formattedAddress.toLowerCase().includes(q) ||
      loc.street.toLowerCase().includes(q) ||
      loc.area.toLowerCase().includes(q) ||
      loc.ward.toLowerCase().includes(q)
  );
}
