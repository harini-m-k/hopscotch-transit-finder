// SIMULATED bus tracking. There is no GPS device — positions are calculated from
// the current time so each bus moves smoothly back and forth along its route.

import { routeSegments, type Bus, type Route } from "./transit";

export type SimulatedPosition = {
  latitude: number;
  longitude: number;
  nextStopName: string;
  previousStopName: string;
  direction: "outbound" | "return";
  progress: number; // 0..1 along the whole route
};

/** Stable number 0..1 from a string, so each bus starts at a different point. */
function seedFrom(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

/**
 * Position of a bus at a given time. One full trip (end to end) takes the route's
 * real estimated time, but the clock is sped up 20x so movement is visible in a demo.
 */
export function simulateBusPosition(bus: Bus, route: Route, nowMs: number, speedUp = 20): SimulatedPosition | null {
  if (bus.status !== "active" || route.stops.length < 2) return null;
  const segs = routeSegments(route);
  const tripMinutes = segs.reduce((a, s) => a + s.minutes, 0);
  if (tripMinutes <= 0) return null;

  const cycleMs = (tripMinutes * 60_000 * 2) / speedUp; // there and back
  const phase = ((nowMs / cycleMs + seedFrom(bus.id)) % 1 + 1) % 1;
  const outbound = phase < 0.5;
  const progress = outbound ? phase * 2 : (1 - phase) * 2;

  let target = progress * tripMinutes;
  for (const seg of segs) {
    if (target <= seg.minutes || seg === segs[segs.length - 1]) {
      const t = seg.minutes === 0 ? 0 : Math.min(1, target / seg.minutes);
      return {
        latitude: seg.from.latitude + (seg.to.latitude - seg.from.latitude) * t,
        longitude: seg.from.longitude + (seg.to.longitude - seg.from.longitude) * t,
        nextStopName: outbound ? seg.to.name : seg.from.name,
        previousStopName: outbound ? seg.from.name : seg.to.name,
        direction: outbound ? "outbound" : "return",
        progress,
      };
    }
    target -= seg.minutes;
  }
  return null;
}

export type FleetEntry = { bus: Bus; route: Route; position: SimulatedPosition };

/** Simulated positions for every active bus that has a route. */
export function simulateFleet(buses: Bus[], routes: Route[], nowMs: number): FleetEntry[] {
  const byId = new Map(routes.map((r) => [r.id, r]));
  const out: FleetEntry[] = [];
  for (const bus of buses) {
    const route = bus.route_id ? byId.get(bus.route_id) : undefined;
    if (!route || !route.is_active) continue;
    const position = simulateBusPosition(bus, route, nowMs);
    if (position) out.push({ bus, route, position });
  }
  return out;
}
