'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  getCurrentUser,
  logoutUser,
  getAllANMsWithStatus,
  subscribeToTrackerUpdates,
} from '@/lib/syncEngine';
import {
  getTodayISTDate,
  formatISTTime,
  formatRelativeTime,
  isLocationStale,
} from '@/lib/dateUtils';
import { Profile, ANMWithLiveStatus, FacilityMetrics } from '@/types';
import {
  Users,
  Radio,
  PowerOff,
  Syringe,
  Search,
  Filter,
  MapPin,
  ChevronRight,
  LogOut,
  RefreshCw,
  Building2,
  Stethoscope,
  Activity,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

// Dynamically import Leaflet Map with SSR disabled
const MOICLiveMap = dynamic(() => import('@/components/MOICLiveMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[520px] bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 text-sm animate-pulse">
      Loading Real-time GIS Map...
    </div>
  ),
});

export default function MOICDashboard() {
  const router = useRouter();

  // User & facility state
  const [user, setUser] = useState<Profile | null>(null);
  const [selectedFacility, setSelectedFacility] = useState<string>('All Facilities');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAnmId, setSelectedAnmId] = useState<string | null>(null);

  // Operational state
  const [anmRoster, setAnmRoster] = useState<ANMWithLiveStatus[]>([]);
  const [metrics, setMetrics] = useState<FacilityMetrics>({
    totalANMs: 0,
    onDutyCount: 0,
    offDutyCount: 0,
    totalVaccinationsToday: 0,
  });
  const [loading, setLoading] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [isLiveReceiving, setIsLiveReceiving] = useState(false);

  // 1. Initial Authentication & Authorization Check
  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      router.push('/');
      return;
    }
    if (currentUser.role !== 'moic') {
      router.push('/anm');
      return;
    }
    setUser(currentUser);
  }, [router]);

  // 2. Fetch fresh roster and metrics
  const refreshData = useCallback(async () => {
    try {
      const { anms, metrics } = await getAllANMsWithStatus(
        selectedFacility === 'All Facilities' ? undefined : selectedFacility
      );
      setAnmRoster(anms);
      setMetrics(metrics);
      setLastRefreshedAt(new Date());
    } catch (err) {
      console.error('Error refreshing MOIC data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedFacility]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // 3. Realtime automatic updates (Supabase Realtime & Cross-tab Broadcast)
  useEffect(() => {
    const unsubscribe = subscribeToTrackerUpdates((event) => {
      // Flash the live indicator
      setIsLiveReceiving(true);
      setTimeout(() => setIsLiveReceiving(false), 1200);

      // Instantly refresh roster state without page reload
      refreshData();
    });

    // Also periodic poll every 15s to keep relative timestamps and stale badges fresh
    const timer = setInterval(() => {
      refreshData();
    }, 15000);

    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, [refreshData]);

  const handleLogout = () => {
    logoutUser();
    router.push('/');
  };

  // Filter ANM roster by search term
  const filteredAnms = useMemo(() => {
    return anmRoster.filter((item) => {
      const matchSearch =
        item.profile.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.profile.employee_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.profile.assigned_facility.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSearch;
    });
  }, [anmRoster, searchQuery]);

  // Unique list of facilities for the selector
  const facilityOptions = useMemo(() => {
    const set = new Set<string>();
    anmRoster.forEach((a) => set.add(a.profile.assigned_facility));
    return ['All Facilities', ...Array.from(set)];
  }, [anmRoster]);

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-slate-300">Loading MOIC Control Room...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header Bar */}
      <header className="bg-slate-900 text-white border-b border-slate-800 px-6 py-4 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <Stethoscope className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">MOIC Live Command Center</h1>
                <span className="bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Realtime GIS
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Medical Officer In-Charge: <span className="text-white font-semibold">{user?.name}</span> ({user?.employee_id}) • {user?.assigned_facility}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Signal Pulse Badge */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                isLiveReceiving
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 scale-105'
                  : 'bg-slate-800/80 border-slate-700 text-slate-300'
              }`}
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span>{isLiveReceiving ? 'Live Event Received' : 'Realtime Stream Active'}</span>
            </div>

            {/* Manual Refresh */}
            <button
              onClick={() => refreshData()}
              type="button"
              title="Refresh Data"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700/80"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              type="button"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-red-950/40 hover:text-red-300 text-slate-300 transition-colors border border-slate-700/80 text-xs font-bold"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full p-4 md:p-6 space-y-6 flex-1 flex flex-col">
        {/* ======================================================== */}
        {/* 1. TOP METRICS SUMMARY CARDS */}
        {/* Total ANMs, On Duty, Off Duty, Facility Vaccinations Today */}
        {/* ======================================================== */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Card 1: Total ANMs */}
          <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total ANMs</p>
              <h3 className="text-3xl font-black text-slate-900 mt-1">{metrics.totalANMs}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Assigned staff</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </div>

          {/* Card 2: On Duty (Live) */}
          <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">On Duty (Active)</p>
              <h3 className="text-3xl font-black text-emerald-600 mt-1">{metrics.onDutyCount}</h3>
              <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Sharing live GPS</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
          </div>

          {/* Card 3: Off Duty */}
          <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Off Duty</p>
              <h3 className="text-3xl font-black text-slate-700 mt-1">{metrics.offDutyCount}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Stationary / Rest</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center">
              <PowerOff className="w-6 h-6" />
            </div>
          </div>

          {/* Card 4: Total Vaccinations Today */}
          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl p-4 md:p-5 shadow-md shadow-emerald-700/20 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-100">
                Total Vaccinations Today
              </p>
              <h3 className="text-3xl font-black text-white mt-1">
                {metrics.totalVaccinationsToday}
              </h3>
              <p className="text-[11px] text-emerald-200 font-medium mt-0.5">
                Realtime aggregate across all ANMs
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/15 text-white flex items-center justify-center backdrop-blur-sm">
              <Syringe className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Filter & Facility Controls */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <span>Facility Jurisdiction:</span>
            </div>
            <select
              value={selectedFacility}
              onChange={(e) => setSelectedFacility(e.target.value)}
              className="bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {facilityOptions.map((fac) => (
                <option key={fac} value={fac}>
                  {fac}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search ANM name, ID, or facility..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-slate-50"
              />
            </div>
            <div className="text-[11px] text-slate-400 whitespace-nowrap hidden sm:block">
              Updated: {formatISTTime(lastRefreshedAt)}
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 2. SPLIT LAYOUT: LIVE GIS MAP (LEFT) & ANM ROSTER (RIGHT) */}
        {/* ======================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-[540px]">
          {/* Main Live Map Column (8 Cols on Desktop) */}
          <div className="lg:col-span-8 flex flex-col">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-3 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-2 px-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  <h2 className="text-sm font-bold text-slate-800">
                    Live Geolocation Field Map (Rajasthan Sector)
                  </h2>
                </div>
                <div className="text-[11px] text-slate-500">
                  Click any marker for staff details & live doses
                </div>
              </div>

              {/* Dynamic Leaflet Map Component */}
              <div className="flex-1 w-full rounded-xl overflow-hidden min-h-[480px]">
                <MOICLiveMap
                  anms={anmRoster}
                  selectedAnmId={selectedAnmId}
                  onSelectAnm={(id) => setSelectedAnmId(id)}
                />
              </div>
            </div>
          </div>

          {/* Searchable ANM Roster Column (4 Cols on Desktop) */}
          <div className="lg:col-span-4 flex flex-col">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-sm font-bold text-slate-800">ANM Field Roster</h2>
                  <p className="text-[11px] text-slate-500">
                    Showing {filteredAnms.length} staff members
                  </p>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {selectedFacility}
                </span>
              </div>

              {/* Roster Cards List */}
              <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[600px] pr-1">
                {filteredAnms.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    No ANMs found matching your search.
                  </div>
                ) : (
                  filteredAnms.map((item) => {
                    const isOnDuty = Boolean(item.activeSession);
                    const isStale = item.isStale;
                    const isSelected = selectedAnmId === item.profile.id;

                    return (
                      <div
                        key={item.profile.id}
                        onClick={() => setSelectedAnmId(item.profile.id)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50/40 shadow-sm ring-1 ring-emerald-500'
                            : 'border-slate-200/90 hover:border-slate-300 bg-white hover:bg-slate-50/70'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-slate-900">
                                {item.profile.name}
                              </span>
                              {isOnDuty && !isStale && (
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono font-medium text-slate-500">
                              {item.profile.employee_id}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              🏥 {item.profile.assigned_facility}
                            </div>
                          </div>

                          {/* Individual Today's Vaccinations Badge */}
                          <div className="text-right">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Today&apos;s Vaccinations
                            </div>
                            <div className="text-lg font-black text-emerald-700 font-mono">
                              {item.todayCount}{' '}
                              <span className="text-[10px] font-medium text-slate-500">doses</span>
                            </div>
                          </div>
                        </div>

                        {/* Status Footer */}
                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                          <span
                            className={`font-semibold inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
                              isOnDuty
                                ? isStale
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isOnDuty
                                  ? isStale
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-600'
                                  : 'bg-slate-400'
                              }`}
                            ></span>
                            {isOnDuty
                              ? isStale
                                ? 'On Duty (Stale GPS)'
                                : 'On Duty – Live'
                              : 'Off Duty'}
                          </span>

                          {isOnDuty && item.location ? (
                            <span className="text-slate-500">
                              GPS: {formatRelativeTime(item.location.last_updated)}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">No GPS signal</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
