import { createFileRoute } from "@tanstack/react-router";
import { Bus, MapPin, Route as RouteIcon, ShieldAlert } from "lucide-react";
import { BusesPanel } from "@/components/admin/BusesPanel";
import { RoutesPanel } from "@/components/admin/RoutesPanel";
import { StopsPanel } from "@/components/admin/StopsPanel";
import { ErrorBlock, LoadingBlock, PageHeader, StatCard } from "@/components/transit-ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsAdmin, useSession } from "@/lib/auth";
import { useNetwork } from "@/lib/transit-data";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — SmartTransit" },
      { name: "description", content: "Add, edit and delete buses, routes and bus stops." },
      { property: "og:title", content: "Admin Dashboard — SmartTransit" },
      { property: "og:description", content: "Manage the public transport network." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { user, ready } = useSession();
  const isAdmin = useIsAdmin(user?.id);
  const { data, isLoading, error } = useNetwork();

  if (!ready || isAdmin.isLoading) return <Shell><LoadingBlock label="Checking your access…" /></Shell>;
  if (isAdmin.error) return <Shell><ErrorBlock message={isAdmin.error.message} /></Shell>;
  if (!isAdmin.data)
    return (
      <Shell>
        <div className="rounded-2xl border bg-card p-8 text-center shadow-card">
          <ShieldAlert className="mx-auto size-10 text-warning" />
          <h2 className="mt-3 text-lg font-bold">No admin access</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You are signed in as {user?.email}, but this account is not an administrator. Only the first account created
            has admin rights.
          </p>
        </div>
      </Shell>
    );

  return (
    <Shell>
      {error ? (
        <ErrorBlock message={error.message} />
      ) : isLoading || !data ? (
        <LoadingBlock />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <StatCard label="Buses" value={data.buses.length} icon={<Bus className="size-5" />} />
            <StatCard label="Routes" value={data.routes.length} icon={<RouteIcon className="size-5" />} />
            <StatCard label="Bus stops" value={data.stops.length} icon={<MapPin className="size-5" />} />
          </div>
          <Tabs defaultValue="buses">
            <TabsList className="mb-4">
              <TabsTrigger value="buses">Buses</TabsTrigger>
              <TabsTrigger value="routes">Routes</TabsTrigger>
              <TabsTrigger value="stops">Bus stops</TabsTrigger>
            </TabsList>
            <TabsContent value="buses"><BusesPanel network={data} /></TabsContent>
            <TabsContent value="routes"><RoutesPanel network={data} /></TabsContent>
            <TabsContent value="stops"><StopsPanel network={data} /></TabsContent>
          </Tabs>
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <PageHeader title="Admin dashboard" description="Changes are saved to the database immediately and appear on every page." />
      {children}
    </div>
  );
}
