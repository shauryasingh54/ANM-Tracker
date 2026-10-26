# ANM Live Location Tracking & Vaccination Counting Website

A mobile-friendly, real-time live location tracking and vaccination counter application designed for **Primary Health Centres (PHCs)** and **Community Health Centres (CHCs)** in India under the National Health Mission (NHM).

---

## 🌟 Key Features

### 1. ANM Mobile-First Dashboard (`/anm`)
- **Simple, Clear Interface**: Optimized for field workers on mobile smartphones.
- **Start Work & End Work**:
  - One large **Start Work** button triggers browser GPS location permission.
  - Displays **"On Duty – Location Sharing Active"** with a pulsing live status badge.
  - Automatically transmits GPS coordinates every 10–30 seconds while on duty.
  - Immediate **End Work** button terminates tracking instantly.
- **Embedded Mini Map**: Shows the ANM's current live location with accuracy radius and re-center button.
- **Single Vaccination Counter ("Today's Vaccinations")**:
  - Large display showing **Total Vaccinations Today**.
  - **+1 Button**: Increases count by 1 with instant optimistic response and database persistence.
  - **−1 Button**: Corrects accidental entries (never allows negative counts).
  - **Automatic Saving**: No Save button required.
  - **Automatic Midnight Reset**: Rolls over to 0 at 00:00 India Standard Time (IST), while preserving all historical counts in the database.
- **Browser Geolocation Advisory**: Explains mobile background restrictions and integrates Screen Wake Lock to help maintain active tracking.
- **Simulation Mode**: Built-in walking simulator for testing GPS movement on stationary laptops/desktops.

### 2. MOIC Desktop-First Command Center (`/moic`)
- **Control Room GIS Map**: Full interactive Leaflet & OpenStreetMap view.
- **Real-time Markers**:
  - Displays all on-duty ANMs in Rajasthan (Jaipur rural sector: Jamwa Ramgarh, Bassi, Achrol).
  - Pulsing radar rings for live active ANMs.
  - Stale GPS warnings (>2 minutes) in amber.
  - Marker click popups display: Staff Name, Employee ID, Assigned Facility, Duty Status, Last GPS Update, and Today's Vaccinations.
- **Live Metric Summary Cards**:
  - Total ANMs
  - On Duty (Active)
  - Off Duty
  - **Total Vaccinations Today** (aggregate across all ANMs)
- **Searchable Field Roster**:
  - Search by staff name, employee ID, or facility.
  - Displays **Today's Vaccinations: X** next to each ANM.
  - Live synchronization without page refreshes.
  - Jurisdiction filtering by PHC / CHC facility.

---

## 🛠️ Technology Stack

- **Framework**: Next.js 15 (App Router, React 19, TypeScript)
- **Styling**: Tailwind CSS (Indian healthcare color theme)
- **Mapping**: Leaflet 1.9 & OpenStreetMap (SSR-safe dynamic rendering)
- **Database**: Supabase PostgreSQL with Row Level Security (RLS)
- **Realtime**: Supabase Realtime + Cross-tab BroadcastChannel sync
- **Icons**: Lucide React

---

## 🚀 Quick Start Guide

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔐 Demo Credentials (Rajasthan Health Staff)

| Role | Name | Employee ID | Facility | Initial Doses |
| :--- | :--- | :--- | :--- | :--- |
| **ANM** | Sunita Sharma | `RJ-ANM-4012` | PHC Jamwa Ramgarh | 0 |
| **ANM** | Priyanka Meena | `RJ-ANM-4015` | PHC Jamwa Ramgarh | 18 (On Duty) |
| **ANM** | Kavita Devi | `RJ-ANM-4028` | CHC Bassi | 24 (On Duty) |
| **ANM** | Anita Gurjar | `RJ-ANM-4033` | PHC Achrol | 0 (Off Duty) |
| **MOIC** | Dr. Rajesh Verma | `MOIC-RJ-1001` | PHC Jamwa Ramgarh | In-Charge Admin |

*Note: In demo mode, entering any 4+ character password succeeds.*

---

## 🗄️ Supabase Deployment Instructions

If you wish to link your own Supabase instance:

1. Create a new Supabase project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** in the Supabase Dashboard.
3. Copy and run the contents of [`supabase/schema.sql`](supabase/schema.sql).
4. Run the contents of [`supabase/seed.sql`](supabase/seed.sql).
5. In your project settings, copy `Project URL` and `anon public key`.
6. Add them to `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```
7. Re-start the dev server (`npm run dev`). The app will display **"Supabase Connected"** in the top navigation bar.

---

## 📡 Live Location & Synchronization Architecture

1. **Atomic Counter Function**:
   - Uses PostgreSQL RPC `increment_vaccination_count` with `ON CONFLICT (anm_id, date) DO UPDATE SET total_count = GREATEST(0, ...)` to ensure atomic updates under rapid tapping.
2. **Dual-Mode Sync**:
   - Automatically synchronizes across browser tabs using `BroadcastChannel` in demo mode, and connects to Supabase Realtime channels when configured.
3. **Daily IST Rollover**:
   - All counts are grouped strictly by Indian Standard Time (`Asia/Kolkata` date). When midnight strikes in India, the displayed daily counter resets to zero while previous days' records remain safely archived in the database.
