import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Database,
  HardDrive,
  RefreshCw,
  Wifi,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { offlineDb, OfflineSyncAction } from '../lib/offlineDb';
import { syncManager } from '../lib/syncManager';
import { Course } from '../types';

interface OfflineSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCourse: Course | null;
  onTriggerRefresh?: () => void;
}

export const OfflineSyncModal: React.FC<OfflineSyncModalProps> = ({
  isOpen,
  onClose,
  activeCourse,
  onTriggerRefresh,
}) => {
  const syncState = useSyncStatus();
  const [pendingActions, setPendingActions] = useState<OfflineSyncAction[]>([]);
  const [isReplaying, setIsReplaying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPending();
    }
  }, [isOpen, syncState.pendingCount]);

  const loadPending = async () => {
    try {
      const actions = await offlineDb.getPendingSyncActions();
      setPendingActions(actions);
    } catch (err) {
      console.warn('Failed to load pending sync actions:', err);
    }
  };

  const handleForceSync = async () => {
    setIsReplaying(true);
    try {
      await syncManager.triggerManualSync();
      if (onTriggerRefresh) onTriggerRefresh();
      await loadPending();
    } finally {
      setIsReplaying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl max-w-xl w-full max-h-[85vh] overflow-hidden shadow-2xl border border-slate-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                Local-First Persistence & Sync Hub
              </h3>
              <p className="text-xs text-slate-500">
                IndexedDB storage • Offline queue replay
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/50 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs sm:text-sm">
          {/* Status banner */}
          <div
            className={`p-4 rounded-xl border flex items-center justify-between ${
              syncState.isOnline
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                : 'bg-amber-50/70 border-amber-200 text-amber-900'
            }`}
          >
            <div className="flex items-center gap-3">
              {syncState.isOnline ? (
                <Wifi className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <WifiOff className="w-5 h-5 text-amber-600 shrink-0" />
              )}
              <div>
                <span className="font-bold block text-sm">
                  {syncState.isOnline ? 'Online — Connected to Server' : 'Offline — IndexedDB Active'}
                </span>
                <span className="text-xs opacity-80">
                  {syncState.isOnline
                    ? 'Mutations sync automatically with the server.'
                    : 'All study changes are stored locally in IndexedDB and will sync when reconnected.'}
                </span>
              </div>
            </div>

            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/80 border border-current shrink-0">
              {syncState.isOnline ? 'Connected' : 'Offline'}
            </span>
          </div>

          {/* Architecture info */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <span className="text-slate-500 font-semibold block uppercase text-[10px]">IndexedDB Cache</span>
              <span className="font-bold text-slate-900 block text-sm">Active & Zero-Latency</span>
              <p className="text-slate-500 text-[11px]">Instant cached loads for courses, folders, and materials.</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <span className="text-slate-500 font-semibold block uppercase text-[10px]">Offline Mutation Queue</span>
              <span className="font-bold text-indigo-600 block text-sm">{pendingActions.length} Actions Queued</span>
              <p className="text-slate-500 text-[11px]">Pending questions and edits to replay.</p>
            </div>
          </div>

          {/* Pending queue items list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                Sync Queue ({pendingActions.length})
              </span>
              {pendingActions.length > 0 && syncState.isOnline && (
                <button
                  onClick={handleForceSync}
                  disabled={isReplaying}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                >
                  {isReplaying ? 'Syncing now…' : 'Sync All Now'}
                </button>
              )}
            </div>

            {pendingActions.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50 text-slate-500 text-xs">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                <span className="font-semibold block text-slate-800">All local mutations are synced</span>
                <span className="text-[11px] text-slate-400">No actions waiting in queue.</span>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                {pendingActions.map((action) => (
                  <div key={action.id} className="p-3 bg-white flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-900 block capitalize">{action.type.replace('_', ' ')}</span>
                      <span className="text-[11px] text-slate-400">Created: {new Date(action.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      Pending
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Current Course: <strong>{activeCourse?.code || 'None'}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
