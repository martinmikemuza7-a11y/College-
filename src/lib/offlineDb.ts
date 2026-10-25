import { Course, Folder, Material, TutorMessage } from '../types';

const DB_NAME = 'StudyBuddyAI_OfflineDB';
const DB_VERSION = 2;

export interface OfflineSyncAction {
  id: string;
  userId: string;
  type: 'upload_material' | 'chat_message' | 'update_material' | 'delete_material' | 'move_material';
  payload: any;
  createdAt: number;
}

class OfflineDatabase {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB not supported in this environment'));
        return;
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('courses')) {
          db.createObjectStore('courses', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('folders')) {
          db.createObjectStore('folders', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('materials')) {
          db.createObjectStore('materials', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('chat_messages')) {
          db.createObjectStore('chat_messages', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  // Courses
  async getCourses(userId: string): Promise<Course[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction('courses', 'readonly');
        const store = tx.objectStore('courses');
        const req = store.getAll();
        req.onsuccess = () => {
          const all: Course[] = req.result || [];
          resolve(all.filter((c) => c.ownerId === userId));
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  async saveCourses(userId: string, courses: Course[]): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction('courses', 'readwrite');
      const store = tx.objectStore('courses');
      for (const c of courses) {
        store.put(c);
      }
    } catch (err) {
      console.warn('[IndexedDB] saveCourses error:', err);
    }
  }

  // Folders
  async getFolders(courseId: string): Promise<Folder[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction('folders', 'readonly');
        const store = tx.objectStore('folders');
        const req = store.getAll();
        req.onsuccess = () => {
          const all: Folder[] = req.result || [];
          resolve(all.filter((f) => f.courseId === courseId));
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  async saveFolders(courseId: string, folders: Folder[]): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction('folders', 'readwrite');
      const store = tx.objectStore('folders');
      for (const f of folders) {
        store.put(f);
      }
    } catch (err) {
      console.warn('[IndexedDB] saveFolders error:', err);
    }
  }

  // Materials
  async getMaterials(userId: string, courseId: string, folderId?: string | null | 'all'): Promise<Material[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction('materials', 'readonly');
        const store = tx.objectStore('materials');
        const req = store.getAll();
        req.onsuccess = () => {
          let list: Material[] = req.result || [];
          list = list.filter((m) => m.ownerId === userId && m.courseId === courseId);
          if (folderId !== undefined && folderId !== 'all') {
            if (folderId === 'null' || folderId === null) {
              list = list.filter((m) => m.folderId === null);
            } else {
              list = list.filter((m) => m.folderId === folderId);
            }
          }
          resolve(list);
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  async saveMaterial(userId: string, material: Material): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction('materials', 'readwrite');
      tx.objectStore('materials').put(material);
    } catch (err) {
      console.warn('[IndexedDB] saveMaterial error:', err);
    }
  }

  async saveMaterials(userId: string, courseId: string, folderId: any, materials: Material[]): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction('materials', 'readwrite');
      const store = tx.objectStore('materials');
      for (const m of materials) {
        store.put(m);
      }
    } catch (err) {
      console.warn('[IndexedDB] saveMaterials error:', err);
    }
  }

  async updateMaterialOffline(userId: string, materialId: string, updates: Partial<Material>): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction('materials', 'readwrite');
      const store = tx.objectStore('materials');
      const req = store.get(materialId);
      req.onsuccess = () => {
        const mat = req.result;
        if (mat) {
          const updated = { ...mat, ...updates, updatedAt: new Date().toISOString() };
          store.put(updated);
        }
      };
    } catch (err) {
      console.warn('[IndexedDB] updateMaterialOffline error:', err);
    }
  }

  async deleteMaterialOffline(userId: string, materialId: string): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction('materials', 'readwrite');
      tx.objectStore('materials').delete(materialId);
    } catch (err) {
      console.warn('[IndexedDB] deleteMaterialOffline error:', err);
    }
  }

  // Chat Messages
  async getChatMessages(userId: string, courseId: string, folderId?: string | null | 'all'): Promise<TutorMessage[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction('chat_messages', 'readonly');
        const store = tx.objectStore('chat_messages');
        const req = store.getAll();
        req.onsuccess = () => {
          const all = req.result || [];
          const list = all
            .filter((m: any) => m.userId === userId && m.courseId === courseId)
            .map((m: any) => m.message);
          resolve(list);
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  async saveChatMessages(userId: string, courseId: string, folderId: any, messages: TutorMessage[]): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction('chat_messages', 'readwrite');
      const store = tx.objectStore('chat_messages');
      for (const msg of messages) {
        store.put({
          id: msg.id,
          userId,
          courseId,
          folderId,
          message: msg,
        });
      }
    } catch (err) {
      console.warn('[IndexedDB] saveChatMessages error:', err);
    }
  }

  async appendChatMessage(userId: string, courseId: string, folderId: any, message: TutorMessage, isOffline = false, syncStatus = 'synced'): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction('chat_messages', 'readwrite');
      tx.objectStore('chat_messages').put({
        id: message.id,
        userId,
        courseId,
        folderId,
        message,
        isOffline,
        syncStatus,
      });
    } catch (err) {
      console.warn('[IndexedDB] appendChatMessage error:', err);
    }
  }

  async clearChatOffline(userId: string, courseId: string, folderId?: string | null | 'all'): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction('chat_messages', 'readwrite');
      const store = tx.objectStore('chat_messages');
      const req = store.getAll();
      req.onsuccess = () => {
        const all = req.result || [];
        for (const item of all) {
          if (item.userId === userId && item.courseId === courseId) {
            store.delete(item.id);
          }
        }
      };
    } catch (err) {
      console.warn('[IndexedDB] clearChatOffline error:', err);
    }
  }

  // Offline Sync Queue
  async enqueueSyncAction(action: Omit<OfflineSyncAction, 'id' | 'createdAt'>): Promise<string> {
    const id = `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const fullAction: OfflineSyncAction = {
      ...action,
      id,
      createdAt: Date.now(),
    };
    try {
      const db = await this.getDB();
      const tx = db.transaction('sync_queue', 'readwrite');
      tx.objectStore('sync_queue').put(fullAction);
    } catch (err) {
      console.warn('[IndexedDB] enqueueSyncAction error:', err);
    }
    return id;
  }

  async getPendingSyncActions(): Promise<OfflineSyncAction[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction('sync_queue', 'readonly');
        const store = tx.objectStore('sync_queue');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  async removeSyncAction(id: string): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction('sync_queue', 'readwrite');
      tx.objectStore('sync_queue').delete(id);
    } catch (err) {
      console.warn('[IndexedDB] removeSyncAction error:', err);
    }
  }
}

export const offlineDb = new OfflineDatabase();
