import {
  Profile,
  DutySession,
  LiveLocation,
  ANMWithLiveStatus,
  FacilityMetrics,
} from '@/types';
import { getTodayISTDate, isLocationStale } from './dateUtils';
import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import {
  DEMO_PROFILES,
  INITIAL_DUTY_SESSIONS,
  INITIAL_LOCATIONS,
  INITIAL_VACCINATION_COUNTS,
} from './mockData';

const STORAGE_KEYS = {
  CURRENT_USER: 'anm_tracker_current_user',
  DUTY_SESSIONS: 'anm_tracker_duty_sessions',
  LOCATIONS: 'anm_tracker_locations',
  COUNTS: 'anm_tracker_vaccination_counts', // key: `${anmId}_${date}` -> number
  LAST_DATE: 'anm_tracker_last_date',
};

// Cross-tab broadcast channel for real-time demo synchronization
let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel('anm_tracker_sync_channel');
  } catch (e) {
    console.warn('BroadcastChannel not supported or error:', e);
  }
}

/**
 * Initialize local storage state with realistic seed data if not present.
 */
function initLocalStorageIfNeeded() {
  if (typeof window === 'undefined') return;

  const today = getTodayISTDate();

  if (!localStorage.getItem(STORAGE_KEYS.DUTY_SESSIONS)) {
    const sessionMap: Record<string, DutySession> = {};
    INITIAL_DUTY_SESSIONS.forEach((s) => {
      sessionMap[s.anm_id] = s;
    });
    localStorage.setItem(STORAGE_KEYS.DUTY_SESSIONS, JSON.stringify(sessionMap));
  }

  if (!localStorage.getItem(STORAGE_KEYS.LOCATIONS)) {
    localStorage.setItem(STORAGE_KEYS.LOCATIONS, JSON.stringify(INITIAL_LOCATIONS));
  }

  if (!localStorage.getItem(STORAGE_KEYS.COUNTS)) {
    const countsMap: Record<string, number> = {};
    Object.entries(INITIAL_VACCINATION_COUNTS).forEach(([anmId, count]) => {
      countsMap[`${anmId}_${today}`] = count;
    });
    localStorage.setItem(STORAGE_KEYS.COUNTS, JSON.stringify(countsMap));
  }

  localStorage.setItem(STORAGE_KEYS.LAST_DATE, today);
}

/**
 * Helper to emit a change notification across tabs and local listeners
 */
function notifyChange(type: 'session' | 'location' | 'count' | 'reset', payload?: any) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('anm_tracker_update', { detail: { type, payload } }));
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type, payload });
    } catch (e) {
      // ignore
    }
  }
}

// ==========================================
// Authentication & User Session Management
// ==========================================

export async function loginWithEmployeeId(
  employeeId: string,
  role?: 'anm' | 'moic'
): Promise<{ user: Profile | null; error?: string }> {
  initLocalStorageIfNeeded();

  const cleanId = employeeId.trim().toUpperCase();

  // 1. Try finding in pre-seeded demo profiles first
  let profile = DEMO_PROFILES.find(
    (p) => p.employee_id.toUpperCase() === cleanId || p.employee_id.toUpperCase().includes(cleanId)
  );

  // If role is specified and profile matches different role, check if partial match
  if (!profile && role) {
    profile = DEMO_PROFILES.find((p) => p.role === role);
  }

  // 2. If Supabase is configured, attempt database lookup
  const supabase = getSupabase();
  if (supabase && isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('employee_id', cleanId)
        .single();

      if (data && !error) {
        profile = data as Profile;
      }
    } catch (err) {
      console.warn('Supabase profile fetch error, using local fallback:', err);
    }
  }

  if (!profile) {
    return {
      user: null,
      error: `Employee ID "${employeeId}" not recognized. For demo, use RJ-ANM-4012 (Sunita Sharma) or MOIC-RJ-1001 (Dr. Rajesh Verma).`,
    };
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(profile));
  }

  return { user: profile };
}

