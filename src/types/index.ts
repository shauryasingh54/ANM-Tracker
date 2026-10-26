export type UserRole = 'anm' | 'moic';

export interface Profile {
  id: string;
  name: string;
  employee_id: string;
  role: UserRole;
  assigned_facility: string; // e.g. "PHC Jamwa Ramgarh", "CHC Bassi"
  phone?: string;
  created_at?: string;
}

export type DutyStatus = 'active' | 'completed';

export interface DutySession {
  id: string;
  anm_id: string;
  start_time: string;
  end_time?: string | null;
  status: DutyStatus;
}

export interface LiveLocation {
  anm_id: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  heading?: number | null;
  speed?: number | null;
  last_updated: string;
}

export interface VaccinationCount {
  id: string;
  anm_id: string;
  date: string; // YYYY-MM-DD (India Standard Time)
  total_count: number;
  updated_at: string;
}

export interface ANMWithLiveStatus {
  profile: Profile;
  activeSession: DutySession | null;
  location: LiveLocation | null;
  todayCount: number;
  isStale: boolean; // if location > 2 mins old
  isLive: boolean; // currently on duty and has location
}

export interface FacilityMetrics {
  totalANMs: number;
  onDutyCount: number;
  offDutyCount: number;
  totalVaccinationsToday: number;
}
