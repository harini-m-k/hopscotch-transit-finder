// Interactive map (Leaflet + OpenStreetMap). Browser-only — loaded through MapView.
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import type { TransitMapProps } from "./types";

const BUS_SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M8 6v6\"/><path d=\"M15 6v6\"/><path d=\"M2 12h19.6\"/><path d=\"M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3\"/><circle cx=\"7\" cy=\"18\" r=\"2\"/><path d=\"M9 18h5\"/><circle cx=\"16\" cy=\"18\" r=\"2\"/></svg>";

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = points.map((p) => p.join(",")).join(";");
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) map.setView(points[0]!, 14);
    else map.fitBounds(L.latLngBounds(points), { padding: [30, 30] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onClick(e.latlng.lat, e.latlng.lng) });
  return null;
}

export default function TransitMap({
  routes,
  stops,
  buses = [],
  highlightStopIds = [],
  pickedPoint,
  onMapClick,
  fitTo,
  className,
}: TransitMapProps) {
  const fitPoints = useMemo<[number, number][]>(() => {
    if (fitTo) return fitTo;
    const pts = stops.map((s) => [s.latitude, s.longitude] as [number, number]);
    if (pickedPoint) pts.push([pickedPoint.latitude, pickedPoint.longitude]);
    return pts;
  }, [fitTo, stops, pickedPoint]);

  const highlight = new Set(highlightStopIds);
  const center: [number, number] = fitPoints[0] ?? [13.05, 80.24];

  return (
    <MapContainer center={center} zoom={12} scrollWheelZoom className={className ?? ""} style={{ minHeight: 280 }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={fitPoints} />
      {onMapClick && <ClickHandler onClick={onMapClick} />}

      {routes.map((r) => (
        <Polyline
          key={r.id}
          positions={r.stops.map((s) => [s.latitude, s.longitude] as [number, number])}
          pathOptions={{ color: r.color, weight: r.emphasis ? 7 : 4, opacity: r.dimmed ? 0.25 : 0.85 }}
        >
          <Tooltip sticky>
            Route {r.route_number}: {r.name}
          </Tooltip>
        </Polyline>
      ))}

      {stops.map((s) => (
        <CircleMarker
          key={s.id}
          center={[s.latitude, s.longitude]}
          radius={highlight.has(s.id) ? 8 : 5}
          pathOptions={{
            color: highlight.has(s.id) ? "#1e3a8a" : "#1d4ed8",
            fillColor: "#ffffff",
            fillOpacity: 1,
            weight: highlight.has(s.id) ? 4 : 2,
          }}
        >
          <Tooltip direction="top" offset={[0, -6]}>
            {s.name}
          </Tooltip>
        </CircleMarker>
      ))}

      {buses.map((b) => (
        <Marker
          key={b.id}
          position={[b.latitude, b.longitude]}
          icon={L.divIcon({
            className: "",
            html: `<div class="bus-marker" style="background:${b.color}">${BUS_SVG}</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          })}
        >
          <Popup>
            <strong>{b.label}</strong>
            <br />
            {b.detail}
            <br />
            <em>Simulated position (demo data)</em>
          </Popup>
        </Marker>
      ))}

      {pickedPoint && (
        <CircleMarker
          center={[pickedPoint.latitude, pickedPoint.longitude]}
          radius={9}
          pathOptions={{ color: "#dc2626", fillColor: "#dc2626", fillOpacity: 0.6 }}
        >
          <Tooltip permanent direction="top" offset={[0, -8]}>
            Selected location
          </Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  );
}
