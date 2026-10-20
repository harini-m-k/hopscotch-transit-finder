import type { Stop } from "@/lib/transit";

export type MapRoute = {
  id: string;
  route_number: string;
  name: string;
  color: string;
  stops: Stop[];
  emphasis?: boolean;
  dimmed?: boolean;
};

export type MapBus = { id: string; latitude: number; longitude: number; color: string; label: string; detail: string };

export type TransitMapProps = {
  routes: MapRoute[];
  stops: Stop[];
  buses?: MapBus[];
  highlightStopIds?: string[];
  pickedPoint?: { latitude: number; longitude: number } | null;
  onMapClick?: (lat: number, lng: number) => void;
  fitTo?: [number, number][];
  className?: string;
};
