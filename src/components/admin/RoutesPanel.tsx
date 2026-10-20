import { ArrowDown, ArrowUp, Pencil, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { RouteBadge } from "@/components/transit-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { formatFare, formatKm, formatMinutes, routeSummary, type Route } from "@/lib/transit";
import type { Network } from "@/lib/transit-data";
import { ConfirmDelete, Field, FormError, friendlyError, useRefreshNetwork } from "./shared";

export function RoutesPanel({ network }: { network: Network }) {
  const [editing, setEditing] = useState<Route | null>(null);
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">Routes ({network.routes.length})</h2>
        <Button onClick={() => { setEditing(null); setFormKey((k) => k + 1); setOpen(true); }} disabled={network.stops.length < 2}>
          <Plus /> Add route
        </Button>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Route</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Stops</TableHead>
              <TableHead>Distance</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Fare</TableHead>
              <TableHead>In service</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {network.routes.map((r) => {
              const s = routeSummary(r);
              return (
                <TableRow key={r.id}>
                  <TableCell><RouteBadge number={r.route_number} color={r.color} /></TableCell>
                  <TableCell className="font-semibold">{r.name}</TableCell>
                  <TableCell>{r.stops.length}</TableCell>
                  <TableCell>{formatKm(s.km)}</TableCell>
                  <TableCell>{formatMinutes(s.minutes)}</TableCell>
                  <TableCell>{formatFare(s.fare)}</TableCell>
                  <TableCell>{r.is_active ? "Yes" : "No"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" aria-label={`Edit route ${r.route_number}`} onClick={() => { setEditing(r); setFormKey((k) => k + 1); setOpen(true); }}>
                      <Pencil />
                    </Button>
                    <ConfirmDelete
                      title={`Delete route ${r.route_number}?`}
                      description="The route and its stop list will be removed. Buses on this route become unassigned."
                      onConfirm={async () => supabase.from("routes").delete().eq("id", r.id)}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <RouteDialog key={`${editing?.id ?? "new"}-${formKey}`} open={open} onOpenChange={setOpen} route={editing} network={network} />
    </div>
  );
}

function RouteDialog({ open, onOpenChange, route, network }: { open: boolean; onOpenChange: (o: boolean) => void; route: Route | null; network: Network }) {
  const [num, setNum] = useState(route?.route_number ?? "");
  const [name, setName] = useState(route?.name ?? "");
  const [color, setColor] = useState(route?.color ?? "#2563eb");
  const [speed, setSpeed] = useState(String(route?.avg_speed_kmph ?? 20));
  const [base, setBase] = useState(String(route?.base_fare ?? 10));
  const [perKm, setPerKm] = useState(String(route?.fare_per_km ?? 1.5));
  const [active, setActive] = useState(route?.is_active ?? true);
  const [stopIds, setStopIds] = useState<string[]>(route?.stops.map((s) => s.id) ?? []);
  const [pick, setPick] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = useRefreshNetwork();
  const stopById = new Map(network.stops.map((s) => [s.id, s]));
  const available = network.stops.filter((s) => !stopIds.includes(s.id));

  const move = (i: number, d: -1 | 1) =>
    setStopIds((ids) => {
      const n = [...ids];
      [n[i], n[i + d]] = [n[i + d]!, n[i]!];
      return n;
    });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const sp = Number(speed), bf = Number(base), pk = Number(perKm);
    if (!num.trim() || !name.trim()) return setError("Route number and name are required.");
    if (!(sp > 0) || !(bf >= 0) || !(pk >= 0)) return setError("Speed must be above 0 and fares cannot be negative.");
    if (stopIds.length < 2) return setError("Add at least 2 stops to the route.");
    setBusy(true);
    setError(null);
    const payload = { route_number: num.trim().toUpperCase(), name: name.trim(), color, avg_speed_kmph: sp, base_fare: bf, fare_per_km: pk, is_active: active };

    let routeId = route?.id;
    if (route) {
      const { error } = await supabase.from("routes").update(payload).eq("id", route.id);
      if (error) { setBusy(false); return setError(friendlyError(error.message)); }
    } else {
      const { data, error } = await supabase.from("routes").insert(payload).select("id").single();
      if (error) { setBusy(false); return setError(friendlyError(error.message)); }
      routeId = data.id;
    }
    const { error: stopsErr } = await supabase.rpc("set_route_stops", { _route_id: routeId!, _stop_ids: stopIds });
    setBusy(false);
    if (stopsErr) {
      refresh();
      return setError(`Route details saved, but the stop list failed: ${friendlyError(stopsErr.message)}`);
    }
    toast.success(route ? "Route updated" : "Route added");
    refresh();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{route ? `Edit route ${route.route_number}` : "Add a route"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Field label="Route number" htmlFor="r-num"><Input id="r-num" placeholder="e.g. 21G" value={num} onChange={(e) => setNum(e.target.value)} required /></Field>
          <Field label="Route name" htmlFor="r-name"><Input id="r-name" placeholder="Start – End" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
          <Field label="Average speed (km/h)" htmlFor="r-speed"><Input id="r-speed" type="number" step="any" min={1} value={speed} onChange={(e) => setSpeed(e.target.value)} required /></Field>
          <Field label="Map colour" htmlFor="r-color"><Input id="r-color" type="color" className="h-9 p-1" value={color} onChange={(e) => setColor(e.target.value)} /></Field>
          <Field label="Base fare (₹)" htmlFor="r-base"><Input id="r-base" type="number" step="any" min={0} value={base} onChange={(e) => setBase(e.target.value)} required /></Field>
          <Field label="Fare per km (₹)" htmlFor="r-perkm"><Input id="r-perkm" type="number" step="any" min={0} value={perKm} onChange={(e) => setPerKm(e.target.value)} required /></Field>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch id="r-active" checked={active} onCheckedChange={setActive} />
            <label htmlFor="r-active" className="text-sm font-medium">Route is in service</label>
          </div>

          <div className="sm:col-span-2">
            <div className="mb-1.5 text-sm font-medium">Stops in travel order ({stopIds.length})</div>
            <ol className="space-y-1.5">
              {stopIds.map((id, i) => (
                <li key={id} className="flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5">
                  <span className="w-6 text-xs font-bold text-muted-foreground">{i + 1}</span>
                  <span className="flex-1 text-sm">{stopById.get(id)?.name}</span>
                  <Button type="button" variant="ghost" size="icon" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button>
                  <Button type="button" variant="ghost" size="icon" aria-label="Move down" disabled={i === stopIds.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove stop" onClick={() => setStopIds((ids) => ids.filter((x) => x !== id))}><X /></Button>
                </li>
              ))}
              {stopIds.length === 0 && <li className="text-sm text-muted-foreground">No stops added yet.</li>}
            </ol>
            <div className="mt-2 flex gap-2">
              <Select value={pick} onValueChange={setPick}>
                <SelectTrigger aria-label="Choose a stop to add"><SelectValue placeholder="Choose a stop to add" /></SelectTrigger>
                <SelectContent>{available.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
              <Button type="button" variant="secondary" disabled={!pick} onClick={() => { setStopIds((ids) => [...ids, pick]); setPick(""); }}>
                <Plus /> Add
              </Button>
            </div>
          </div>

          <div className="sm:col-span-2"><FormError message={error} /></div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : route ? "Save changes" : "Add route"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
