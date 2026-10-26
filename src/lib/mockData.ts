import { Profile, DutySession, LiveLocation, VaccinationCount } from '@/types';
import { getTodayISTDate } from './dateUtils';

export const DEMO_PROFILES: Profile[] = [
  {
    id: '11111111-1111-4111-a111-111111111111',
    name: 'Dr. Rajesh Verma',
    employee_id: 'MOIC-RJ-1001',
    role: 'moic',
    assigned_facility: 'PHC Jamwa Ramgarh',
    phone: '+91 98290 12345',
  },
  {
    id: '22222222-2222-4222-a222-222222222222',
    name: 'Sunita Sharma',
    employee_id: 'RJ-ANM-4012',
    role: 'anm',
    assigned_facility: 'PHC Jamwa Ramgarh',
    phone: '+91 94140 54321',
  },
  {
    id: '33333333-3333-4333-a333-333333333333',
    name: 'Priyanka Meena',
    employee_id: 'RJ-ANM-4015',
    role: 'anm',
    assigned_facility: 'PHC Jamwa Ramgarh',
    phone: '+91 94142 88990',
  },
  {
    id: '44444444-4444-4444-a444-444444444444',
    name: 'Kavita Devi',
    employee_id: 'RJ-ANM-4028',
    role: 'anm',
    assigned_facility: 'CHC Bassi',
    phone: '+91 98281 11223',
  },
  {
    id: '55555555-5555-4555-a555-555555555555',
    name: 'Anita Gurjar',
    employee_id: 'RJ-ANM-4033',
    role: 'anm',
    assigned_facility: 'PHC Achrol',
    phone: '+91 97845 66778',
  },
];

export const INITIAL_DUTY_SESSIONS: DutySession[] = [
  {
    id: 'ds-3333',
    anm_id: '33333333-3333-4333-a333-333333333333', // Priyanka Meena
    start_time: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    status: 'active',
  },
  {
    id: 'ds-4444',
    anm_id: '44444444-4444-4444-a444-444444444444', // Kavita Devi
    start_time: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
    status: 'active',
  },
];

export const INITIAL_LOCATIONS: Record<string, LiveLocation> = {
  '33333333-3333-4333-a333-333333333333': {
    anm_id: '33333333-3333-4333-a333-333333333333',
    latitude: 27.0084,
    longitude: 75.9921,
    accuracy: 14.5,
    heading: 45.0,
    speed: 1.2,
    last_updated: new Date().toISOString(),
  },
  '44444444-4444-4444-a444-444444444444': {
    anm_id: '44444444-4444-4444-a444-444444444444',
    latitude: 26.8340,
    longitude: 76.0450,
    accuracy: 18.0,
    heading: 120.0,
    speed: 0.8,
    last_updated: new Date(Date.now() - 30 * 1000).toISOString(),
  },
};

export const INITIAL_VACCINATION_COUNTS: Record<string, number> = {
  '33333333-3333-4333-a333-333333333333': 18,
  '44444444-4444-4444-a444-444444444444': 24,
  '22222222-2222-4222-a222-222222222222': 0,
  '55555555-5555-4555-a555-555555555555': 0,
};
