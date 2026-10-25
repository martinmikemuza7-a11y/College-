import React, { useState } from 'react';
import { Download, Share2, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { isInstallable, isInstalled, isIOS, triggerInstall } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Suppress completely if already running as an installed PWA
  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        onClick={() => triggerInstall()}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition shadow-2xs cursor-pointer ${className}`}
        title="Install Study Buddy AI as native PWA application"
      >
        <Download className="w-3.5 h-3.5 text-indigo-600" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition shadow-2xs cursor-pointer ${className}`}
          title="Install Study Buddy AI on iPhone / iPad"
        >
          <Share2 className="w-3.5 h-3.5 text-indigo-600" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">Install on iPhone / iPad</h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                1. Tap the <strong className="text-slate-900">Share</strong> button in the Safari navigation bar.<br />
                2. Scroll down and tap <strong className="text-slate-900">Add to Home Screen</strong>.<br />
                3. Tap <strong className="text-slate-900">Add</strong> in the top-right corner to launch chromeless.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
