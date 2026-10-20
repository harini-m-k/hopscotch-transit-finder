import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { MapView } from "@/components/map/MapView";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import type { Stop } from "@/lib/transit";
import type { Network } from "@/lib/transit-data";
import { ConfirmDelete, Field, FormError, friendlyError, useRefreshNetwork } from "./shared";

export function StopsPanel({ network }: { network: Network }) {
  const [editing, setEditing] = useState<Stop | null>(null);
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const routesUsing = (id: string) => network.routes.filter((r) => r.stops.some((s) => s.id === id));

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">Bus stops ({network.stops.length})</h2>
        <Button onClick={() => { setEditing(null); setFormKey((k) => k + 1); setOpen(true); }}>
          <Plus /> Add stop
        </Button>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Area</TableHead>
              <TableHead>Latitude</TableHead>
              <TableHead>Longitude</TableHead>
              <TableHead>Used by routes</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {network.stops.map((s) => {
              const used = routesUsing(s.id);
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-semibold">{s.name}</TableCell>
                  <TableCell>{s.area || "—"}</TableCell>
                  <TableCell>{s.latitude.toFixed(4)}</TableCell>
                  <TableCell>{s.longitude.toFixed(4)}</TableCell>
                  <TableCell>{used.length ? used.map((r) => r.route_number).join(", ") : <span className="text-muted-foreground">None</span>}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" aria-label={`Edit ${s.name}`} onClick={() => { setEditing(s); setFormKey((k) => k + 1); setOpen(true); }}>
                      <Pencil />
                    </Button>
                    <ConfirmDelete
                      title={`Delete stop ${s.name}?`}
                      description={
                        used.length
                          ? `This stop is used by route(s) ${used.map((r) => r.route_number).join(", ")}. It will be removed from those routes too.`
                          : "This permanently removes the stop from the database."
                      }
                      onConfirm={async () => supabase.from("stops").delete().eq("id", s.id)}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <StopDialog key={`${editing?.id ?? "new"}-${formKey}`} open={open} onOpenChange={setOpen} stop={editing} network={network} />
    </div>
  );
}

function StopDialog({ open, onOpenChange, stop, network }: { open: boolean; onOpenChange: (o: boolean) => void; stop: Stop | null; network: Network }) {
  const [name, setName] = useState(stop?.name ?? "");
  const [area, setArea] = useState(stop?.area ?? "");
  const [lat, setLat] = useState(stop ? String(stop.latitude) : "");
  const [lng, setLng] = useState(stop ? String(stop.longitude) : "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = useRefreshNetwork();

  const latN = Number(lat);
  const lngN = Number(lng);
  const validPoint = lat !== "" && lng !== "" && Number.isFinite(latN) && Number.isFinite(lngN) && Math.abs(latN) <= 90 && Math.abs(lngN) <= 180;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Stop name is required.");
    if (!validPoint) return setError("Enter a valid latitude (-90 to 90) and longitude (-180 to 180), or click on the map.");
    setBusy(true);
    setError(null);
    const payload = { name: name.trim(), area: area.trim(), latitude: latN, longitude: lngN };
    const { error } = stop
      ? await supabase.from("stops").update(payload).eq("id", stop.id)
      : await supabase.from("stops").insert(payload);
    setBusy(false);
    if (error) return setError(friendlyError(error.message));
    toast.success(stop ? "Stop updated" : "Stop added");
    refresh();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{stop ? `Edit stop ${stop.name}` : "Add a bus stop"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Field label="Stop name" htmlFor="s-name">
            <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Area" htmlFor="s-area">
            <Input id="s-area" value={area} onChange={(e) => setArea(e.target.value)} />
          </Field>
          <Field label="Latitude" htmlFor="s-lat">
            <Input id="s-lat" type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} required />
          </Field>
          <Field label="Longitude" htmlFor="s-lng">
            <Input id="s-lng" type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} required />
          </Field>
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Tip: click on the map to fill in the coordinates.</p>
            <div className="h-64">
              <MapView
                routes={[]}
                stops={network.stops.filter((s) => s.id !== stop?.id)}
                pickedPoint={validPoint ? { latitude: latN, longitude: lngN } : null}
                fitTo={validPoint ? [[latN, lngN]] : network.stops.map((s) => [s.latitude, s.longitude] as [number, number])}
                onMapClick={(la, ln) => {
                  setLat(la.toFixed(5));
                  setLng(ln.toFixed(5));
                }}
              />
            </div>
          </div>
          <div className="sm:col-span-2"><FormError message={error} /></div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : stop ? "Save changes" : "Add stop"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
