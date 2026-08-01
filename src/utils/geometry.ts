import { Coordinate } from '../types';

/**
 * Calculates the Haversine distance between two coordinates in meters.
 */
export function getHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
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

/**
 * Ray-casting algorithm to test if a point (latitude, longitude) is inside a polygon.
 */
export function isPointInPolygon(
  point: Coordinate,
  polygon: Coordinate[]
): boolean {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  const x = point.longitude;
  const y = point.latitude;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].longitude;
    const yi = polygon[i].latitude;
    const xj = polygon[j].longitude;
    const yj = polygon[j].latitude;

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Calculates the geometric centroid (average latitude and longitude) of polygon vertices.
 */
export function getPolygonCentroid(polygon: Coordinate[]): Coordinate {
  if (!polygon || polygon.length === 0) {
    return { latitude: 0, longitude: 0 };
  }
  let sumLat = 0;
  let sumLng = 0;
  for (const pt of polygon) {
    sumLat += pt.latitude;
    sumLng += pt.longitude;
  }
  return {
    latitude: parseFloat((sumLat / polygon.length).toFixed(6)),
    longitude: parseFloat((sumLng / polygon.length).toFixed(6)),
  };
}

/**
 * Calculates the maximum distance in meters from the polygon centroid to its vertices.
 */
export function getPolygonBoundingRadius(
  centroid: Coordinate,
  polygon: Coordinate[]
): number {
  if (!polygon || polygon.length === 0) return 500;
  let maxDist = 0;
  for (const pt of polygon) {
    const dist = getHaversineDistance(
      centroid.latitude,
      centroid.longitude,
      pt.latitude,
      pt.longitude
    );
    if (dist > maxDist) maxDist = dist;
  }
  return Math.max(100, Math.round(maxDist));
}
