import { Trip } from '../types';

export function getTripInternalId(trip?: Partial<Trip> | null): string {
  if (!trip) return 'wt-00101';

  if (trip.internalId && trip.internalId.toLowerCase().startsWith('wt-')) {
    return trip.internalId.toLowerCase();
  }

  // Extract numbers from tripNumber if present (e.g. TRIP-1001 -> 1001 -> wt-01001)
  if (trip.tripNumber) {
    const numMatch = trip.tripNumber.match(/\d+/);
    if (numMatch) {
      const numStr = numMatch[0];
      return `wt-${numStr.padStart(5, '0')}`;
    }
  }

  // Extract numbers from id if present (e.g. t_172000123 -> 123 -> wt-00123)
  if (trip.id) {
    const numStr = trip.id.replace(/\D/g, '');
    if (numStr.length > 0) {
      return `wt-${numStr.slice(-5).padStart(5, '0')}`;
    }
  }

  return 'wt-00101';
}
