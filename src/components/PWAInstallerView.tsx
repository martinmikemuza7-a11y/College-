import React from 'react';
import {
  CheckCircle2,
  Cpu,
  Database,
  Download,
  Folder,
  Globe,
  Monitor,
  Share2,
  Shield,
  Smartphone,
  Sparkles,
  Zap,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallerView: React.FC = () => {
  const { isInstallable, isInstalled, triggerInstall } = usePWAInstall();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 animate-in fade-in duration-150">
      {/* Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white rounded-2xl p-6 lg:p-8 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <span className="px-3 py-1 rounded-full bg-white/10 text-xs font-bold border border-white/20 text-indigo-300 inline-block mb-3">
              Progressive Web App (PWA)
            </span>
            <h2 className="text-2xl font-bold tracking-tight">Study Buddy AI Desktop & Mobile App</h2>
            <p className="text-sm text-indigo-100 max-w-xl mt-2 leading-relaxed">
              Install as a standalone application on macOS, Windows, ChromeOS, iOS, or Android with zero installation overhead and offline IndexedDB support.
            </p>
          </div>

          <div className="shrink-0">
            {isInstalled ? (
              <div className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500/20 border border-emerald-400 text-emerald-300 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>Installed & Standalone</span>
              </div>
            ) : isInstallable ? (
              <button
                onClick={() => triggerInstall()}
                className="px-6 py-3 bg-white text-indigo-700 font-bold rounded-xl text-sm shadow-md hover:bg-indigo-50 transition flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Install Application Now
              </button>
            ) : (
              <div className="px-4 py-3 rounded-xl bg-white/10 border border-white/15 text-xs text-indigo-200">
                <span>Available via browser menu (Add to Home Screen / Install)</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Benefits Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sb-card p-5 space-y-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Zap className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">Instant Launch</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Launches in a dedicated chromeless window without browser tabs or distractions.
          </p>
        </div>

        <div className="sb-card p-5 space-y-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Database className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">Offline Study</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Courses, notes, and recall quizzes cache in IndexedDB for study anywhere without WiFi.
          </p>
        </div>

        <div className="sb-card p-5 space-y-2">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
            <Smartphone className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">Mobile Optimized</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Touch-friendly controls, native bottom navigation, and zero horizontal scrolling on mobile.
          </p>
        </div>
      </div>
    </div>
  );
};
