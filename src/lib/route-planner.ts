// Route optimisation: direct buses, and journey options between two stops computed with
// Dijkstra's algorithm on the stop network using different "cost" rules
// (fastest, cheapest, fewest changes, accessible, lowest emissions).

import {
  CAR_G_PER_KM,
  DWELL_MINUTES,
  fareFor,
  routeEmissionFactor,
  routeIsAccessible,
  routeSegments,
  tripOnRoute,
  type Bus,
  type Route,
  type Stop,
  type TripEstimate,
} from "./transit";

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

/** How Dijkstra scores a journey. Lower total cost wins. */
export type CostModel = {
  edge: (e: { km: number; minutes: number }, route: Route) => number;
  /** Cost of getting on a bus. isTransfer = changing from another route. */
  board: (route: Route, isTransfer: boolean) => number;
  allow?: (route: Route) => boolean;
};

export const FASTEST: CostModel = {
  edge: (e) => e.minutes,
  board: (_r, isTransfer) => (isTransfer ? TRANSFER_PENALTY_MINUTES : 0),
};

/** Generic Dijkstra over (stop, current route) states. Returns null when not connected. */
export function planJourney(routes: Route[], fromId: string, toId: string, model: CostModel = FASTEST): Journey | null {
  if (fromId === toId) return null;
  const active = routes.filter((r) => r.is_active && r.stops.length >= 2 && (model.allow ? model.allow(r) : true));
  const routeById = new Map(active.map((r) => [r.id, r]));
  const stopById = new Map<string, Stop>();

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
      const route = routeById.get(e.routeId)!;
      const boarding = cur.route !== e.routeId ? model.board(route, cur.route !== "") : 0;
      const cost = cur.cost + model.edge(e, route) + boarding;
      const next = key(e.to, e.routeId);
      if (cost < (dist.get(next) ?? Infinity)) {
        dist.set(next, cost);
        prev.set(next, { state: cur.state, edge: e });
        queue.push({ state: next, stop: e.to, route: e.routeId, cost });
      }
    }
  }
  if (!best) return null;

  const edges: { from: string; edge: Edge }[] = [];
  let s: string = best;
  while (prev.get(s)) {
    const p = prev.get(s)!;
    edges.unshift({ from: p.state.split("|")[0]!, edge: p.edge });
    s = p.state;
  }

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

/** Fastest journey (kept for compatibility). */
export function findShortestJourney(routes: Route[], fromId: string, toId: string): Journey | null {
  return planJourney(routes, fromId, toId, FASTEST);
}

export type OptionKind = "fastest" | "cheapest" | "fewest_transfers" | "accessible" | "greenest";
export const OPTION_KINDS: OptionKind[] = ["fastest", "cheapest", "fewest_transfers", "accessible", "greenest"];

export type JourneyOption = {
  kind: OptionKind;
  journey: Journey;
  /** Estimated grams CO2 for one passenger */
  emissionsG: number;
  /** Same distance by car, grams CO2 */
  carEmissionsG: number;
  accessible: boolean;
  /** When the same journey is already shown under an earlier option */
  sameAs?: OptionKind;
};

export function journeyEmissions(journey: Journey, buses: Bus[]) {
  return journey.legs.reduce((a, l) => a + l.km * routeEmissionFactor(l.route.id, buses), 0);
}

const signature = (j: Journey) => j.legs.map((l) => `${l.route.id}:${l.stops.map((s) => s.id).join(">")}`).join("|");

/** All journey options with their metrics. Options that cannot be planned are left out. */
export function findJourneyOptions(routes: Route[], buses: Bus[], fromId: string, toId: string): JourneyOption[] {
  const models: Record<OptionKind, CostModel> = {
    fastest: FASTEST,
    cheapest: {
      edge: (e, r) => r.fare_per_km * e.km + e.minutes * 0.001,
      board: (r, isTransfer) => r.base_fare + (isTransfer ? 0.01 : 0),
    },
    fewest_transfers: {
      edge: (e) => e.minutes,
      board: (_r, isTransfer) => (isTransfer ? 1000 : 0),
    },
    accessible: { ...FASTEST, allow: (r) => routeIsAccessible(r.id, buses) },
    greenest: {
      edge: (e, r) => e.km * routeEmissionFactor(r.id, buses) + e.minutes * 0.01,
      board: (_r, isTransfer) => (isTransfer ? 1 : 0),
    },
  };
  const out: JourneyOption[] = [];
  for (const kind of OPTION_KINDS) {
    const journey = planJourney(routes, fromId, toId, models[kind]);
    if (!journey) continue;
    const sig = signature(journey);
    const twin = out.find((o) => signature(o.journey) === sig);
    out.push({
      kind,
      journey,
      emissionsG: Math.round(journeyEmissions(journey, buses)),
      carEmissionsG: Math.round(journey.totalKm * CAR_G_PER_KM),
      accessible: journey.legs.every((l) => routeIsAccessible(l.route.id, buses)),
      ...(twin ? { sameAs: twin.sameAs ?? twin.kind } : {}),
    });
  }
  return out;
}
