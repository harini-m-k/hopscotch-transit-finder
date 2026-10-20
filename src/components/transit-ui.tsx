import type { ReactNode } from "react";
import { Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Stop } from "@/lib/transit";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function StatCard({ label, value, icon, hint }: { label: string; value: ReactNode; icon: ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-muted-foreground">{label}</span>
        <span className="grid size-10 place-items-center rounded-xl bg-secondary text-primary">{icon}</span>
      </div>
      <div className="mt-3 font-display text-3xl font-bold text-foreground">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function SimulatedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-warning/50 bg-sim px-2.5 py-1 text-xs font-bold text-sim-foreground",
        className,
      )}
    >
      <Radio className="size-3.5 pulse-dot" /> SIMULATED TRACKING · demo data, not real GPS
    </span>
  );
}

export function RouteBadge({ number, color }: { number: string; color: string }) {
  return (
    <span
      className="inline-flex min-w-12 items-center justify-center rounded-lg px-2 py-1 font-display text-sm font-bold text-primary-foreground"
      style={{ backgroundColor: color }}
    >
      {number}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-success/15 text-success border-success/30",
    maintenance: "bg-warning/20 text-warning-foreground border-warning/40",
    inactive: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={cn("capitalize", map[status] ?? map["inactive"])}>
      {status}
    </Badge>
  );
}

export function StopSelect({
  stops,
  value,
  onChange,
  placeholder,
  id,
}: {
  stops: Stop[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  id?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="h-11 bg-card">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {stops.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.name}
            {s.area && s.area !== s.name ? <span className="text-muted-foreground"> · {s.area}</span> : null}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function LoadingBlock({ label = "Loading data from the database…" }: { label?: string }) {
  return <div className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">{label}</div>;
}

export function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
      Could not load data: {message}
    </div>
  );
}
