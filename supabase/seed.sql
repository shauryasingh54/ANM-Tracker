-- ==============================================================================
-- Demo Seed Data: Rajasthan Rural Health Facilities (Jaipur Rural District)
-- Facilities: PHC Jamwa Ramgarh, CHC Bassi, PHC Achrol
-- ==============================================================================

-- Fictional UUIDs for Demo Staff
-- MOIC Dr. Rajesh Verma
-- 11111111-1111-4111-a111-111111111111
-- ANM Sunita Sharma
-- 22222222-2222-4222-a222-222222222222
-- ANM Priyanka Meena
-- 33333333-3333-4333-a333-333333333333
-- ANM Kavita Devi
-- 44444444-4444-4444-a444-444444444444
-- ANM Anita Gurjar
-- 55555555-5555-4555-a555-555555555555

INSERT INTO public.profiles (id, name, employee_id, role, assigned_facility, phone)
VALUES
    ('11111111-1111-4111-a111-111111111111', 'Dr. Rajesh Verma', 'MOIC-RJ-1001', 'moic', 'PHC Jamwa Ramgarh', '+91 98290 12345'),
    ('22222222-2222-4222-a222-222222222222', 'Sunita Sharma', 'RJ-ANM-4012', 'anm', 'PHC Jamwa Ramgarh', '+91 94140 54321'),
    ('33333333-3333-4333-a333-333333333333', 'Priyanka Meena', 'RJ-ANM-4015', 'anm', 'PHC Jamwa Ramgarh', '+91 94142 88990'),
    ('44444444-4444-4444-a444-444444444444', 'Kavita Devi', 'RJ-ANM-4028', 'anm', 'CHC Bassi', '+91 98281 11223'),
    ('55555555-5555-4555-a555-555555555555', 'Anita Gurjar', 'RJ-ANM-4033', 'anm', 'PHC Achrol', '+91 97845 66778')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    employee_id = EXCLUDED.employee_id,
    assigned_facility = EXCLUDED.assigned_facility;

-- Initial Active Duty Session for Priyanka Meena and Kavita Devi (to demonstrate on-duty map markers right away)
INSERT INTO public.duty_sessions (id, anm_id, start_time, status)
VALUES
    ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '33333333-3333-4333-a333-333333333333', TIMEZONE('Asia/Kolkata', NOW()) - INTERVAL '2 hours', 'active'),
    ('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', '44444444-4444-4444-a444-444444444444', TIMEZONE('Asia/Kolkata', NOW()) - INTERVAL '1 hour 15 minutes', 'active')
ON CONFLICT (id) DO NOTHING;

-- Initial Live GPS Locations in Rajasthan (Jaipur rural villages / sub-centres)
-- Jamwa Ramgarh sub-centre coordinates: ~27.0050° N, 75.9860° E
-- Bassi Sub-district coordinates: ~26.8333° N, 76.0417° E
INSERT INTO public.live_locations (anm_id, latitude, longitude, accuracy, heading, speed, last_updated)
VALUES
    ('33333333-3333-4333-a333-333333333333', 27.0084, 75.9921, 14.5, 45.0, 1.2, TIMEZONE('Asia/Kolkata', NOW())),
    ('44444444-4444-4444-a444-444444444444', 26.8340, 76.0450, 18.0, 120.0, 0.8, TIMEZONE('Asia/Kolkata', NOW()))
ON CONFLICT (anm_id) DO UPDATE SET
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    accuracy = EXCLUDED.accuracy,
    last_updated = EXCLUDED.last_updated;

-- Initial Today's Vaccination Counts for active ANMs
INSERT INTO public.vaccination_counts (anm_id, date, total_count, updated_at)
VALUES
    ('33333333-3333-4333-a333-333333333333', CURRENT_DATE, 18, TIMEZONE('Asia/Kolkata', NOW())),
    ('44444444-4444-4444-a444-444444444444', CURRENT_DATE, 24, TIMEZONE('Asia/Kolkata', NOW())),
    ('22222222-2222-4222-a222-222222222222', CURRENT_DATE, 0, TIMEZONE('Asia/Kolkata', NOW()))
ON CONFLICT (anm_id, date) DO UPDATE SET
    total_count = EXCLUDED.total_count,
    updated_at = EXCLUDED.updated_at;
