import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bus, Clock, IndianRupee, MapPin } from "lucide-react";
import { ErrorBlock, LoadingBlock, PageHeader, RouteBadge } from "@/components/transit-ui";
import { formatFare, formatKm, formatMinutes, routeSummary } from "@/lib/transit";
import { useNetwork } from "@/lib/transit-data";

export const Route = createFileRoute("/routes/")({
  head: () => ({
    meta: [
      { title: "Bus Routes — SmartTransit" },
      { name: "description", content: "Browse all bus routes with stops, distance, estimated travel time and fare." },
      { property: "og:title", content: "Bus Routes — SmartTransit" },
      { property: "og:description", content: "All bus routes with stops, travel time and fares." },
    ],
  }),
  component: RoutesPage,
});

function RoutesPage() {
  const { data, isLoading, error } = useNetwork();
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <PageHeader title="Bus routes" description="Every route in the network. Open a route to see its stops, timings and map." />
      {error ? (
        <ErrorBlock message={error.message} />
      ) : isLoading || !data ? (
        <LoadingBlock />
      ) : data.routes.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">No routes yet. Add one from the Admin page.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.routes.map((r) => {
            const s = routeSummary(r);
            const busCount = data.buses.filter((b) => b.route_id === r.id).length;
            return (
              <Link
                key={r.id}
                to="/routes/$routeId"
                params={{ routeId: r.id }}
                className="group rounded-2xl border bg-card p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-elevated"
              >
                <div className="flex items-center justify-between">
                  <RouteBadge number={r.route_number} color={r.color} />
                  {!r.is_active && <span className="text-xs font-semibold text-muted-foreground">Not in service</span>}
                </div>
                <h2 className="mt-3 text-lg font-bold">{r.name}</h2>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.stops.map((x) => x.name).join(" → ")}</p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <span className="flex items-center gap-1.5"><MapPin className="size-4 text-primary" />{r.stops.length} stops · {formatKm(s.km)}</span>
                  <span className="flex items-center gap-1.5"><Clock className="size-4 text-primary" />{formatMinutes(s.minutes)}</span>
                  <span className="flex items-center gap-1.5"><IndianRupee className="size-4 text-primary" />{formatFare(s.fare)} full trip</span>
                  <span className="flex items-center gap-1.5"><Bus className="size-4 text-primary" />{busCount} bus(es)</span>
                </div>
                <div className="mt-4 flex items-center gap-1 text-sm font-semibold text-primary">
                  View route <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
