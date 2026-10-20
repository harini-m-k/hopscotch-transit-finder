// Reads and writes transport data in the database (Lovable Cloud).
// Reading is public; writing is only allowed for admins (enforced by database security rules).

import { queryOptions, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Bus, Route, Stop } from "./transit";

export type Network = { stops: Stop[]; routes: Route[]; buses: Bus[] };

async function fetchNetwork(): Promise<Network> {
  const [stopsRes, routesRes, rsRes, busesRes] = await Promise.all([
    supabase.from("stops").select("*").order("name"),
    supabase.from("routes").select("*").order("route_number"),
    supabase.from("route_stops").select("route_id, stop_id, stop_order").order("stop_order"),
    supabase.from("buses").select("*").order("bus_number"),
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
    stops: (rsRes.data ?? [])
      .filter((x) => x.route_id === r.id)
      .sort((a, b) => a.stop_order - b.stop_order)
      .map((x) => stopById.get(x.stop_id))
      .filter((s): s is Stop => !!s),
  }));
  return { stops, routes, buses: (busesRes.data ?? []) as Bus[] };
}

export const networkQuery = queryOptions({
  queryKey: ["network"],
  queryFn: fetchNetwork,
  staleTime: 30_000,
});

export function useNetwork() {
  return useQuery(networkQuery);
}

/** Current time, refreshed on an interval — drives the simulated bus movement. */
export function useNow(intervalMs = 2000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
