'use client';

import React, { useEffect, useRef } from 'react';
import type * as LType from 'leaflet';

interface MiniANMMapProps {
  latitude: number | null;
  longitude: number | null;
  accuracy?: number | null;
  anmName?: string;
  isOnDuty?: boolean;
}

export default function MiniANMMap({
  latitude,
  longitude,
  accuracy,
  anmName = 'Your Location',
  isOnDuty = false,
}: MiniANMMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LType.Map | null>(null);
  const markerRef = useRef<LType.Marker | null>(null);
  const circleRef = useRef<LType.Circle | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Dynamically load leaflet on client
    import('leaflet').then((L) => {
      if (!isMounted || !mapContainerRef.current) return;

      // Fix default Leaflet icon paths
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const defaultLat = latitude ?? 27.0084;
      const defaultLng = longitude ?? 75.9921;

      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          zoomControl: false,
          attributionControl: false,
        }).setView([defaultLat, defaultLng], 15);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
        }).addTo(map);

        // Add compact zoom control in top-right
        L.control.zoom({ position: 'topright' }).addTo(map);

        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;

      if (latitude !== null && longitude !== null) {
        const customIcon = L.divIcon({
          className: 'custom-anm-marker',
          html: `
            <div style="position: relative; width: 28px; height: 28px;">
              ${isOnDuty ? '<div class="marker-pulse" style="top: 0; left: 0; width: 28px; height: 28px;"></div>' : ''}
              <div style="
                width: 28px;
                height: 28px;
                background: ${isOnDuty ? '#059669' : '#64748b'};
                border: 3px solid white;
                border-radius: 50%;
                box-shadow: 0 4px 6px -1px rgba(0,0,0,0.25);
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
                font-size: 13px;
              ">
                📍
              </div>
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        if (!markerRef.current) {
          markerRef.current = L.marker([latitude, longitude], { icon: customIcon }).addTo(map);
          markerRef.current.bindPopup(`<b>${anmName}</b><br/>Current GPS Pin`).openPopup();
        } else {
          markerRef.current.setLatLng([latitude, longitude]);
          markerRef.current.setIcon(customIcon);
        }

        if (accuracy && accuracy > 0) {
          if (!circleRef.current) {
            circleRef.current = L.circle([latitude, longitude], {
              radius: accuracy,
              color: isOnDuty ? '#10b981' : '#94a3b8',
              fillColor: isOnDuty ? '#34d399' : '#cbd5e1',
              fillOpacity: 0.15,
              weight: 1.5,
            }).addTo(map);
          } else {
            circleRef.current.setLatLng([latitude, longitude]);
            circleRef.current.setRadius(accuracy);
          }
        }

        map.panTo([latitude, longitude]);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [latitude, longitude, accuracy, isOnDuty, anmName]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const handleCenter = () => {
    if (mapInstanceRef.current && latitude !== null && longitude !== null) {
      mapInstanceRef.current.flyTo([latitude, longitude], 16, { animate: true, duration: 0.8 });
    }
  };

  return (
    <div className="relative w-full h-52 rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100">
      <div ref={mapContainerRef} className="w-full h-full" />
      {latitude && longitude && (
        <button
          onClick={handleCenter}
          type="button"
          aria-label="Recenter map"
          className="absolute bottom-2 right-2 z-[400] bg-white/95 backdrop-blur px-2.5 py-1 rounded-md text-xs font-semibold text-slate-700 shadow-md border border-slate-200 hover:bg-slate-50 flex items-center gap-1 active:scale-95 transition-transform"
        >
          <span>🎯</span> Re-center
        </button>
      )}
    </div>
  );
}
