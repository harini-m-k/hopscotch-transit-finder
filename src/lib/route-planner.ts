// Route optimisation: finds direct buses and the shortest journey (fewest minutes)
// between two stops using Dijkstra's algorithm on the stop network.

import { DWELL_MINUTES, fareFor, routeSegments, tripOnRoute, type Route, type Stop, type TripEstimate } from "./transit";

/** Extra minutes added when a passenger changes from one bus route to another (waiting time). */
export const TRANSFER_PENALTY_MINUTES = 10;

export type DirectOption = { route: Route; fromIndex: number; toIndex: number } & TripEstimate;

/** All active routes that serve both stops, fastest first. */
export function findDirectRoutes(routes: Route[], fromId: string, toId: string): DirectOption[] {
  const out: DirectOption[] = [];
  for (const route of routes) {
    if (!route.is_active) continue;
    const fromIndex = route.stops.findIndex((s) => s.id === fromId);
    const toIndex = route.stops.findIndex((s) => s.id === toId);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) continue;
    out.push({ route, fromIndex, toIndex, ...tripOnRoute(route, fromIndex, toIndex) });
  }
  return out.sort((a, b) => a.minutes - b.minutes);
}

export type Leg = {
  route: Route;
  stops: Stop[]; // stops passed on this leg, in travel order (includes boarding and alighting stop)
  km: number;
  minutes: number;
  fare: number;
};

export type Journey = {
  legs: Leg[];
  totalMinutes: number; // includes transfer waiting time
  totalKm: number;
  totalFare: number;
  transfers: number;
};

type Edge = { to: string; routeId: string; km: number; minutes: number };

/**
 * Shortest journey by travel time. Each graph state is (stop, current route) so that
 * changing buses can add a transfer penalty. Returns null when no connection exists.
 */
export function findShortestJourney(routes: Route[], fromId: string, toId: string): Journey | null {
  if (fromId === toId) return null;
  const active = routes.filter((r) => r.is_active && r.stops.length >= 2);
  const routeById = new Map(active.map((r) => [r.id, r]));
  const stopById = new Map<string, Stop>();

  // Build adjacency list: every consecutive pair of stops on a route, both directions.
  const adj = new Map<string, Edge[]>();
  const addEdge = (a: string, e: Edge) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a)!.push(e);
  };
  for (const r of active) {
    r.stops.forEach((s) => stopById.set(s.id, s));
    for (const seg of routeSegments(r)) {
      const minutes = seg.minutes + DWELL_MINUTES;
      addEdge(seg.from.id, { to: seg.to.id, routeId: r.id, km: seg.km, minutes });
      addEdge(seg.to.id, { to: seg.from.id, routeId: r.id, km: seg.km, minutes });
    }
  }
  if (!adj.has(fromId) || !adj.has(toId)) return null;

  const key = (stop: string, route: string) => `${stop}|${route}`;
  const dist = new Map<string, number>();
  const prev = new Map<string, { state: string; edge: Edge } | null>();
  // Simple priority queue (array) — fine for city-sized networks.
  const queue: { state: string; stop: string; route: string; cost: number }[] = [];

  const startState = key(fromId, "");
  dist.set(startState, 0);
  prev.set(startState, null);
  queue.push({ state: startState, stop: fromId, route: "", cost: 0 });

  let best: string | null = null;
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const cur = queue.shift()!;
    if (cur.cost > (dist.get(cur.state) ?? Infinity)) continue;
    if (cur.stop === toId) {
      best = cur.state;
      break;
    }
    for (const e of adj.get(cur.stop) ?? []) {
      const transfer = cur.route !== "" && cur.route !== e.routeId ? TRANSFER_PENALTY_MINUTES : 0;
      const cost = cur.cost + e.minutes + transfer;
      const next = key(e.to, e.routeId);
      if (cost < (dist.get(next) ?? Infinity)) {
        dist.set(next, cost);
        prev.set(next, { state: cur.state, edge: e });
        queue.push({ state: next, stop: e.to, route: e.routeId, cost });
      }
    }
  }
  if (!best) return null;

  // Walk back to collect edges in order.
  const edges: { from: string; edge: Edge }[] = [];
  let s: string = best;
  while (prev.get(s)) {
    const p = prev.get(s)!;
    edges.unshift({ from: p.state.split("|")[0]!, edge: p.edge });
    s = p.state;
  }

  // Group consecutive edges on the same route into legs.
  const legs: Leg[] = [];
  for (const { from, edge } of edges) {
    const last = legs[legs.length - 1];
    if (last && last.route.id === edge.routeId) {
      last.stops.push(stopById.get(edge.to)!);
      last.km += edge.km;
      last.minutes += edge.minutes;
    } else {
      legs.push({
        route: routeById.get(edge.routeId)!,
        stops: [stopById.get(from)!, stopById.get(edge.to)!],
        km: edge.km,
        minutes: edge.minutes,
        fare: 0,
      });
    }
  }
  for (const leg of legs) {
    leg.minutes = Math.round(leg.minutes - DWELL_MINUTES); // no dwell at the final stop of a leg
    leg.fare = fareFor(leg.route, leg.km);
  }
  const transfers = legs.length - 1;
  return {
    legs,
    transfers,
    totalKm: legs.reduce((a, l) => a + l.km, 0),
    totalFare: legs.reduce((a, l) => a + l.fare, 0),
    totalMinutes: legs.reduce((a, l) => a + l.minutes, 0) + transfers * TRANSFER_PENALTY_MINUTES,
  };
}
