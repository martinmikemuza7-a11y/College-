import { api } from './api';
import { offlineDb } from './offlineDb';

type SyncListener = (state: { isOnline: boolean; isSyncing: boolean; pendingCount: number }) => void;

class SyncManager {
  private listeners: Set<SyncListener> = new Set();
  private isOnlineState = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private isSyncingState = false;
  private pendingCountState = 0;
  private activeCourseId: string | null = null;
  private activeFolderId: string | null | 'all' = 'all';

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());
      this.refreshStats();
    }
  }

  setActiveContext(courseId: string | null, folderId: string | null | 'all') {
    this.activeCourseId = courseId;
    this.activeFolderId = folderId;
  }

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener({
      isOnline: this.isOnlineState,
      isSyncing: this.isSyncingState,
      pendingCount: this.pendingCountState,
    });
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) {
      listener({
        isOnline: this.isOnlineState,
        isSyncing: this.isSyncingState,
        pendingCount: this.pendingCountState,
      });
    }
  }

  private handleOnline() {
    this.isOnlineState = true;
    this.notify();
    this.replaySyncQueue();
  }

  private handleOffline() {
    this.isOnlineState = false;
    this.notify();
  }

  async refreshStats() {
    try {
      const actions = await offlineDb.getPendingSyncActions();
      this.pendingCountState = actions.length;
      this.notify();
    } catch {
      // ignore
    }
  }

  async replaySyncQueue() {
    if (this.isSyncingState || !navigator.onLine) return;
    this.isSyncingState = true;
    this.notify();

    try {
      const actions = await offlineDb.getPendingSyncActions();
      for (const action of actions) {
        try {
          if (action.type === 'chat_message') {
            await api.sendTutorChat({
              courseId: action.payload.courseId,
              folderId: action.payload.folderId,
              message: action.payload.query,
              tutorStyle: action.payload.tutorStyle,
            });
          } else if (action.type === 'update_material') {
            await api.updateMaterial(action.payload.materialId, action.payload.updates);
          } else if (action.type === 'move_material') {
            await api.moveMaterial(action.payload.materialId, action.payload.targetFolderId);
          } else if (action.type === 'delete_material') {
            await api.deleteMaterial(action.payload.materialId);
          }
          await offlineDb.removeSyncAction(action.id);
        } catch (itemErr) {
          console.warn('[SyncManager] Failed to replay action:', action, itemErr);
          // Stop queue if offline
          if (!navigator.onLine) break;
        }
      }
    } finally {
      this.isSyncingState = false;
      await this.refreshStats();
    }
  }

  async triggerManualSync() {
    if (navigator.onLine) {
      await this.replaySyncQueue();
    }
  }
}

export const syncManager = new SyncManager();
