// Loads the Leaflet map only in the browser (Leaflet needs `window`).
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { cn } from "@/lib/utils";
import type { TransitMapProps } from "./types";

const TransitMap = lazy(() => import("./TransitMap"));

export function MapView(props: TransitMapProps) {
  const cls = cn("h-full w-full rounded-xl", props.className);
  const fallback = (
    <div className={cn(cls, "grid place-items-center bg-muted text-sm text-muted-foreground")}>Loading map…</div>
  );
  return (
    <ClientOnly fallback={fallback}>
      <Suspense fallback={fallback}>
        <TransitMap {...props} className={cls} />
      </Suspense>
    </ClientOnly>
  );
}
