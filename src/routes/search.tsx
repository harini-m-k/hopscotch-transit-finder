import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, ArrowUpDown, Clock, IndianRupee, Repeat, Route as RouteIcon, Search, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { MapView } from "@/components/map/MapView";
import { ErrorBlock, LoadingBlock, PageHeader, RouteBadge, StatusBadge, StopSelect } from "@/components/transit-ui";
import { Button } from "@/components/ui/button";
import { findDirectRoutes, findShortestJourney, TRANSFER_PENALTY_MINUTES } from "@/lib/route-planner";
import { formatFare, formatKm, formatMinutes } from "@/lib/transit";
import { useNetwork } from "@/lib/transit-data";

type SearchParams = { from?: string | undefined; to?: string | undefined };

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    from: typeof s["from"] === "string" ? s["from"] : undefined,
    to: typeof s["to"] === "string" ? s["to"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Search Buses — SmartTransit" },
      { name: "description", content: "Search buses between two stops and get the shortest suggested route with fare and time." },
      { property: "og:title", content: "Search Buses — SmartTransit" },
      { property: "og:description", content: "Find direct buses and the fastest route between any two stops." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { from = "", to = "" } = Route.useSearch();
  const navigate = useNavigate({ from: "/search" });
  const { data, isLoading, error } = useNetwork();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  useEffect(() => {
    setF(from);
    setT(to);
  }, [from, to]);

  const searched = !!data && !!from && !!to && from !== to;
  const direct = searched ? findDirectRoutes(data.routes, from, to) : [];
  const journey = searched ? findShortestJourney(data.routes, from, to) : null;
  const stopName = (id: string) => data?.stops.find((s) => s.id === id)?.name ?? "";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Search buses"
        description="Pick a starting stop and a destination. We list every direct bus and suggest the fastest journey, even if it needs a change of bus."
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (f && t) navigate({ search: { from: f, to: t } });
        }}
        className="grid gap-3 rounded-2xl border bg-card p-4 shadow-card sm:grid-cols-[1fr_auto_1fr_auto] sm:items-end"
      >
        <div>
          <label htmlFor="s-from" className="mb-1.5 block text-xs font-bold uppercase text-muted-foreground">From</label>
          <StopSelect id="s-from" stops={data?.stops ?? []} value={f} onChange={setF} placeholder="Starting stop" />
        </div>
        <Button type="button" variant="ghost" size="icon" className="mx-auto" aria-label="Swap stops" onClick={() => { setF(t); setT(f); }}>
          <ArrowUpDown />
        </Button>
        <div>
          <label htmlFor="s-to" className="mb-1.5 block text-xs font-bold uppercase text-muted-foreground">To</label>
          <StopSelect id="s-to" stops={data?.stops ?? []} value={t} onChange={setT} placeholder="Destination stop" />
        </div>
        <Button type="submit" size="lg" className="h-11" disabled={!f || !t || f === t}>
          <Search /> Search
        </Button>
      </form>
      {f && t && f === t && <p className="mt-2 text-sm text-destructive">Starting stop and destination must be different.</p>}

      <div className="mt-8">
        {error ? (
          <ErrorBlock message={error.message} />
        ) : isLoading || !data ? (
          <LoadingBlock />
        ) : !searched ? (
          <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
            Choose two stops above to see buses, fares and the suggested route.
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
            <div className="space-y-6">
              {/* Suggested shortest route */}
              <section className="rounded-2xl border-2 border-primary/30 bg-card p-5 shadow-elevated">
                <div className="flex items-center gap-2 text-primary">
                  <Sparkles className="size-5" />
                  <h2 className="text-lg font-bold">Suggested fastest route</h2>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {stopName(from)} → {stopName(to)}
                </p>
                {!journey ? (
                  <p className="mt-4 text-sm text-destructive">No bus connection exists between these stops.</p>
                ) : (
                  <>
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <Metric icon={<Clock className="size-4" />} label="Travel time" value={formatMinutes(journey.totalMinutes)} />
                      <Metric icon={<RouteIcon className="size-4" />} label="Distance" value={formatKm(journey.totalKm)} />
                      <Metric icon={<IndianRupee className="size-4" />} label="Total fare" value={formatFare(journey.totalFare)} />
                      <Metric icon={<Repeat className="size-4" />} label="Changes" value={String(journey.transfers)} />
                    </div>
                    <ol className="mt-5 space-y-3">
                      {journey.legs.map((leg, i) => (
                        <li key={i} className="rounded-xl border bg-background p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-muted-foreground">STEP {i + 1}</span>
                            <RouteBadge number={leg.route.route_number} color={leg.route.color} />
                            <span className="text-sm font-semibold">
                              {leg.stops[0]?.name} <ArrowRight className="inline size-3.5" /> {leg.stops[leg.stops.length - 1]?.name}
                            </span>
                          </div>
                          <div className="mt-1.5 text-xs text-muted-foreground">
                            {leg.stops.length - 1} stop(s) · {formatKm(leg.km)} · {formatMinutes(leg.minutes)} · {formatFare(leg.fare)}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">Via: {leg.stops.map((s) => s.name).join(" → ")}</div>
                          {i < journey.legs.length - 1 && (
                            <div className="mt-2 text-xs font-semibold text-warning-foreground">
                              Change bus at {leg.stops[leg.stops.length - 1]?.name} (allow ~{TRANSFER_PENALTY_MINUTES} min)
                            </div>
                          )}
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </section>

              {/* Direct buses */}
              <section className="rounded-2xl border bg-card p-5 shadow-card">
                <h2 className="text-lg font-bold">Direct buses ({direct.length})</h2>
                {direct.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No single bus goes between these stops. Use the suggested route above.</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {direct.map((d) => {
                      const buses = data.buses.filter((b) => b.route_id === d.route.id);
                      return (
                        <li key={d.route.id} className="rounded-xl border p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <RouteBadge number={d.route.route_number} color={d.route.color} />
                              <Link to="/routes/$routeId" params={{ routeId: d.route.id }} className="text-sm font-semibold hover:text-primary hover:underline">
                                {d.route.name}
                              </Link>
                            </div>
                            <span className="text-sm font-bold text-primary">{formatFare(d.fare)}</span>
                          </div>
                          <div className="mt-1.5 text-xs text-muted-foreground">
                            {d.stopsCount} stop(s) · {formatKm(d.km)} · about {formatMinutes(d.minutes)}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {buses.length === 0 && <span className="text-xs text-muted-foreground">No buses assigned</span>}
                            {buses.map((b) => (
                              <span key={b.id} className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2 py-1 text-xs font-medium">
                                {b.bus_number} · {b.bus_type} <StatusBadge status={b.status} />
                              </span>
                            ))}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>

            <div className="h-[520px] rounded-2xl border bg-card p-3 shadow-card lg:sticky lg:top-24">
              <MapView
                routes={(journey?.legs ?? []).map((l, i) => ({
                  id: `${l.route.id}-${i}`,
                  route_number: l.route.route_number,
                  name: l.route.name,
                  color: l.route.color,
                  stops: l.stops,
                  emphasis: true,
                }))}
                stops={journey ? [...new Map(journey.legs.flatMap((l) => l.stops).map((s) => [s.id, s])).values()] : []}
                highlightStopIds={[from, to]}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-secondary-foreground/80">
        {icon} {label}
      </div>
      <div className="mt-1 font-display text-lg font-bold text-secondary-foreground">{value}</div>
    </div>
  );
}