export function getCurrentUser(): Profile | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function logoutUser(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  const supabase = getSupabase();
  if (supabase) {
    supabase.auth.signOut().catch(() => {});
  }
}

// ==========================================
// Duty Sessions (Start Work / End Work)
// ==========================================

export async function getActiveDutySession(anmId: string): Promise<DutySession | null> {
  initLocalStorageIfNeeded();

  // If Supabase is available
  const supabase = getSupabase();
  if (supabase && isSupabaseConfigured()) {
    try {
      const { data } = await supabase
        .from('duty_sessions')
        .select('*')
        .eq('anm_id', anmId)
        .eq('status', 'active')
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) return data as DutySession;
    } catch (e) {
      console.warn('Supabase getActiveDutySession error:', e);
    }
  }

  // Local storage fallback
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(STORAGE_KEYS.DUTY_SESSIONS);
    if (raw) {
      const map = JSON.parse(raw) as Record<string, DutySession>;
      const session = map[anmId];
      if (session && session.status === 'active') {
        return session;
      }
    }
  }
  return null;
}

export async function startWork(
  anmId: string,
  initialCoords?: { latitude: number; longitude: number; accuracy: number }
): Promise<DutySession> {
  initLocalStorageIfNeeded();
  const now = new Date().toISOString();

  const newSession: DutySession = {
    id: `session-${Date.now()}`,
    anm_id: anmId,
    start_time: now,
    status: 'active',
  };

  // 1. Save to Supabase if configured
  const supabase = getSupabase();
  if (supabase && isSupabaseConfigured()) {
    try {
      await supabase.from('duty_sessions').insert({
        anm_id: anmId,
        start_time: now,
        status: 'active',
      });
    } catch (err) {
      console.error('Supabase startWork error:', err);
    }
  }

  // 2. Save locally
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(STORAGE_KEYS.DUTY_SESSIONS) || '{}';
    const map = JSON.parse(raw);
    map[anmId] = newSession;
    localStorage.setItem(STORAGE_KEYS.DUTY_SESSIONS, JSON.stringify(map));

    if (initialCoords) {
      await updateLiveLocation(anmId, initialCoords);
    }
  }

  notifyChange('session', { anmId, session: newSession });
  return newSession;
}

export async function endWork(anmId: string): Promise<void> {
  initLocalStorageIfNeeded();
  const now = new Date().toISOString();

  // 1. Supabase
  const supabase = getSupabase();
  if (supabase && isSupabaseConfigured()) {
    try {
      await supabase
        .from('duty_sessions')
        .update({ end_time: now, status: 'completed' })
        .eq('anm_id', anmId)
        .eq('status', 'active');
    } catch (err) {
      console.error('Supabase endWork error:', err);
    }
  }

  // 2. Local storage
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(STORAGE_KEYS.DUTY_SESSIONS) || '{}';
    const map = JSON.parse(raw);
    if (map[anmId]) {
      map[anmId] = {
        ...map[anmId],
        end_time: now,
        status: 'completed',
      };
      localStorage.setItem(STORAGE_KEYS.DUTY_SESSIONS, JSON.stringify(map));
    }
  }

  notifyChange('session', { anmId, session: null });
}

// ==========================================
// Live GPS Locations
// ==========================================

export async function updateLiveLocation(
  anmId: string,
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    heading?: number | null;
    speed?: number | null;
  }
): Promise<LiveLocation> {
  const now = new Date().toISOString();
  const location: LiveLocation = {
    anm_id: anmId,
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: coords.accuracy,
    heading: coords.heading ?? null,
    speed: coords.speed ?? null,
    last_updated: now,
  };

  // 1. Supabase upsert
  const supabase = getSupabase();
  if (supabase && isSupabaseConfigured()) {
    try {
      await supabase.from('live_locations').upsert(
        {
          anm_id: anmId,
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
          heading: coords.heading,
          speed: coords.speed,
          last_updated: now,
        },
        { onConflict: 'anm_id' }
      );
    } catch (err) {
      console.error('Supabase updateLiveLocation error:', err);
    }
  }

  // 2. Local storage
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(STORAGE_KEYS.LOCATIONS) || '{}';
    const map = JSON.parse(raw);
    map[anmId] = location;
    localStorage.setItem(STORAGE_KEYS.LOCATIONS, JSON.stringify(map));
  }

  notifyChange('location', { anmId, location });
  return location;
}

