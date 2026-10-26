'use client';

import React, { useEffect, useRef } from 'react';
import type * as LType from 'leaflet';
import { ANMWithLiveStatus } from '@/types';
import { formatRelativeTime, formatISTTime } from '@/lib/dateUtils';

interface MOICLiveMapProps {
  anms: ANMWithLiveStatus[];
  selectedAnmId: string | null;
  onSelectAnm?: (id: string) => void;
}

export default function MOICLiveMap({
  anms,
  selectedAnmId,
  onSelectAnm,
}: MOICLiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LType.Map | null>(null);
  const markersGroupRef = useRef<LType.LayerGroup | null>(null);
  const markerLookupRef = useRef<Record<string, LType.Marker>>({});

  // Initialize Leaflet map instance once
  useEffect(() => {
    let isMounted = true;

    import('leaflet').then((L) => {
      if (!isMounted || !mapContainerRef.current) return;

      if (!mapInstanceRef.current) {
        // Center by default in Rajasthan / Jaipur rural region (Jamwa Ramgarh - Bassi)
        const map = L.map(mapContainerRef.current, {
          zoomControl: false,
          attributionControl: true,
        }).setView([26.9600, 76.0100], 11);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors | NHM Rajasthan',
        }).addTo(map);

        L.control.zoom({ position: 'topright' }).addTo(map);

        const markersGroup = L.layerGroup().addTo(map);
        markersGroupRef.current = markersGroup;
        mapInstanceRef.current = map;
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Update markers when anms data changes
  useEffect(() => {
    if (!mapInstanceRef.current || !markersGroupRef.current) return;

    import('leaflet').then((L) => {
      const markersGroup = markersGroupRef.current;
      if (!markersGroup) return;

      markersGroup.clearLayers();
      markerLookupRef.current = {};

      const onDutyAnms = anms.filter((a) => a.activeSession && a.location);
      const boundsLatLngs: [number, number][] = [];

      onDutyAnms.forEach((anm) => {
        if (!anm.location) return;

        const { latitude, longitude, accuracy, last_updated } = anm.location;
        boundsLatLngs.push([latitude, longitude]);

        const isStale = anm.isStale;
        const isSelected = selectedAnmId === anm.profile.id;

        // Visual pin styling
        const pinBgColor = isStale ? '#f59e0b' : '#059669'; // amber if stale, emerald if active
        const pulseHtml = !isStale
          ? '<div class="marker-pulse" style="top: -6px; left: -6px; width: 44px; height: 44px;"></div>'
          : '';

        const iconHtml = `
          <div style="position: relative; width: 32px; height: 32px; cursor: pointer;">
            ${pulseHtml}
            <div style="
              width: 32px;
              height: 32px;
              background: ${pinBgColor};
              border: ${isSelected ? '3px solid #3b82f6' : '2.5px solid white'};
              border-radius: 50%;
              box-shadow: 0 4px 10px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: 700;
              font-size: 14px;
              transform: ${isSelected ? 'scale(1.15)' : 'scale(1)'};
              transition: transform 0.2s ease;
            ">
              💉
            </div>
            ${
              isStale
                ? '<span style="position: absolute; top: -3px; right: -3px; background: #ef4444; color: white; border-radius: 50%; width: 14px; height: 14px; font-size: 9px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 1px solid white;">!</span>'
                : ''
            }
          </div>
        `;

        const customIcon = L.divIcon({
          className: 'moic-anm-marker',
          html: iconHtml,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -18],
        });

        const marker = L.marker([latitude, longitude], { icon: customIcon }).addTo(markersGroup);

        // Accuracy radius circle
        if (accuracy && accuracy > 0) {
          L.circle([latitude, longitude], {
            radius: Math.min(accuracy, 250),
            color: isStale ? '#f59e0b' : '#10b981',
            fillColor: isStale ? '#fef3c7' : '#a7f3d0',
            fillOpacity: 0.18,
            weight: 1,
            dashArray: '3, 6',
          }).addTo(markersGroup);
        }

        // Popup content as specified by requirements:
        // "Clicking an ANM marker should show their name, employee ID, assigned PHC/CHC, duty status, and last GPS update."
        // plus Today's vaccinations
        const popupContent = `
          <div style="font-family: inherit; min-width: 210px; padding: 2px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: ${isStale ? '#b45309' : '#047857'}; background: ${isStale ? '#fef3c7' : '#ecfdf5'}; padding: 2px 7px; border-radius: 9999px;">
                ● ${isStale ? 'Stale GPS (>2m)' : 'On Duty – Live'}
              </span>
              <span style="font-size: 11px; font-family: monospace; color: #64748b; font-weight: 600;">
                ${anm.profile.employee_id}
              </span>
            </div>

            <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 2px;">
              ${anm.profile.name}
            </div>

            <div style="font-size: 12px; color: #475569; margin-bottom: 8px;">
              🏥 ${anm.profile.assigned_facility}
            </div>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; margin-bottom: 8px;">
              <div style="font-size: 11px; color: #64748b; font-weight: 600;">Today's Vaccinations</div>
              <div style="font-size: 20px; font-weight: 800; color: #047857; line-height: 1.2;">
                ${anm.todayCount} <span style="font-size: 12px; font-weight: 500; color: #64748b;">doses</span>
              </div>
            </div>

            <div style="font-size: 11px; color: #64748b; border-top: 1px solid #f1f5f9; pt: 6px; margin-top: 6px;">
              <div>🕒 Last GPS: <b>${formatRelativeTime(last_updated)}</b> (${formatISTTime(last_updated)})</div>
              <div>🎯 GPS Accuracy: <b>±${Math.round(accuracy)}m</b></div>
            </div>
          </div>
        `;

        marker.bindPopup(popupContent);

        marker.on('click', () => {
          if (onSelectAnm) {
            onSelectAnm(anm.profile.id);
          }
        });

        markerLookupRef.current[anm.profile.id] = marker;

        if (isSelected) {
          marker.openPopup();
        }
      });
    });
  }, [anms, selectedAnmId, onSelectAnm]);

  // Handle focus when selectedAnmId changes externally
  useEffect(() => {
    if (selectedAnmId && markerLookupRef.current[selectedAnmId] && mapInstanceRef.current) {
      const marker = markerLookupRef.current[selectedAnmId];
      const latLng = marker.getLatLng();
      mapInstanceRef.current.flyTo(latLng, 14, { animate: true, duration: 0.8 });
      marker.openPopup();
    }
  }, [selectedAnmId]);

  const handleFitBounds = () => {
    if (!mapInstanceRef.current) return;
    const onDutyWithLoc = anms.filter((a) => a.activeSession && a.location);
    if (onDutyWithLoc.length === 0) return;

    import('leaflet').then((L) => {
      const latLngs = onDutyWithLoc.map((a) => [a.location!.latitude, a.location!.longitude] as [number, number]);
      const bounds = L.latLngBounds(latLngs);
      mapInstanceRef.current?.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
    });
  };

  const onDutyCount = anms.filter((a) => a.activeSession && a.location).length;

  return (
    <div className="relative w-full h-full min-h-[520px] rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm bg-slate-100 flex flex-col">
      <div ref={mapContainerRef} className="w-full flex-1" />

      {/* Floating map controls */}
      <div className="absolute top-4 left-4 z-[400] flex flex-col gap-2">
        <div className="bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-lg border border-slate-200/80 flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-600"></span>
          </span>
          <span className="text-xs font-bold text-slate-800">
            {onDutyCount} ANM{onDutyCount !== 1 ? 's' : ''} Live On Field
          </span>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 z-[400] flex items-center gap-2">
        <button
          onClick={handleFitBounds}
          type="button"
          disabled={onDutyCount === 0}
          className="bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-md border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 active:scale-95 transition-all flex items-center gap-1.5"
        >
          <span>🗺️</span> View All ANMs
        </button>
      </div>

      {/* Map Legend */}
      <div className="absolute bottom-4 left-4 z-[400] bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-200 shadow text-[11px] text-slate-600 flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
          Live Active
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
          Stale (&gt;2m)
        </span>
      </div>
    </div>
  );
}
