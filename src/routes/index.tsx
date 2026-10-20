import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, ArrowUpDown, Bus, MapPin, Route as RouteIcon, Search, Wrench } from "lucide-react";
import { useState } from "react";
import heroImg from "@/assets/hero-bus.jpg";
import { MapView } from "@/components/map/MapView";
import {
  ErrorBlock,
  LoadingBlock,
  RouteBadge,
  SimulatedBadge,
  StatCard,
  StatusBadge,
  StopSelect,
} from "@/components/transit-ui";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { simulateFleet } from "@/lib/simulation";
import { formatFare, formatKm, formatMinutes, routeSummary } from "@/lib/transit";
import { useNetwork, useNow } from "@/lib/transit-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — SmartTransit Public Transport System" },
      {
        name: "description",
        content: "Live overview of buses, routes and stops with journey search and simulated bus tracking.",
      },
      { property: "og:title", content: "SmartTransit Dashboard" },
      { property: "og:description", content: "Public transport dashboard with route search and live map." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data, isLoading, error } = useNetwork();
  const now = useNow(2000);
  const navigate = useNavigate();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const fleet = data ? simulateFleet(data.buses, data.routes, now) : [];
  const activeBuses = data?.buses.filter((b) => b.status === "active").length ?? 0;
  const maintenance = data?.buses.filter((b) => b.status === "maintenance").length ?? 0;

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <img src={heroImg} alt="City bus on a wide road" width={1600} height={912} className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-hero-overlay" />
        <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-14 sm:px-6 sm:pt-20">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary-foreground/80">PE II Project</p>
          <h1 className="mt-3 max-w-2xl text-3xl font-extrabold leading-tight text-primary-foreground sm:text-5xl">
            Smart Public Transport Management & Route Optimization
          </h1>
          <p className="mt-4 max-w-xl text-primary-foreground/85">
            Find the fastest bus between any two stops, see fares and travel times, and follow buses on the map.
          </p>
        </div>
      </section>

      <div className="mx-auto -mt-14 max-w-7xl px-4 pb-16 sm:px-6">
        {/* Quick search */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!from || !to) return;
            navigate({ to: "/search", search: { from, to } });
          }}
          className="relative grid gap-3 rounded-2xl border bg-card p-4 shadow-elevated sm:grid-cols-[1fr_auto_1fr_auto] sm:items-end sm:p-5"
        >
          <div>
            <label htmlFor="q-from" className="mb-1.5 block text-xs font-bold uppercase text-muted-foreground">
              From
            </label>
            <StopSelect id="q-from" stops={data?.stops ?? []} value={from} onChange={setFrom} placeholder="Starting stop" />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mx-auto"
            aria-label="Swap stops"
            onClick={() => {
              setFrom(to);
              setTo(from);
            }}
          >
            <ArrowUpDown />
          </Button>
          <div>
            <label htmlFor="q-to" className="mb-1.5 block text-xs font-bold uppercase text-muted-foreground">
              To
            </label>
            <StopSelect id="q-to" stops={data?.stops ?? []} value={to} onChange={setTo} placeholder="Destination stop" />
          </div>
          <Button type="submit" size="lg" className="h-11" disabled={!from || !to || from === to}>
            <Search /> Find buses
          </Button>
        </form>

        {error ? (
          <div className="mt-8">
            <ErrorBlock message={error.message} />
          </div>
        ) : isLoading || !data ? (
          <div className="mt-8">
            <LoadingBlock />
          </div>
        ) : (
          <>
            <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total buses" value={data.buses.length} icon={<Bus className="size-5" />} hint={`${activeBuses} active now`} />
              <StatCard label="Routes" value={data.routes.length} icon={<RouteIcon className="size-5" />} hint={`${data.routes.filter((r) => r.is_active).length} in service`} />
              <StatCard label="Bus stops" value={data.stops.length} icon={<MapPin className="size-5" />} hint="Across the city" />
              <StatCard label="In maintenance" value={maintenance} icon={<Wrench className="size-5" />} hint="Not on the road" />
            </section>

            <section className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
              <div className="rounded-2xl border bg-card p-4 shadow-card">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-bold">Network map</h2>
                  <SimulatedBadge />
                </div>
                <div className="h-[420px]">
                  <MapView
                    routes={data.routes}
                    stops={data.stops}
                    buses={fleet.map((f) => ({
                      id: f.bus.id,
                      latitude: f.position.latitude,
                      longitude: f.position.longitude,
                      color: f.route.color,
                      label: `${f.bus.bus_number} · Route ${f.route.route_number}`,
                      detail: `Next stop: ${f.position.nextStopName}`,
                    }))}
                  />
                </div>
              </div>

              <div className="rounded-2xl border bg-card p-4 shadow-card">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-bold">Buses on the road</h2>
                  <Link to="/map" className="text-sm font-semibold text-primary hover:underline">
                    Open live map
                  </Link>
                </div>
                <ul className="max-h-[420px] divide-y overflow-auto">
                  {fleet.map((f) => (
                    <li key={f.bus.id} className="flex items-center gap-3 py-2.5">
                      <RouteBadge number={f.route.route_number} color={f.route.color} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{f.bus.bus_number}</div>
                        <div className="truncate text-xs text-muted-foreground">Next stop: {f.position.nextStopName}</div>
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground">{Math.round(f.position.progress * 100)}%</span>
                    </li>
                  ))}
                  {fleet.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No active buses.</li>}
                </ul>
              </div>
            </section>

            <section className="mt-8 rounded-2xl border bg-card p-4 shadow-card">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold">All routes</h2>
                <Link to="/routes" className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                  View details <ArrowRight className="size-4" />
                </Link>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Route</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Stops</TableHead>
                      <TableHead>Distance</TableHead>
                      <TableHead>Est. time</TableHead>
                      <TableHead>Full fare</TableHead>
                      <TableHead>Buses</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.routes.map((r) => {
                      const s = routeSummary(r);
                      const buses = data.buses.filter((b) => b.route_id === r.id);
                      return (
                        <TableRow key={r.id}>
                          <TableCell>
                            <RouteBadge number={r.route_number} color={r.color} />
                          </TableCell>
                          <TableCell className="font-medium">
                            <Link to="/routes/$routeId" params={{ routeId: r.id }} className="hover:text-primary hover:underline">
                              {r.name}
                            </Link>
                          </TableCell>
                          <TableCell>{r.stops.length}</TableCell>
                          <TableCell>{formatKm(s.km)}</TableCell>
                          <TableCell>{formatMinutes(s.minutes)}</TableCell>
                          <TableCell>{formatFare(s.fare)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {buses.length === 0 && <span className="text-xs text-muted-foreground">None</span>}
                              {buses.map((b) => (
                                <StatusBadge key={b.id} status={b.status} />
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
