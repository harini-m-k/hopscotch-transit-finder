import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { MapView } from "@/components/map/MapView";
import { ErrorBlock, LoadingBlock, RouteBadge, SimulatedBadge, StatusBadge } from "@/components/transit-ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { simulateFleet } from "@/lib/simulation";
import { DWELL_MINUTES, fareFor, formatFare, formatKm, formatMinutes, routeSegments, routeSummary } from "@/lib/transit";
import { useNetwork, useNow } from "@/lib/transit-data";

export const Route = createFileRoute("/routes/$routeId")({
  head: () => ({
    meta: [
      { title: "Route Details — SmartTransit" },
      { name: "description", content: "Stops, travel time, fare and map for this bus route." },
      { property: "og:title", content: "Route Details — SmartTransit" },
      { property: "og:description", content: "Stops, travel time, fare and map for this bus route." },
    ],
  }),
  component: RouteDetail,
});

function RouteDetail() {
  const { routeId } = Route.useParams();
  const { data, isLoading, error } = useNetwork();
  const now = useNow(2000);

  if (error) return <Wrap><ErrorBlock message={error.message} /></Wrap>;
  if (isLoading || !data) return <Wrap><LoadingBlock /></Wrap>;
  const route = data.routes.find((r) => r.id === routeId);
  if (!route)
    return (
      <Wrap>
        <div className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">This route does not exist (it may have been deleted).</div>
      </Wrap>
    );

  const summary = routeSummary(route);
  const segs = routeSegments(route);
  const buses = data.buses.filter((b) => b.route_id === route.id);
  const fleet = simulateFleet(buses, [route], now);

  // cumulative time/distance from first stop
  let cumKm = 0;
  let cumMin = 0;
  const rows = route.stops.map((s, i) => {
    if (i > 0) {
      cumKm += segs[i - 1]!.km;
      cumMin += segs[i - 1]!.minutes + (i > 1 ? DWELL_MINUTES : 0);
    }
    return { stop: s, km: cumKm, min: cumMin, fare: i === 0 ? 0 : fareFor(route, cumKm) };
  });

  return (
    <Wrap>
      <div className="flex flex-wrap items-center gap-3">
        <RouteBadge number={route.route_number} color={route.color} />
        <h1 className="text-2xl font-bold sm:text-3xl">{route.name}</h1>
        {!route.is_active && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">Not in service</span>}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Info label="Total distance" value={formatKm(summary.km)} />
        <Info label="Estimated time" value={formatMinutes(summary.minutes)} />
        <Info label="Full-trip fare" value={formatFare(summary.fare)} />
        <Info label="Fare rule" value={`₹${route.base_fare} + ₹${route.fare_per_km}/km`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border bg-card p-4 shadow-card">
            <h2 className="mb-2 text-lg font-bold">Stops ({route.stops.length})</h2>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Stop</TableHead>
                    <TableHead>From start</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Fare</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={r.stop.id}>
                      <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                      <TableCell>
                        <div className="font-medium">{r.stop.name}</div>
                        <div className="text-xs text-muted-foreground">{r.stop.area}</div>
                      </TableCell>
                      <TableCell>{formatKm(r.km)}</TableCell>
                      <TableCell>{formatMinutes(r.min)}</TableCell>
                      <TableCell>{i === 0 ? "—" : formatFare(r.fare)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Times assume an average speed of {route.avg_speed_kmph} km/h plus {DWELL_MINUTES} min at each stop.
            </p>
          </section>

          <section className="rounded-2xl border bg-card p-4 shadow-card">
            <h2 className="mb-2 text-lg font-bold">Buses on this route ({buses.length})</h2>
            <ul className="divide-y">
              {buses.map((b) => {
                const pos = fleet.find((f) => f.bus.id === b.id)?.position;
                return (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div>
                      <div className="text-sm font-semibold">{b.bus_number}</div>
                      <div className="text-xs text-muted-foreground">
                        {b.bus_type} · {b.capacity} seats · Driver: {b.driver_name || "—"}
                      </div>
                      {pos && <div className="text-xs text-primary">Simulated: heading to {pos.nextStopName}</div>}
                    </div>
                    <StatusBadge status={b.status} />
                  </li>
                );
              })}
              {buses.length === 0 && <li className="py-4 text-sm text-muted-foreground">No buses assigned.</li>}
            </ul>
          </section>
        </div>

        <section className="rounded-2xl border bg-card p-3 shadow-card">
          <div className="mb-2 flex justify-end"><SimulatedBadge /></div>
          <div className="h-[520px]">
            <MapView
              routes={[route]}
              stops={route.stops}
              buses={fleet.map((f) => ({
                id: f.bus.id,
                latitude: f.position.latitude,
                longitude: f.position.longitude,
                color: route.color,
                label: f.bus.bus_number,
                detail: `Next stop: ${f.position.nextStopName}`,
              }))}
            />
          </div>
        </section>
      </div>
    </Wrap>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Link to="/routes" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
        <ArrowLeft className="size-4" /> All routes
      </Link>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-3 shadow-card">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-lg font-bold">{value}</div>
    </div>
  );
}
