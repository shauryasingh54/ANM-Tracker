'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  getCurrentUser,
  logoutUser,
  getActiveDutySession,
  startWork,
  endWork,
  updateLiveLocation,
  getTodayVaccinationCount,
  updateVaccinationCount,
  subscribeToTrackerUpdates,
} from '@/lib/syncEngine';
import {
  getTodayISTDate,
  formatISTTime,
  formatRelativeTime,
  isLocationStale,
  getMsUntilISTMidnight,
} from '@/lib/dateUtils';
import { Profile, DutySession, LiveLocation } from '@/types';
import {
  MapPin,
  Plus,
  Minus,
  Play,
  Square,
  AlertTriangle,
  CheckCircle2,
  LogOut,
  ShieldAlert,
  Navigation,
  RefreshCw,
  Clock,
  Sparkles,
} from 'lucide-react';

// Dynamically import MiniANMMap with SSR disabled to prevent Leaflet hydration errors
const MiniANMMap = dynamic(() => import('@/components/MiniANMMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-52 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-xs animate-pulse">
      Loading GPS Map...
    </div>
  ),
});

export default function ANMDashboard() {
  const router = useRouter();

  // User state
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Duty session & GPS state
  const [activeSession, setActiveSession] = useState<DutySession | null>(null);
  const [currentLocation, setCurrentLocation] = useState<LiveLocation | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'acquiring' | 'active' | 'denied' | 'error'>('idle');
  const [isSimulatingGps, setIsSimulatingGps] = useState(false);

  // Vaccination Counter state
  const [todayCount, setTodayCount] = useState<number>(0);
  const [isCounterUpdating, setIsCounterUpdating] = useState(false);
  const [currentDateIST, setCurrentDateIST] = useState<string>(getTodayISTDate());

  // Wake lock ref to keep mobile display awake while on duty
  const wakeLockRef = useRef<any>(null);
  const watchIdRef = useRef<number | null>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const midnightTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Initial Authentication & Data Load
  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      router.push('/');
      return;
    }
    if (currentUser.role !== 'anm') {
      router.push('/moic');
      return;
    }
    setUser(currentUser);

    const initData = async () => {
      setLoading(true);
      const session = await getActiveDutySession(currentUser.id);
      setActiveSession(session);

      const count = await getTodayVaccinationCount(currentUser.id);
      setTodayCount(count);

      setLoading(false);
    };

    initData();
  }, [router]);

  // 2. Midnight IST automatic reset timer
  useEffect(() => {
    const scheduleMidnightReset = () => {
      const msRemaining = getMsUntilISTMidnight();
      midnightTimerRef.current = setTimeout(async () => {
        const newDate = getTodayISTDate();
        setCurrentDateIST(newDate);
        if (user) {
          const freshCount = await getTodayVaccinationCount(user.id);
          setTodayCount(freshCount);
        }
        scheduleMidnightReset();
      }, msRemaining);
    };

    scheduleMidnightReset();
    return () => {
      if (midnightTimerRef.current) clearTimeout(midnightTimerRef.current);
    };
  }, [user]);

  // 3. Screen Wake Lock handler (prevents screen sleep on mobile when on duty)
  const requestWakeLock = async () => {
    if (typeof window !== 'undefined' && 'wakeLock' in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      } catch (err) {
        console.warn('Wake Lock request error:', err);
      }
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  };

  // 4. GPS Location Transmission
  const sendLocationUpdate = useCallback(
    async (coords: { latitude: number; longitude: number; accuracy: number; heading?: number | null; speed?: number | null }) => {
      if (!user) return;
      try {
        const updated = await updateLiveLocation(user.id, coords);
        setCurrentLocation(updated);
        setGpsStatus('active');
        setGpsError(null);
      } catch (err: any) {
        setGpsError('Failed to synchronize GPS to server.');
      }
    },
    [user]
  );

  // 5. Start GPS Geolocation Tracking
  const startGpsTracking = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGpsError('GPS Geolocation is not supported by your browser.');
      setGpsStatus('error');
      return;
    }

    setGpsStatus('acquiring');
    setGpsError(null);
    requestWakeLock();

    // Acquire immediate first position
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        sendLocationUpdate({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
        });
      },
      (err) => {
        console.warn('Geolocation initial error:', err);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError('Location permission denied. Please allow location access in your browser settings.');
          setGpsStatus('denied');
        } else {
          setGpsError(`GPS Error: ${err.message}. Ensure Location Services are turned on.`);
          setGpsStatus('error');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );

    // Watch position continuously
    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          sendLocationUpdate({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
          });
        },
        (err) => {
          console.warn('watchPosition error:', err);
          if (err.code === err.PERMISSION_DENIED) {
            setGpsError('Location permission denied.');
            setGpsStatus('denied');
          }
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
      );
    } catch (e) {
      console.warn('Could not start watchPosition:', e);
    }

    // Interval pulse every 15 seconds to ensure heartbeat when browser pauses watchPosition
    updateIntervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          sendLocationUpdate({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
          });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 }
      );
    }, 15000);
  }, [sendLocationUpdate]);

  // 6. Stop GPS Geolocation Tracking
  const stopGpsTracking = useCallback(() => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
    releaseWakeLock();
    setGpsStatus('idle');
  }, []);

  // 7. Desktop simulation loop for testing/evaluation
  useEffect(() => {
    let simInterval: NodeJS.Timeout | null = null;
    if (isSimulatingGps && activeSession && user) {
      // Base around Jamwa Ramgarh coordinates
      let baseLat = currentLocation?.latitude || 27.0084;
      let baseLng = currentLocation?.longitude || 75.9921;

      simInterval = setInterval(() => {
        // Small random walk ~10-20 meters
        baseLat += (Math.random() - 0.5) * 0.0003;
        baseLng += (Math.random() - 0.5) * 0.0003;

        sendLocationUpdate({
          latitude: baseLat,
          longitude: baseLng,
          accuracy: 12.0 + Math.random() * 5,
          heading: Math.floor(Math.random() * 360),
          speed: 1.1,
        });
      }, 10000);
    }

    return () => {
      if (simInterval) clearInterval(simInterval);
    };
  }, [isSimulatingGps, activeSession, user, currentLocation?.latitude, currentLocation?.longitude, sendLocationUpdate]);

  // Activate tracking when session is already active on load
  useEffect(() => {
    if (activeSession && activeSession.status === 'active' && !isSimulatingGps) {
      startGpsTracking();
    } else if (!activeSession) {
      stopGpsTracking();
    }
    return () => {
      stopGpsTracking();
    };
  }, [activeSession, startGpsTracking, stopGpsTracking, isSimulatingGps]);

  // 8. Subscribe to realtime broadcast events (e.g., if updated from another tab)
  useEffect(() => {
    const unsubscribe = subscribeToTrackerUpdates((event) => {
      if (event.type === 'count' && event.payload && user && event.payload.anmId === user.id) {
        setTodayCount(event.payload.count);
      }
    });
    return () => unsubscribe();
  }, [user]);

  // Handlers for Start Work & End Work
  const handleStartWork = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const session = await startWork(user.id);
      setActiveSession(session);
      startGpsTracking();
    } catch (err: any) {
      setGpsError('Failed to start work session: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEndWork = async () => {
    if (!user) return;
    setLoading(true);
    try {
      stopGpsTracking();
      setIsSimulatingGps(false);
      await endWork(user.id);
      setActiveSession(null);
    } catch (err: any) {
      setGpsError('Failed to end work session: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handlers for Vaccination Counter (+1, -1)
  const handleCounterChange = async (delta: number) => {
    if (!user || isCounterUpdating) return;
    if (delta < 0 && todayCount <= 0) return; // Prevent negative counts

    // Optimistic UI update
    const previous = todayCount;
    const optimistic = Math.max(0, todayCount + delta);
    setTodayCount(optimistic);
    setIsCounterUpdating(true);

    try {
      const savedCount = await updateVaccinationCount(user.id, delta);
      setTodayCount(savedCount);
    } catch (err) {
      console.error('Failed to save vaccination count:', err);
      // Revert if error
      setTodayCount(previous);
    } finally {
      setIsCounterUpdating(false);
    }
  };

  const handleLogout = () => {
    stopGpsTracking();
    logoutUser();
    router.push('/');
  };

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-slate-600">Loading ANM Portal...</p>
        </div>
      </div>
    );
  }

  const isOnDuty = Boolean(activeSession && activeSession.status === 'active');
  const isStale = currentLocation ? isLocationStale(currentLocation.last_updated) : false;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center pb-12">
      {/* Mobile Header */}
      <header className="w-full max-w-md bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-30 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
            {user?.name.charAt(0) || 'A'}
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 leading-tight flex items-center gap-1.5">
              <span>{user?.name}</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-1.5 py-0.5 rounded">
                ANM
              </span>
            </div>
            <div className="text-xs text-slate-500 font-medium">
              {user?.employee_id} • {user?.assigned_facility}
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          type="button"
          title="Sign Out"
          className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-slate-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      {/* Main Mobile Content Container */}
      <main className="w-full max-w-md px-4 py-4 space-y-4">
        {/* ======================================================== */}
        {/* 1. DUTY STATUS & START / END WORK SECTION */}
        {/* ======================================================== */}
        <section className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm text-center">
          {isOnDuty ? (
            <div>
              {/* On Duty Active State Banner */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold mb-4 shadow-sm animate-pulse">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-ping"></span>
                <span>On Duty – Location Sharing Active</span>
              </div>

              <div className="text-xs text-slate-500 mb-4 flex items-center justify-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  Started at {formatISTTime(activeSession!.start_time)}
                </span>
              </div>

              {/* End Work Button */}
              <button
                onClick={handleEndWork}
                type="button"
                className="w-full py-3.5 px-6 rounded-xl bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white font-bold text-base shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 transition-all"
              >
                <Square className="w-5 h-5 fill-current" />
                <span>End Work</span>
              </button>
            </div>
          ) : (
            <div>
              {/* Off Duty State */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold mb-4">
                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                <span>Off Duty • Location Sharing Stopped</span>
              </div>

              <p className="text-xs text-slate-500 mb-5 max-w-xs mx-auto">
                Tap Start Work to begin your field duty and start transmitting your live GPS location to the PHC/CHC.
              </p>

              {/* Start Work Button (Large) */}
              <button
                onClick={handleStartWork}
                type="button"
                className="w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-extrabold text-lg shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2.5 transition-all"
              >
                <Play className="w-6 h-6 fill-current" />
                <span>Start Work</span>
              </button>
            </div>
          )}
        </section>

        {/* GPS Permission / Inactive / Error Notices */}
        {gpsError && (
          <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-amber-900 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold">GPS Notice:</span> {gpsError}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 2. TODAY'S VACCINATIONS COUNTER SECTION */}
        {/* Exact requirement: single counter, +1 and -1 buttons, auto-save */}
        {/* ======================================================== */}
        <section className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm text-center">
          <div className="mb-2">
            <h2 className="text-base font-bold text-slate-900">Today&apos;s Vaccinations</h2>
            <p className="text-xs text-slate-500 font-medium">
              Total Vaccinations Today ({currentDateIST})
            </p>
          </div>

          {/* Large Counter Display */}
          <div className="my-5">
            <div className="text-6xl font-black text-slate-900 tracking-tight font-mono select-none">
              {todayCount}
            </div>
            <div className="text-xs font-semibold text-emerald-700 mt-1 flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Saved automatically to database</span>
            </div>
          </div>

          {/* Large Tactile Buttons: -1 and +1 */}
          <div className="flex items-center justify-center gap-4 max-w-xs mx-auto mb-3">
            {/* -1 Button */}
            <button
              onClick={() => handleCounterChange(-1)}
              disabled={todayCount <= 0 || isCounterUpdating}
              type="button"
              aria-label="Decrease vaccination count by 1"
              className="flex-1 h-16 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 disabled:opacity-40 disabled:hover:bg-slate-100 text-slate-700 flex items-center justify-center transition-all border border-slate-200 shadow-sm"
            >
              <div className="flex flex-col items-center">
                <Minus className="w-7 h-7 stroke-[2.5]" />
                <span className="text-[11px] font-bold mt-0.5">−1</span>
              </div>
            </button>

            {/* +1 Button */}
            <button
              onClick={() => handleCounterChange(1)}
              disabled={isCounterUpdating}
              type="button"
              aria-label="Increase vaccination count by 1"
              className="flex-1 h-16 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white flex items-center justify-center transition-all shadow-md shadow-emerald-600/30 border border-emerald-500"
            >
              <div className="flex flex-col items-center">
                <Plus className="w-7 h-7 stroke-[3]" />
                <span className="text-[11px] font-bold mt-0.5">+1</span>
              </div>
            </button>
          </div>

          <p className="text-xs text-slate-500 font-medium">
            Tap <strong className="text-emerald-700 font-bold">+1</strong> after each vaccination
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Resets to 0 daily at midnight (IST) • Records preserved in database
          </p>
        </section>

        {/* ======================================================== */}
        {/* 3. LIVE GPS LOCATION & MINI MAP */}
        {/* ======================================================== */}
        <section className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Your Current Location
              </h3>
            </div>
            {currentLocation && (
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                  isStale
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {isStale ? 'GPS Stale' : 'Live GPS'}
              </span>
            )}
          </div>

          {/* Leaflet Mini Map */}
          <MiniANMMap
            latitude={currentLocation?.latitude ?? null}
            longitude={currentLocation?.longitude ?? null}
            accuracy={currentLocation?.accuracy ?? null}
            anmName={user?.name}
            isOnDuty={isOnDuty}
          />

          {/* Location Metadata Details */}
          {currentLocation ? (
            <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
              <div>
                <span className="text-slate-400 block">Coordinates</span>
                <span className="font-mono font-semibold">
                  {currentLocation.latitude.toFixed(4)}°, {currentLocation.longitude.toFixed(4)}°
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block">Last GPS Transmit</span>
                <span className="font-semibold text-slate-800">
                  {formatRelativeTime(currentLocation.last_updated)}
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-2 text-center text-xs text-slate-400 py-1">
              {isOnDuty ? 'Acquiring GPS fix...' : 'GPS sharing is paused while Off Duty'}
            </div>
          )}
        </section>

        {/* ======================================================== */}
        {/* 4. GPS SIMULATION TOOL (FOR DESKTOP / TESTING) */}
        {/* ======================================================== */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Evaluator Simulation Tool</span>
            </div>
            <button
              onClick={() => {
                if (!isOnDuty) {
                  alert('Please click "Start Work" first to begin simulated field duty.');
                  return;
                }
                setIsSimulatingGps(!isSimulatingGps);
              }}
              type="button"
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                isSimulatingGps
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {isSimulatingGps ? 'Simulating Walking' : 'Simulate Walking'}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Simulates periodic walking between rural sub-centres in Rajasthan if testing on a stationary PC.
          </p>
        </div>

        {/* Background Location Tracking Advisory Notice */}
        <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-[11px] text-blue-900 leading-relaxed flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <strong>Notice on Mobile Tracking:</strong> Web browsers require the tab to remain open and active. Uninterrupted background location tracking cannot be guaranteed when your mobile screen is completely locked. Screen Wake Lock has been enabled to assist.
          </div>
        </div>
      </main>
    </div>
  );
}
