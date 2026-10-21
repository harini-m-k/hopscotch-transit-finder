// Timetable + arrival-time estimates. This is a transparent RULE-BASED estimate:
// buses leave each terminal every `frequency_min` minutes between first and last departure,
// and travel slower in a SIMULATED traffic pattern (no live traffic data is connected).

import type { Journey } from "./route-planner";
import { DWELL_MINUTES, routeSegments, type Route } from "./transit";

export type TrafficLevel = "light" | "moderate" | "heavy";

/** Simulated traffic pattern for Chennai-style peak hours. */
export function trafficAt(d: Date): { level: TrafficLevel; factor: number } {
  const h = d.getHours() + d.getMinutes() / 60;
  if ((h >= 8 && h < 10.5) || (h >= 17 && h < 20.5)) return { level: "heavy", factor: 1.4 };
  if (h >= 10.5 && h < 17) return { level: "moderate", factor: 1.15 };
  return { level: "light", factor: 1 };
}

const toMinutes = (t: string) => {
  const [h = "0", m = "0"] = t.split(":");
  return Number(h) * 60 + Number(m);
};

/** Scheduled minutes from the first stop to each stop (index), including dwell time. */
export function cumulativeMinutes(route: Route): number[] {
  const segs = routeSegments(route);
  const cum = [0];
  segs.forEach((s, i) => cum.push(cum[i]! + s.minutes + (i > 0 ? DWELL_MINUTES : 0)));
  return cum;
}

/**
 * Next scheduled bus at a stop, at or after `after`. Buses run both directions with the same
 * timetable from each terminal. Rolls to the next day when service has ended.
 */
export function nextBusAtStop(route: Route, stopIndex: number, outbound: boolean, after: Date): Date {
  const cum = cumulativeMinutes(route);
  const offset = outbound ? cum[stopIndex]! : cum[cum.length - 1]! - cum[stopIndex]!;
  const first = toMinutes(route.first_departure);
  const last = toMinutes(route.last_departure);
  const freq = Math.max(1, route.frequency_min);
  for (let dayShift = 0; dayShift < 3; dayShift++) {
    const day = new Date(after);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() + dayShift);
    const afterMin = dayShift === 0 ? (after.getTime() - day.getTime()) / 60000 : -Infinity;
    for (let dep = first; dep <= last; dep += freq) {
      if (dep + offset >= afterMin) return new Date(day.getTime() + (dep + offset) * 60000);
    }
  }
  return new Date(after);
}

export type LegEstimate = { board: Date; arrive: Date; waitMin: number; traffic: TrafficLevel };
export type JourneyEstimate = {
  legs: LegEstimate[];
  departAt: Date; // first bus departure
  arriveAt: Date; // predicted arrival with simulated traffic
  scheduledArriveAt: Date; // arrival without traffic delay
  delayMin: number;
  confidence: "high" | "medium" | "low";
};

/** Minutes a passenger needs to walk between buses at a transfer stop. */
export const TRANSFER_WALK_MIN = 2;

export function estimateJourney(journey: Journey, readyAt: Date): JourneyEstimate {
  let ready = new Date(readyAt);
  const legs: LegEstimate[] = [];
  let delay = 0;
  let worst: TrafficLevel = "light";
  for (const leg of journey.legs) {
    const a = leg.route.stops.findIndex((s) => s.id === leg.stops[0]!.id);
    const b = leg.route.stops.findIndex((s) => s.id === leg.stops[leg.stops.length - 1]!.id);
    const board = nextBusAtStop(leg.route, a, b > a, ready);
    const t = trafficAt(board);
    if (t.level === "heavy" || (t.level === "moderate" && worst === "light")) worst = t.level;
    const ride = leg.minutes * t.factor;
    delay += ride - leg.minutes;
    const arrive = new Date(board.getTime() + ride * 60000);
    legs.push({ board, arrive, waitMin: Math.max(0, Math.round((board.getTime() - ready.getTime()) / 60000)), traffic: t.level });
    ready = new Date(arrive.getTime() + TRANSFER_WALK_MIN * 60000);
  }
  const arriveAt = legs[legs.length - 1]?.arrive ?? readyAt;
  const penalty = (worst === "heavy" ? 2 : worst === "moderate" ? 1 : 0) + journey.transfers;
  return {
    legs,
    departAt: legs[0]?.board ?? readyAt,
    arriveAt,
    scheduledArriveAt: new Date(arriveAt.getTime() - delay * 60000),
    delayMin: Math.round(delay),
    confidence: penalty === 0 ? "high" : penalty <= 2 ? "medium" : "low",
  };
}

export function formatClock(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(d: Date) {
  return d.toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
