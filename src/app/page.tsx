'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  loginWithEmployeeId,
  getCurrentUser,
} from '@/lib/syncEngine';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { ShieldCheck, UserCheck, Stethoscope, MapPin, Database, ChevronRight, Activity } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'anm' | 'moic'>('anm');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [supabaseActive, setSupabaseActive] = useState(false);

  useEffect(() => {
    setSupabaseActive(isSupabaseConfigured());
    const existing = getCurrentUser();
    if (existing) {
      if (existing.role === 'moic') {
        router.push('/moic');
      } else {
        router.push('/anm');
      }
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId.trim()) {
      setError('Please enter your Employee ID');
      return;
    }

    setLoading(true);
    setError(null);

    const result = await loginWithEmployeeId(employeeId, role);
    setLoading(false);

    if (result.user) {
      if (result.user.role === 'moic') {
        router.push('/moic');
      } else {
        router.push('/anm');
      }
    } else {
      setError(result.error || 'Authentication failed. Please check your credentials.');
    }
  };

  const quickLogin = async (demoId: string, demoRole: 'anm' | 'moic') => {
    setLoading(true);
    setError(null);
    const result = await loginWithEmployeeId(demoId, demoRole);
    setLoading(false);
    if (result.user) {
      if (demoRole === 'moic') {
        router.push('/moic');
      } else {
        router.push('/anm');
      }
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-emerald-50/20 to-slate-100 flex flex-col justify-between p-4 md:p-8">
      {/* Top Bar */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/20">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">ANM Live Tracker</h1>
            <p className="text-xs font-medium text-slate-500">National Health Mission • Rajasthan</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-white border border-slate-200/80 shadow-sm text-slate-700">
          <Database className={`w-3.5 h-3.5 ${supabaseActive ? 'text-emerald-600' : 'text-blue-500'}`} />
          <span>{supabaseActive ? 'Supabase Connected' : 'Demo & Local Sync Mode'}</span>
        </div>
      </header>

      {/* Main Login Card */}
      <div className="max-w-md mx-auto w-full my-auto py-6">
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200/80 p-6 md:p-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Staff Portal Login</h2>
            <p className="text-sm text-slate-500 mt-1">
              Select your role to access your field or monitoring dashboard
            </p>
          </div>

          {/* Role Selector Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => {
                setRole('anm');
                setEmployeeId('');
                setError(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                role === 'anm'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>ANM Field Staff</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setRole('moic');
                setEmployeeId('');
                setError(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                role === 'moic'
                  ? 'bg-white text-navy-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Stethoscope className="w-4 h-4" />
              <span>MOIC Admin</span>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2">
              <span className="font-bold">Error:</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Employee ID
              </label>
              <input
                type="text"
                placeholder={role === 'anm' ? 'e.g. RJ-ANM-4012' : 'e.g. MOIC-RJ-1001'}
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 font-medium placeholder-slate-400 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 font-medium placeholder-slate-400 text-sm"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Default demo password: any 4+ characters
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 rounded-xl font-bold text-white text-sm shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 ${
                role === 'anm'
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                  : 'bg-slate-900 hover:bg-slate-800 shadow-slate-900/20'
              } disabled:opacity-60`}
            >
              {loading ? (
                <span>Logging in...</span>
              ) : (
                <>
                  <span>Sign In to {role === 'anm' ? 'ANM Dashboard' : 'MOIC Dashboard'}</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Personas */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider text-center mb-3">
              Fast Demo Logins (Rajasthan PHC/CHC)
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => quickLogin('RJ-ANM-4012', 'anm')}
                className="w-full text-left p-2.5 rounded-xl border border-emerald-100 bg-emerald-50/50 hover:bg-emerald-50 flex items-center justify-between text-xs text-slate-800 group transition-all"
              >
                <div>
                  <div className="font-bold text-emerald-900">Sunita Sharma (ANM)</div>
                  <div className="text-slate-500 text-[11px]">ID: RJ-ANM-4012 • PHC Jamwa Ramgarh</div>
                </div>
                <span className="px-2 py-1 bg-emerald-600 text-white rounded-md font-semibold text-[10px]">
                  Use ANM
                </span>
              </button>

              <button
                type="button"
                onClick={() => quickLogin('MOIC-RJ-1001', 'moic')}
                className="w-full text-left p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs text-slate-800 group transition-all"
              >
                <div>
                  <div className="font-bold text-slate-900">Dr. Rajesh Verma (MOIC)</div>
                  <div className="text-slate-500 text-[11px]">ID: MOIC-RJ-1001 • In-Charge Admin</div>
                </div>
                <span className="px-2 py-1 bg-slate-900 text-white rounded-md font-semibold text-[10px]">
                  Use MOIC
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto w-full text-center text-xs text-slate-500 py-3">
        Built for Primary & Community Health Centres • Health Department Government of Rajasthan
      </footer>
    </main>
  );
}
