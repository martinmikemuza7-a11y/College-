import React from 'react';
import { Database, RefreshCw, WifiOff } from 'lucide-react';
import { useSyncStatus } from '../hooks/useSyncStatus';

interface OfflineBannerProps {
  onOpenSyncModal: () => void;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ onOpenSyncModal }) => {
  const syncState = useSyncStatus();

  // If online, not syncing, and no pending items, hide banner
  if (syncState.isOnline && !syncState.isSyncing && syncState.pendingCount === 0) {
    return null;
  }

  return (
    <div
      className={`border-b px-4 py-2 text-xs flex items-center justify-between gap-3 transition-colors ${
        !syncState.isOnline
          ? 'bg-amber-50 border-amber-200 text-amber-900'
          : syncState.isSyncing
          ? 'bg-blue-50 border-blue-200 text-blue-900'
          : 'bg-indigo-50 border-indigo-200 text-indigo-900'
      }`}
    >
      <div className="flex items-center gap-2 max-w-4xl">
        {!syncState.isOnline ? (
          <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
        ) : syncState.isSyncing ? (
          <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
        ) : (
          <Database className="w-4 h-4 text-indigo-600 shrink-0" />
        )}

        <div className="leading-tight">
          {!syncState.isOnline ? (
            <span>
              <strong className="font-semibold">Offline Mode Active:</strong> Serving cached study materials and recall quizzes from IndexedDB.
              {syncState.pendingCount > 0 &&
                ` (${syncState.pendingCount} action${syncState.pendingCount > 1 ? 's' : ''} queued to sync when reconnected)`}
            </span>
          ) : syncState.isSyncing ? (
            <span>
              <strong className="font-semibold">Syncing with Server:</strong> Replaying offline mutations and refreshing local IndexedDB cache…
            </span>
          ) : (
            <span>
              <strong className="font-semibold">Pending Changes:</strong> {syncState.pendingCount} local action{syncState.pendingCount > 1 ? 's' : ''} queued to sync.
            </span>
          )}
        </div>
      </div>

      <button
        onClick={onOpenSyncModal}
        className="text-xs font-semibold underline hover:no-underline cursor-pointer shrink-0 text-slate-800"
      >
        Storage & Sync Hub
      </button>
    </div>
  );
};