export async function getLiveLocations(): Promise<Record<string, LiveLocation>> {
  initLocalStorageIfNeeded();

  const supabase = getSupabase();
  if (supabase && isSupabaseConfigured()) {
    try {
      const { data } = await supabase.from('live_locations').select('*');
      if (data && data.length > 0) {
        const map: Record<string, LiveLocation> = {};
        data.forEach((loc: LiveLocation) => {
          map[loc.anm_id] = loc;
        });
        return map;
      }
    } catch (err) {
      console.warn('Supabase getLiveLocations error, using fallback:', err);
    }
  }

  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(STORAGE_KEYS.LOCATIONS);
    if (raw) {
      return JSON.parse(raw);
    }
  }
  return INITIAL_LOCATIONS;
}

// ==========================================
// Vaccination Counter (+1, -1, Daily IST Reset)
// ==========================================

export async function getTodayVaccinationCount(anmId: string): Promise<number> {
  initLocalStorageIfNeeded();
  const today = getTodayISTDate();

  const supabase = getSupabase();
  if (supabase && isSupabaseConfigured()) {
    try {
      const { data } = await supabase
        .from('vaccination_counts')
        .select('total_count')
        .eq('anm_id', anmId)
        .eq('date', today)
        .maybeSingle();

      if (data) {
        return Number(data.total_count) || 0;
      }
    } catch (err) {
      console.warn('Supabase getTodayVaccinationCount error:', err);
    }
  }

  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(STORAGE_KEYS.COUNTS) || '{}';
    const counts = JSON.parse(raw);
    const key = `${anmId}_${today}`;
    return typeof counts[key] === 'number' ? counts[key] : 0;
  }

  return 0;
}

/**
 * Atomic update of vaccination counter (+1 or -1)
 * Automatically ensures count >= 0 and associates with current IST date.
 */
export async function updateVaccinationCount(
  anmId: string,
  delta: number
): Promise<number> {
  initLocalStorageIfNeeded();
  const today = getTodayISTDate();

  let newCount = 0;

  // 1. Supabase Atomic RPC call
  const supabase = getSupabase();
  if (supabase && isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.rpc('increment_vaccination_count', {
        p_anm_id: anmId,
        p_date: today,
        p_delta: delta,
      });

      if (!error && typeof data === 'number') {
        newCount = data;
      }
    } catch (err) {
      console.warn('Supabase atomic RPC error, calculating locally:', err);
    }
  }

  // 2. Local storage sync (optimistic or fallback)
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(STORAGE_KEYS.COUNTS) || '{}';
    const counts = JSON.parse(raw);
    const key = `${anmId}_${today}`;
    const current = typeof counts[key] === 'number' ? counts[key] : 0;

    // If newCount wasn't set by RPC, compute it safely
    if (newCount === 0 && delta < 0 && current === 0) {
      newCount = 0;
    } else if (newCount === 0 && (delta !== 0 || current > 0)) {
      newCount = Math.max(0, current + delta);
    }

    counts[key] = newCount;
    localStorage.setItem(STORAGE_KEYS.COUNTS, JSON.stringify(counts));
  }

  notifyChange('count', { anmId, date: today, count: newCount });
  return newCount;
}

// ==========================================
// Operational Aggregate Queries for MOIC
// ==========================================

