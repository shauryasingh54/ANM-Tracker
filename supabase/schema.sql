-- ==============================================================================
-- ANM Live Location Tracking & Vaccination Counting Database Schema
-- Designed for Primary Health Centres (PHCs) & Community Health Centres (CHCs)
-- ==============================================================================

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    employee_id TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('anm', 'moic')),
    assigned_facility TEXT NOT NULL, -- e.g. 'PHC Jamwa Ramgarh', 'CHC Bassi'
    phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('Asia/Kolkata', NOW())
);

-- 2. Duty Sessions Table
CREATE TABLE IF NOT EXISTS public.duty_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anm_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('Asia/Kolkata', NOW()),
    end_time TIMESTAMPTZ,
    status TEXT NOT NULL CHECK (status IN ('active', 'completed')) DEFAULT 'active'
);

-- Index on duty session lookup
CREATE INDEX IF NOT EXISTS idx_duty_sessions_anm_status ON public.duty_sessions(anm_id, status);

-- 3. Live Locations Table (one current row per ANM)
CREATE TABLE IF NOT EXISTS public.live_locations (
    anm_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy REAL NOT NULL,
    heading REAL,
    speed REAL,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('Asia/Kolkata', NOW())
);

-- 4. Vaccination Counts Table (daily records per ANM, IST date)
CREATE TABLE IF NOT EXISTS public.vaccination_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anm_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL, -- IST Date string 'YYYY-MM-DD'
    total_count INTEGER NOT NULL DEFAULT 0 CHECK (total_count >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('Asia/Kolkata', NOW()),
    CONSTRAINT unique_anm_date UNIQUE (anm_id, date)
);

CREATE INDEX IF NOT EXISTS idx_vaccination_counts_date ON public.vaccination_counts(date);

-- 5. Atomic Counter Increment/Decrement RPC Function
-- Prevents lost updates or race conditions when tapping +1 or -1 quickly
CREATE OR REPLACE FUNCTION public.increment_vaccination_count(
    p_anm_id UUID,
    p_date DATE,
    p_delta INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_count INTEGER;
BEGIN
    INSERT INTO public.vaccination_counts (anm_id, date, total_count, updated_at)
    VALUES (p_anm_id, p_date, GREATEST(0, p_delta), TIMEZONE('Asia/Kolkata', NOW()))
    ON CONFLICT (anm_id, date)
    DO UPDATE SET
        total_count = GREATEST(0, vaccination_counts.total_count + p_delta),
        updated_at = TIMEZONE('Asia/Kolkata', NOW())
    RETURNING total_count INTO new_count;

    RETURN new_count;
END;
$$;

-- 6. Row Level Security (RLS) Configuration
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duty_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vaccination_counts ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read profiles in their facility or all health staff; users can update their own
CREATE POLICY "Public profiles are readable by authenticated users"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

-- Duty Sessions: ANMs can insert and update their own sessions; MOIC can view
CREATE POLICY "ANM can insert own duty sessions"
    ON public.duty_sessions FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = anm_id);

CREATE POLICY "ANM can update own active duty session"
    ON public.duty_sessions FOR UPDATE
    TO authenticated
    USING (auth.uid() = anm_id);

CREATE POLICY "Duty sessions are readable by all health staff"
    ON public.duty_sessions FOR SELECT
    TO authenticated
    USING (true);

-- Live Locations: ANM can upsert own location while on duty; MOIC can read
CREATE POLICY "ANM can upsert own live location"
    ON public.live_locations FOR ALL
    TO authenticated
    USING (auth.uid() = anm_id)
    WITH CHECK (auth.uid() = anm_id);

CREATE POLICY "Live locations viewable by authenticated users"
    ON public.live_locations FOR SELECT
    TO authenticated
    USING (true);

-- Vaccination Counts: ANMs can view/edit their own; MOIC can view all in facility
CREATE POLICY "Vaccination counts readable by health staff"
    ON public.vaccination_counts FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "ANM can update own counts"
    ON public.vaccination_counts FOR ALL
    TO authenticated
    USING (auth.uid() = anm_id)
    WITH CHECK (auth.uid() = anm_id);

-- 7. Realtime Publication configuration
-- Enable realtime broadcasting for location and counter changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.duty_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vaccination_counts;
