// Core transport calculations: distance, travel time and fare.
// These are pure functions so they are easy to test and explain.

export type Stop = {
  id: string;
  name: string;
  area: string;
  latitude: number;
  longitude: number;
};

export type Route = {
  id: string;
  route_number: string;
  name: string;
  color: string;
  avg_speed_kmph: number;
  base_fare: number;
  fare_per_km: number;
  is_active: boolean;
  /** Stops in travel order */
  stops: Stop[];
};

export type Bus = {
  id: string;
  bus_number: string;
  route_id: string | null;
  bus_type: string;
  capacity: number;
  status: string;
  driver_name: string;
};

/** Roads are not straight lines, so straight-line distance is multiplied by this factor. */
export const ROAD_FACTOR = 1.3;
/** Minutes a bus waits at every intermediate stop. */
export const DWELL_MINUTES = 1;

/** Straight-line distance between two coordinates in kilometres (Haversine formula). */
export function haversineKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Estimated road distance between two stops (km). */
export function roadKm(a: Stop, b: Stop) {
  return haversineKm(a, b) * ROAD_FACTOR;
}

/** Minutes to drive a distance at the given average speed. */
export function driveMinutes(km: number, speedKmph: number) {
  return (km / speedKmph) * 60;
}

export type Segment = { from: Stop; to: Stop; km: number; minutes: number };

/** Each stop-to-stop leg of a route with distance and time. */
export function routeSegments(route: Pick<Route, "stops" | "avg_speed_kmph">): Segment[] {
  const segs: Segment[] = [];
  for (let i = 0; i < route.stops.length - 1; i++) {
    const from = route.stops[i]!;
    const to = route.stops[i + 1]!;
    const km = roadKm(from, to);
    segs.push({ from, to, km, minutes: driveMinutes(km, route.avg_speed_kmph) });
  }
  return segs;
}

/** Fare for travelling a distance on a route, rounded up to the nearest rupee. */
export function fareFor(route: Pick<Route, "base_fare" | "fare_per_km">, km: number) {
  return Math.ceil(Number(route.base_fare) + Number(route.fare_per_km) * km);
}

export type TripEstimate = { km: number; minutes: number; fare: number; stopsCount: number };

/**
 * Distance, time and fare between two stop positions on one route.
 * Buses run both directions, so fromIndex may be greater than toIndex.
 */
export function tripOnRoute(route: Route, fromIndex: number, toIndex: number): TripEstimate {
  const segs = routeSegments(route);
  const lo = Math.min(fromIndex, toIndex);
  const hi = Math.max(fromIndex, toIndex);
  let km = 0;
  let minutes = 0;
  for (let i = lo; i < hi; i++) {
    km += segs[i]!.km;
    minutes += segs[i]!.minutes;
  }
  const intermediateStops = Math.max(0, hi - lo - 1);
  minutes += intermediateStops * DWELL_MINUTES;
  return { km, minutes: Math.round(minutes), fare: fareFor(route, km), stopsCount: hi - lo };
}

/** Whole-route summary from first to last stop. */
export function routeSummary(route: Route): TripEstimate {
  if (route.stops.length < 2) return { km: 0, minutes: 0, fare: 0, stopsCount: 0 };
  return tripOnRoute(route, 0, route.stops.length - 1);
}

export function formatMinutes(min: number) {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h} h` : `${h} h ${r} min`;
}

export function formatKm(km: number) {
  return `${km.toFixed(1)} km`;
}

export function formatFare(rupees: number) {
  return `₹${rupees}`;
}
