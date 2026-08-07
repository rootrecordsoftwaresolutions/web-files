import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { islandById } from "../data/catalog";
import { placesForIsland } from "../data/places";
import { useAppStore } from "../store/useAppStore";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Fix default marker paths in Vite bundler
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function Recenter({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom);
  }, [map, lat, lng, zoom]);
  return null;
}

export function MapScreen() {
  const islandId = useAppStore((s) => s.selectedIslandId)!;
  const favorites = useAppStore((s) => s.favorites);
  const openPlace = useAppStore((s) => s.openPlace);
  const island = islandById(islandId)!;
  const places = useMemo(() => placesForIsland(islandId), [islandId]);

  return (
    <div className="map-wrap fade-in">
      <MapContainer center={[island.center.lat, island.center.lng]} zoom={island.zoom} scrollWheelZoom>
        <Recenter lat={island.center.lat} lng={island.center.lng} zoom={island.zoom} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {places.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]}>
            <Popup>
              <strong>{p.title}</strong>
              {favorites.includes(p.id) && " ❤️"}
              <br />
              <button type="button" className="btn btn--ghost" style={{ marginTop: "0.5rem", fontSize: "0.75rem" }} onClick={() => openPlace(p.id)}>
                View guide
              </button>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
