import { describe, expect, it } from "vitest";
import { findDirectRoutes, findShortestJourney, TRANSFER_PENALTY_MINUTES } from "@/lib/route-planner";
import { simulateBusPosition } from "@/lib/simulation";
import { fareFor, tripOnRoute, type Route, type Stop } from "@/lib/transit";

// A tiny made-up network: A-B-C on route 1, C-D on route 2.
const stop = (id: string, lat: number): Stop => ({ id, name: id, area: "", latitude: lat, longitude: 80 });
const A = stop("A", 13.0), B = stop("B", 13.01), C = stop("C", 13.02), D = stop("D", 13.03);
const route = (id: string, stops: Stop[], over: Partial<Route> = {}): Route => ({
  id, route_number: id, name: id, color: "#000", avg_speed_kmph: 20, base_fare: 10, fare_per_km: 1.5, is_active: true, stops, ...over,
});
const r1 = route("R1", [A, B, C]);
const r2 = route("R2", [C, D]);

describe("fare", () => {
  it("is base fare plus per-km rate, rounded up to a whole rupee", () => {
    expect(fareFor({ base_fare: 10, fare_per_km: 1.5 }, 3)).toBe(15); // 10 + 4.5 = 14.5 -> 15
  });
});

describe("direct routes", () => {
  it("finds a route serving both stops, in either direction", () => {
    expect(findDirectRoutes([r1, r2], "C", "A").map((d) => d.route.id)).toEqual(["R1"]);
  });
  it("ignores routes that are not in service", () => {
    expect(findDirectRoutes([{ ...r1, is_active: false }], "A", "C")).toHaveLength(0);
  });
});

describe("shortest journey", () => {
  it("connects stops on different routes with one change of bus", () => {
    const j = findShortestJourney([r1, r2], "A", "D")!;
    expect(j.legs.map((l) => l.route.id)).toEqual(["R1", "R2"]);
    expect(j.transfers).toBe(1);
    const legMinutes = j.legs.reduce((a, l) => a + l.minutes, 0);
    expect(j.totalMinutes).toBe(legMinutes + TRANSFER_PENALTY_MINUTES);
  });
  it("matches the direct trip time when no change is needed", () => {
    const j = findShortestJourney([r1, r2], "A", "C")!;
    expect(j.transfers).toBe(0);
    expect(j.totalMinutes).toBe(tripOnRoute(r1, 0, 2).minutes);
  });
  it("returns null when stops are not connected", () => {
    const E = stop("E", 14);
    expect(findShortestJourney([r1, route("R3", [E, stop("F", 14.1)])], "A", "E")).toBeNull();
  });
});

describe("simulated tracking", () => {
  it("shows no position for buses that are not active", () => {
    const bus = { id: "x", bus_number: "X", route_id: "R1", bus_type: "AC", capacity: 40, status: "maintenance", driver_name: "" };
    expect(simulateBusPosition(bus, r1, Date.now())).toBeNull();
  });
});
