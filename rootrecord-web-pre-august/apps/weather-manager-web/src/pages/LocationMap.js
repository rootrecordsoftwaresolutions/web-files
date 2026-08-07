import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, Navigation, Search, X } from 'lucide-react';
import L from 'leaflet';
import { api } from '../lib/api';

// Fix leaflet default marker icons in webpack/CRA bundle.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function LocationMap() {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [coords, setCoords] = useState(null);
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const [err, setErr] = useState('');

  const applyPick = useCallback((lat, lng, zoom = 12) => {
    setCoords({ lat, lng });
    const map = mapRef.current;
    if (!map) return;
    map.setView([lat, lng], zoom);
    if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
    else markerRef.current = L.marker([lat, lng]).addTo(map);
  }, []);

  useEffect(() => {
    const map = L.map('rrwm-map', {
      zoomControl: false,
      attributionControl: true,
    }).setView([39.8283, -98.5795], 4);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 19,
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      applyPick(lat, lng, map.getZoom());
    });

    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 100);

    // Center map on device location without selecting a point until the user taps or uses "Use my location"
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          map.setView([pos.coords.latitude, pos.coords.longitude], 10);
        },
        () => {},
        { enableHighAccuracy: false, timeout: 5000 }
      );
    }

    return () => map.remove();
  }, [applyPick]);

  const reverseGeocodeLabel = async (lat, lng) => {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const j = await r.json();
    const addr = j?.address || {};
    const label =
      [addr.neighbourhood, addr.suburb, addr.city, addr.town, addr.village].find(Boolean) ||
      (typeof j?.display_name === 'string' ? j.display_name.split(',')[0].trim() : '');
    return label || '';
  };

  const useMyLocation = () => {
    setErr('');
    if (!navigator.geolocation) {
      setErr('This device cannot access location.');
      return;
    }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        applyPick(lat, lng, 14);
        if (!name.trim()) {
          try {
            const label = await reverseGeocodeLabel(lat, lng);
            if (label) setName(label);
          } catch {
            /* optional label */
          }
        }
        setGeoBusy(false);
      },
      (e) => {
        setGeoBusy(false);
        if (e?.code === 1) setErr('Location permission denied. Enable location in system settings.');
        else setErr('Could not get your location. Try again or pick a point on the map.');
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  const doSearch = async (e) => {
    e.preventDefault();
    if (!search.trim()) return;
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(search)}&format=json&limit=1`, {
        headers: { 'Accept-Language': 'en' },
      });
      const j = await r.json();
      if (Array.isArray(j) && j.length) {
        const lat = parseFloat(j[0].lat);
        const lng = parseFloat(j[0].lon);
        applyPick(lat, lng, 11);
        if (!name) setName(j[0].display_name.split(',')[0]);
      } else {
        setErr('No matching place found.');
      }
    } catch (e2) {
      setErr(String(e2?.message || e2));
    }
  };

  const save = async () => {
    setErr('');
    if (!coords) return setErr('Choose a point on the map or use “Use my location”.');
    if (!name.trim()) return setErr('Enter a name for this location.');
    setBusy(true);
    try {
      const { data } = await api.createLocation({ name: name.trim(), latitude: coords.lat, longitude: coords.lng });
      localStorage.setItem('rrwm.activeLocationId', data.id);
      navigate('/');
    } catch (e) {
      setErr(String(e?.response?.data?.detail || e?.message || 'Failed to save'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-app flex flex-col" data-testid="location-map-page">
      {/* Top bar */}
      <div className="flex items-center gap-2 p-3 bg-app/90 backdrop-blur-xl border-b border-subtle z-10">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-containerHover" data-testid="location-back">
          <ArrowLeft strokeWidth={1.5} className="w-4 h-4" />
        </button>
        <form onSubmit={doSearch} className="flex-1 flex items-center gap-2 bg-container border border-subtle px-3">
          <Search strokeWidth={1.5} className="w-4 h-4 text-accent/70" />
          <input
            data-testid="location-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a place"
            className="bg-transparent outline-none text-sm flex-1 py-2"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="text-accent/70"><X className="w-4 h-4" /></button>
          )}
        </form>
      </div>

      <div id="rrwm-map" className="flex-1 relative">
        {geoBusy && (
          <div
            className="absolute inset-0 z-[4] bg-app/50 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 px-6 pointer-events-none"
            role="status"
            aria-live="polite"
          >
            <Loader2 strokeWidth={1.5} className="w-7 h-7 text-accent animate-spin" />
            <p className="text-xs text-accent/70 text-center">Finding your location…</p>
          </div>
        )}
        {busy && (
          <div
            className="absolute inset-0 z-[5] bg-app/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3 px-6"
            data-testid="location-save-loading"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <Loader2 strokeWidth={1.5} className="w-8 h-8 text-accent animate-spin" />
            <p className="text-sm text-accent/80 text-center">Saving your location…</p>
          </div>
        )}
      </div>

      {/* Bottom sheet */}
      <div
        className="bg-container border-t border-subtle p-4 animate-slideup"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="text-[10px] font-mono uppercase tracking-widest text-accent/70 mb-1">Selected coordinates</div>
        <div className="font-mono text-sm mb-3" data-testid="location-coords">
          {coords &&
          Number.isFinite(Number(coords.lat)) &&
          Number.isFinite(Number(coords.lng))
            ? `${Number(coords.lat).toFixed(4)}, ${Number(coords.lng).toFixed(4)}`
            : '— Tap map or use GPS below —'}
        </div>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={busy || geoBusy}
          data-testid="location-use-my-location"
          className="w-full mb-3 py-2.5 rounded-sm border border-subtle bg-app hover:bg-containerHover text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {geoBusy ? (
            <Loader2 strokeWidth={1.5} className="w-4 h-4 animate-spin" />
          ) : (
            <Navigation strokeWidth={1.5} className="w-4 h-4 text-accent" />
          )}
          {geoBusy ? 'Getting location…' : 'Use my location'}
        </button>
        <input
          data-testid="location-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Location name (Home, Cabin…)"
          className="w-full bg-app border border-subtle px-3 py-3 text-sm outline-none focus:border-accent"
        />
        {err && (
          <div className="text-xs bg-sev-severe/10 border border-sev-severe/40 text-sev-severe p-2 mt-3" data-testid="location-error">
            {err}
          </div>
        )}
        <button
          onClick={save}
          disabled={busy || !coords}
          data-testid="location-save-button"
          className="mt-3 w-full bg-accent hover:bg-accentHover text-white py-3 rounded-sm flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
        >
          <Check strokeWidth={1.5} className="w-4 h-4" /> {busy ? 'Saving…' : 'Save location'}
        </button>
      </div>
    </div>
  );
}
