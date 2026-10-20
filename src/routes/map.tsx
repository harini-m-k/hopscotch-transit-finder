import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MapView } from "@/components/map/MapView";
import { ErrorBlock, LoadingBlock, PageHeader, RouteBadge, SimulatedBadge } from "@/components/transit-ui";
import { Button } from "@/components/ui/button";
import { simulateFleet } from "@/lib/simulation";
import { useNetwork, useNow } from "@/lib/transit-data";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Live Map (Simulated Tracking) — SmartTransit" },
      { name: "description", content: "Interactive map of all bus routes and stops with simulated bus positions." },
      { property: "og:title", content: "Live Map — SmartTransit" },
      { property: "og:description", content: "All routes and stops on an interactive map with simulated bus tracking." },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  const { data, isLoading, error } = useNetwork();
  const now = useNow(1500);
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Live map"
        description="Bus positions here are calculated from the timetable and sped up 20× so you can see them move. They are not real GPS data."
        actions={<SimulatedBadge />}
      />
      {error ? (
        <ErrorBlock message={error.message} />
      ) : isLoading || !data ? (
        <LoadingBlock />
      ) : (
        (() => {
          const shownRoutes = data.routes.filter((r) => r.is_active);
          const fleet = simulateFleet(data.buses, data.routes, now).filter((f) => !selected || f.route.id === selected);
          return (
            <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
              <aside className="space-y-4">
                <div className="rounded-2xl border bg-card p-4 shadow-card">
                  <h2 className="mb-2 text-sm font-bold uppercase text-muted-foreground">Filter by route</h2>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant={selected === null ? "default" : "outline"} onClick={() => setSelected(null)}>
                      All
                    </Button>
                    {shownRoutes.map((r) => (
                      <Button key={r.id} size="sm" variant={selected === r.id ? "default" : "outline"} onClick={() => setSelected(r.id)}>
                        {r.route_number}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border bg-card p-4 shadow-card">
                  <h2 className="mb-2 text-sm font-bold uppercase text-muted-foreground">Buses ({fleet.length})</h2>
                  <ul className="max-h-[440px] divide-y overflow-auto">
                    {fleet.map((f) => (
                      <li key={f.bus.id} className="flex items-center gap-3 py-2">
                        <RouteBadge number={f.route.route_number} color={f.route.color} />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{f.bus.bus_number}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {f.position.previousStopName} → {f.position.nextStopName}
                          </div>
                        </div>
                      </li>
                    ))}
                    {fleet.length === 0 && <li className="py-4 text-sm text-muted-foreground">No active buses.</li>}
                  </ul>
                </div>
              </aside>
              <div className="h-[640px] rounded-2xl border bg-card p-3 shadow-card">
                <MapView
                  routes={shownRoutes.map((r) => ({ ...r, dimmed: !!selected && r.id !== selected, emphasis: r.id === selected }))}
                  stops={data.stops}
                  fitTo={data.stops.map((s) => [s.latitude, s.longitude] as [number, number])}
                  buses={fleet.map((f) => ({
                    id: f.bus.id,
                    latitude: f.position.latitude,
                    longitude: f.position.longitude,
                    color: f.route.color,
                    label: `${f.bus.bus_number} · Route ${f.route.route_number}`,
                    detail: `Next stop: ${f.position.nextStopName} (${f.position.direction})`,
                  }))}
                />
              </div>
            </div>
          );
        })()
      )}
    </div>
  );
}