export async function getAllANMsWithStatus(
  facilityFilter?: string
): Promise<{ anms: ANMWithLiveStatus[]; metrics: FacilityMetrics }> {
  initLocalStorageIfNeeded();
  const today = getTodayISTDate();

  // Load profiles
  let profiles = DEMO_PROFILES.filter((p) => p.role === 'anm');

  // Supabase profiles if available
  const supabase = getSupabase();
  if (supabase && isSupabaseConfigured()) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'anm');
      if (data && data.length > 0) {
        profiles = data as Profile[];
      }
    } catch (err) {
      console.warn('Supabase profile roster fetch error:', err);
    }
  }

  // Filter by facility if requested
  if (facilityFilter && facilityFilter !== 'All Facilities') {
    profiles = profiles.filter((p) => p.assigned_facility === facilityFilter);
  }

  // Load active sessions
  const sessionsMap: Record<string, DutySession> = {};
  if (typeof window !== 'undefined') {
    const rawSessions = localStorage.getItem(STORAGE_KEYS.DUTY_SESSIONS);
    if (rawSessions) {
      Object.assign(sessionsMap, JSON.parse(rawSessions));
    }
  }

  // Load live locations
  const locationsMap = await getLiveLocations();

  // Load today's counts
  const rawCounts =
    typeof window !== 'undefined'
      ? JSON.parse(localStorage.getItem(STORAGE_KEYS.COUNTS) || '{}')
      : {};

  let onDutyCount = 0;
  let totalVaccinationsToday = 0;

  const anms: ANMWithLiveStatus[] = profiles.map((p) => {
    const session = sessionsMap[p.id];
    const isOnDuty = session && session.status === 'active';
    const loc = locationsMap[p.id] || null;
    const countKey = `${p.id}_${today}`;
    const todayCount = typeof rawCounts[countKey] === 'number' ? rawCounts[countKey] : 0;

    totalVaccinationsToday += todayCount;
    if (isOnDuty) {
      onDutyCount++;
    }

    const isStale = loc ? isLocationStale(loc.last_updated) : true;
    const isLive = Boolean(isOnDuty && loc);

    return {
      profile: p,
      activeSession: isOnDuty ? session : null,
      location: loc,
      todayCount,
      isStale,
      isLive,
    };
  });

  const metrics: FacilityMetrics = {
    totalANMs: profiles.length,
    onDutyCount,
    offDutyCount: profiles.length - onDutyCount,
    totalVaccinationsToday,
  };

  return { anms, metrics };
}

// ==========================================
// Real-time Event Subscription Listener
// ==========================================

export function subscribeToTrackerUpdates(callback: (event: { type: string; payload?: any }) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  // 1. Listen to window custom event (same tab)
  const handleCustomEvent = (e: Event) => {
    const custom = e as CustomEvent;
    callback(custom.detail);
  };
  window.addEventListener('anm_tracker_update', handleCustomEvent);

  // 2. Listen to BroadcastChannel (cross-tab in same browser)
  const handleBroadcast = (e: MessageEvent) => {
    callback(e.data);
  };
  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', handleBroadcast);
  }

  // 3. Listen to Supabase Realtime channel if configured
  const supabase = getSupabase();
  let supabaseChannel: any = null;
  if (supabase && isSupabaseConfigured()) {
    try {
      supabaseChannel = supabase
        .channel('public:anm_tracker')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'live_locations' },
          (payload) => callback({ type: 'location', payload })
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'duty_sessions' },
          (payload) => callback({ type: 'session', payload })
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'vaccination_counts' },
          (payload) => callback({ type: 'count', payload })
        )
        .subscribe();
    } catch (e) {
      console.warn('Supabase realtime subscribe error:', e);
    }
  }

  return () => {
    window.removeEventListener('anm_tracker_update', handleCustomEvent);
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', handleBroadcast);
    }
    if (supabaseChannel && supabase) {
      supabase.removeChannel(supabaseChannel).catch(() => {});
    }
  };
}
