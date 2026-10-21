// Loads the whole transport network (stops, routes with ordered stops, buses) from the database.
// Works with any database client, so the same code runs in the browser and in secure server functions.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Bus, Route, Stop } from "./transit";

export type Network = { stops: Stop[]; routes: Route[]; buses: Bus[] };

export async function loadNetwork(client: SupabaseClient<Database>): Promise<Network> {
  const [stopsRes, routesRes, rsRes, busesRes] = await Promise.all([
    client.from("stops").select("*").order("name"),
    client.from("routes").select("*").order("route_number"),
    client.from("route_stops").select("route_id, stop_id, stop_order").order("stop_order"),
    client.from("buses").select("*").order("bus_number"),
  ]);
  const err = stopsRes.error || routesRes.error || rsRes.error || busesRes.error;
  if (err) throw new Error(err.message);

  const stops: Stop[] = (stopsRes.data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    area: s.area,
    latitude: Number(s.latitude),
    longitude: Number(s.longitude),
  }));
  const stopById = new Map(stops.map((s) => [s.id, s]));
  const routes: Route[] = (routesRes.data ?? []).map((r) => ({
    id: r.id,
    route_number: r.route_number,
    name: r.name,
    color: r.color,
    avg_speed_kmph: Number(r.avg_speed_kmph),
    base_fare: Number(r.base_fare),
    fare_per_km: Number(r.fare_per_km),
    is_active: r.is_active,
    first_departure: r.first_departure,
    last_departure: r.last_departure,
    frequency_min: r.frequency_min,
    stops: (rsRes.data ?? [])
      .filter((x) => x.route_id === r.id)
      .sort((a, b) => a.stop_order - b.stop_order)
      .map((x) => stopById.get(x.stop_id))
      .filter((s): s is Stop => !!s),
  }));
  const buses: Bus[] = (busesRes.data ?? []).map((b) => ({
    id: b.id,
    bus_number: b.bus_number,
    route_id: b.route_id,
    bus_type: b.bus_type,
    capacity: b.capacity,
    status: b.status,
    driver_name: b.driver_name,
    is_accessible: b.is_accessible,
  }));
  return { stops, routes, buses };
}
