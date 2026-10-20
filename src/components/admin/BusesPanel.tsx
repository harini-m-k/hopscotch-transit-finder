import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { RouteBadge, StatusBadge } from "@/components/transit-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import type { Bus } from "@/lib/transit";
import type { Network } from "@/lib/transit-data";
import { ConfirmDelete, Field, FormError, friendlyError, useRefreshNetwork } from "./shared";

const TYPES = ["Ordinary", "Deluxe", "AC", "Electric"];
const STATUSES = ["active", "maintenance", "inactive"];
const NO_ROUTE = "__none__";

type FormState = { bus_number: string; route_id: string; bus_type: string; capacity: string; status: string; driver_name: string };
const empty: FormState = { bus_number: "", route_id: NO_ROUTE, bus_type: "Ordinary", capacity: "50", status: "active", driver_name: "" };

export function BusesPanel({ network }: { network: Network }) {
  const [editing, setEditing] = useState<Bus | null>(null);
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const routeById = new Map(network.routes.map((r) => [r.id, r]));

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">Buses ({network.buses.length})</h2>
        <Button onClick={() => { setEditing(null); setFormKey((k) => k + 1); setOpen(true); }}>
          <Plus /> Add bus
        </Button>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bus number</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Seats</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {network.buses.map((b) => {
              const r = b.route_id ? routeById.get(b.route_id) : undefined;
              return (
                <TableRow key={b.id}>
                  <TableCell className="font-semibold">{b.bus_number}</TableCell>
                  <TableCell>{r ? <RouteBadge number={r.route_number} color={r.color} /> : <span className="text-xs text-muted-foreground">Unassigned</span>}</TableCell>
                  <TableCell>{b.bus_type}</TableCell>
                  <TableCell>{b.capacity}</TableCell>
                  <TableCell>{b.driver_name || "—"}</TableCell>
                  <TableCell><StatusBadge status={b.status} /></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" aria-label={`Edit ${b.bus_number}`} onClick={() => { setEditing(b); setFormKey((k) => k + 1); setOpen(true); }}>
                      <Pencil />
                    </Button>
                    <ConfirmDelete
                      title={`Delete bus ${b.bus_number}?`}
                      description="This permanently removes the bus from the database."
                      onConfirm={async () => supabase.from("buses").delete().eq("id", b.id)}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
            {network.buses.length === 0 && (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No buses yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <BusDialog key={`${editing?.id ?? "new"}-${formKey}`} open={open} onOpenChange={setOpen} bus={editing} network={network} />
    </div>
  );
}

function BusDialog({ open, onOpenChange, bus, network }: { open: boolean; onOpenChange: (o: boolean) => void; bus: Bus | null; network: Network }) {
  const [form, setForm] = useState<FormState>(
    bus
      ? { bus_number: bus.bus_number, route_id: bus.route_id ?? NO_ROUTE, bus_type: bus.bus_type, capacity: String(bus.capacity), status: bus.status, driver_name: bus.driver_name }
      : empty,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = useRefreshNetwork();
  const set = (k: keyof FormState) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const capacity = Number(form.capacity);
    if (!form.bus_number.trim()) return setError("Bus number is required.");
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 200) return setError("Seats must be a whole number between 1 and 200.");
    setBusy(true);
    setError(null);
    const payload = {
      bus_number: form.bus_number.trim().toUpperCase(),
      route_id: form.route_id === NO_ROUTE ? null : form.route_id,
      bus_type: form.bus_type,
      capacity,
      status: form.status,
      driver_name: form.driver_name.trim(),
    };
    const { error } = bus
      ? await supabase.from("buses").update(payload).eq("id", bus.id)
      : await supabase.from("buses").insert(payload);
    setBusy(false);
    if (error) return setError(friendlyError(error.message));
    toast.success(bus ? "Bus updated" : "Bus added");
    refresh();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{bus ? `Edit bus ${bus.bus_number}` : "Add a bus"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Field label="Bus number" htmlFor="b-num">
            <Input id="b-num" placeholder="TN-01-AN-1234" value={form.bus_number} onChange={(e) => set("bus_number")(e.target.value)} required />
          </Field>
          <Field label="Route" htmlFor="b-route">
            <Select value={form.route_id} onValueChange={set("route_id")}>
              <SelectTrigger id="b-route"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_ROUTE}>Unassigned</SelectItem>
                {network.routes.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.route_number} — {r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Bus type" htmlFor="b-type">
            <Select value={form.bus_type} onValueChange={set("bus_type")}>
              <SelectTrigger id="b-type"><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Seats" htmlFor="b-cap">
            <Input id="b-cap" type="number" min={1} max={200} value={form.capacity} onChange={(e) => set("capacity")(e.target.value)} required />
          </Field>
          <Field label="Status" htmlFor="b-status">
            <Select value={form.status} onValueChange={set("status")}>
              <SelectTrigger id="b-status" className="capitalize"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Driver name" htmlFor="b-driver">
            <Input id="b-driver" value={form.driver_name} onChange={(e) => set("driver_name")(e.target.value)} />
          </Field>
          <div className="sm:col-span-2"><FormError message={error} /></div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : bus ? "Save changes" : "Add bus"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
