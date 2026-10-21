import { describe, expect, it } from "vitest";
import { bookingTotal, canCancel, makeBookingCode, validateTravelTime } from "@/lib/booking-rules";
import { findDirectRoutes, findJourneyOptions, findShortestJourney, TRANSFER_PENALTY_MINUTES } from "@/lib/route-planner";
import { estimateJourney, nextBusAtStop, trafficAt } from "@/lib/schedule";
import { simulateBusPosition } from "@/lib/simulation";
import { fareFor, tripOnRoute, type Bus, type Route, type Stop } from "@/lib/transit";

// A tiny made-up network: A-B-C on route 1, C-D on route 2, and a slow direct A-D route 3.
const stop = (id: string, lat: number): Stop => ({ id, name: id, area: "", latitude: lat, longitude: 80 });
const A = stop("A", 13.0), B = stop("B", 13.01), C = stop("C", 13.02), D = stop("D", 13.03);
const route = (id: string, stops: Stop[], over: Partial<Route> = {}): Route => ({
  id, route_number: id, name: id, color: "#000", avg_speed_kmph: 20, base_fare: 10, fare_per_km: 1.5, is_active: true,
  first_departure: "06:00", last_departure: "22:00", frequency_min: 15, stops, ...over,
});
const bus = (id: string, routeId: string, over: Partial<Bus> = {}): Bus => ({
  id, bus_number: id, route_id: routeId, bus_type: "Ordinary", capacity: 50, status: "active", driver_name: "", is_accessible: false, ...over,
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

describe("journey options", () => {
  // Slow direct route A→D (5 km/h) competes with the R1+R2 change.
  const slowDirect = route("R3", [A, D], { avg_speed_kmph: 5, base_fare: 5, fare_per_km: 1 });
  const buses = [bus("b1", "R1"), bus("b2", "R2"), bus("b3", "R3", { bus_type: "Electric", is_accessible: true })];
  const opts = findJourneyOptions([r1, r2, slowDirect], buses, "A", "D");
  const get = (k: string) => opts.find((o) => o.kind === k)!;

  it("fewest-changes option uses no change of bus", () => {
    expect(get("fewest_transfers").journey.transfers).toBe(0);
  });
  it("accessible option only uses routes with an accessible bus", () => {
    expect(get("accessible").journey.legs.map((l) => l.route.id)).toEqual(["R3"]);
  });
  it("lowest-emission option prefers the electric route", () => {
    expect(get("greenest").journey.legs.map((l) => l.route.id)).toEqual(["R3"]);
  });
  it("cheapest option has the lowest fare of all options", () => {
    const min = Math.min(...opts.map((o) => o.journey.totalFare));
    expect(get("cheapest").journey.totalFare).toBe(min);
  });
});

describe("timetable and arrival estimate", () => {
  it("gives the next scheduled bus at the first stop", () => {
    const after = new Date(2026, 0, 5, 6, 7); // 06:07, buses every 15 min from 06:00
    expect(nextBusAtStop(r1, 0, true, after).getMinutes()).toBe(15);
  });
  it("rolls over to the next morning after the last bus", () => {
    const next = nextBusAtStop(r1, 0, true, new Date(2026, 0, 5, 23, 0));
    expect([next.getDate(), next.getHours(), next.getMinutes()]).toEqual([6, 6, 0]);
  });
  it("treats 9 am as heavy (simulated) traffic", () => {
    expect(trafficAt(new Date(2026, 0, 5, 9, 0)).level).toBe("heavy");
  });
  it("adds no delay in light traffic", () => {
    const j = findShortestJourney([r1], "A", "C")!;
    expect(estimateJourney(j, new Date(2026, 0, 5, 6, 0)).delayMin).toBe(0);
  });
});

describe("ticket rules", () => {
  const now = new Date(2026, 0, 5, 12, 0);
  it("allows cancelling more than 30 minutes before departure", () => {
    expect(canCancel("confirmed", new Date(2026, 0, 5, 12, 31), now).ok).toBe(true);
  });
  it("blocks cancelling within 30 minutes of departure", () => {
    expect(canCancel("confirmed", new Date(2026, 0, 5, 12, 20), now).ok).toBe(false);
  });
  it("blocks cancelling a used ticket", () => {
    expect(canCancel("used", new Date(2026, 0, 6), now).ok).toBe(false);
  });
  it("rejects departures in the past and more than 30 days ahead", () => {
    expect(validateTravelTime(new Date(2026, 0, 5, 11, 0), now)).not.toBeNull();
    expect(validateTravelTime(new Date(2026, 1, 10), now)).not.toBeNull();
    expect(validateTravelTime(new Date(2026, 0, 6), now)).toBeNull();
  });
  it("multiplies fare by passengers", () => {
    expect(bookingTotal(27, 3)).toBe(81);
  });
  it("creates booking codes in the ST-XXXXXXXX format", () => {
    expect(makeBookingCode()).toMatch(/^ST-[A-HJ-NP-Z2-9]{8}$/);
  });
});

describe("simulated tracking", () => {
  it("shows no position for buses that are not active", () => {
    expect(simulateBusPosition(bus("x", "R1", { status: "maintenance" }), r1, Date.now())).toBeNull();
  });
});
