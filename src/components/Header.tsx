import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BookOpen,
  ChevronDown,
  Database,
  Edit2,
  Folder,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Trash2,
  User as UserIcon,
  WifiOff,
  X,
} from 'lucide-react';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { Course, Folder as FolderType, User } from '../types';
import { VectorSyncIndicator } from './VectorSyncIndicator';
import { PWAInstallButton } from './PWAInstallButton';
import { CreateCourseModal } from './CreateCourseModal';

export type NavigationTab =
  | 'dashboard'
  | 'tutor'
  | 'materials'
  | 'past_papers'
  | 'study'
  | 'calendar'
  | 'rag'
  | 'diagnostics'
  | 'pwainstaller';

interface HeaderProps {
  currentUser: User | null;
  availableUsers: User[];
  onSwitchUser: (userId: string) => void;
  courses: Course[];
  activeCourse: Course | null;
  onSelectCourse: (course: Course) => void;
  folders: FolderType[];
  activeFolderId: string | null | 'all';
  onSelectFolder: (folderId: string | null | 'all') => void;
  onCreateCourse: (data: { title: string; code: string; description: string; color: string }) => Promise<Course | void> | void;
  onOpenCreateCourseModal?: () => void;
  onUpdateCourse?: (courseId: string, data: Partial<Course>) => Promise<void>;
  onDeleteCourse?: (courseId: string) => Promise<void>;
  onCreateFolder: (name: string) => void;
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  isOnline: boolean;
  onOpenSyncModal?: () => void;
  onToggleSidebar?: () => void;
  onToggleMobileSidebar?: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  availableUsers,
  onSwitchUser,
  courses,
  activeCourse,
  onSelectCourse,
  folders,
  activeFolderId,
  onSelectFolder,
  onCreateCourse,
  onOpenCreateCourseModal,
  onUpdateCourse,
  onDeleteCourse,
  onCreateFolder,
  activeTab,
  onSelectTab,
  isOnline,
  onOpenSyncModal,
  onToggleSidebar,
  onToggleMobileSidebar,
  searchQuery = '',
  onSearchChange,
}) => {
  const syncState = useSyncStatus();
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showEditCourseModal, setShowEditCourseModal] = useState(false);
  const [showDeleteCourseModal, setShowDeleteCourseModal] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeletingCourse, setIsDeletingCourse] = useState(false);
  const [isSavingCourse, setIsSavingCourse] = useState(false);

  const [editCourseTitle, setEditCourseTitle] = useState('');
  const [editCourseCode, setEditCourseCode] = useState('');
  const [editCourseDesc, setEditCourseDesc] = useState('');
  const [editCourseColor, setEditCourseColor] = useState('#4F46E5');

  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNotificationToast, setShowNotificationToast] = useState(false);

  useEffect(() => {
    if (activeCourse) {
      setEditCourseTitle(activeCourse.title);
      setEditCourseCode(activeCourse.code);
      setEditCourseDesc(activeCourse.description || '');
      setEditCourseColor(activeCourse.color || '#4F46E5');
    }
  }, [activeCourse]);

  const handleEditCourseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCourse || !onUpdateCourse || !editCourseTitle.trim() || !editCourseCode.trim()) return;
    setIsSavingCourse(true);
    try {
      await onUpdateCourse(activeCourse.id, {
        title: editCourseTitle.trim(),
        code: editCourseCode.trim(),
        description: editCourseDesc.trim(),
        color: editCourseColor,
      });
      setShowEditCourseModal(false);
    } catch (err) {
      console.error('Failed to update course:', err);
    } finally {
      setIsSavingCourse(false);
    }
  };

  const handleDeleteCourseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCourse || !onDeleteCourse) return;
    setIsDeletingCourse(true);
    try {
      await onDeleteCourse(activeCourse.id);
      setShowDeleteCourseModal(false);
      setDeleteConfirmationText('');
    } catch (err) {
      console.error('Failed to delete course:', err);
    } finally {
      setIsDeletingCourse(false);
    }
  };

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    onCreateFolder(newFolderName.trim());
    setNewFolderName('');
    setShowFolderModal(false);
  };

  const activeFolderName =
    activeFolderId === 'all'
      ? 'All Folders'
      : activeFolderId === null
      ? 'Root (Unassigned)'
      : folders.find((f) => f.id === activeFolderId)?.name || 'Selected Folder';

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Left: Mobile hamburger & Course/Folder Selectors */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onToggleMobileSidebar}
            className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Course Selector Pill */}
          <div className="flex items-center bg-slate-50 border border-slate-200/90 rounded-xl p-1 shadow-2xs">
            <span
              className="w-3 h-3 rounded-full ml-2 shrink-0 ring-2 ring-white shadow-2xs"
              style={{ backgroundColor: activeCourse?.color || '#4F46E5' }}
            />
            <div className="relative">
              <select
                aria-label="Select Course"
                value={activeCourse?.id || ''}
                onChange={(e) => {
                  const selected = courses.find((c) => c.id === e.target.value);
                  if (selected) onSelectCourse(selected);
                }}
                className="appearance-none bg-transparent pl-2.5 pr-7 py-1 text-xs sm:text-sm font-bold text-slate-800 cursor-pointer focus:outline-none max-w-[130px] sm:max-w-[200px] truncate"
              >
                {courses.length === 0 && <option value="">No Courses</option>}
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.code} • {course.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <div className="flex items-center gap-1 pl-1 border-l border-slate-200">
              <button
                onClick={() => {
                  if (onOpenCreateCourseModal) {
                    onOpenCreateCourseModal();
                  } else {
                    setShowCourseModal(true);
                  }
                }}
                title="Create New Course"
                className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center transition cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>

              {activeCourse && onUpdateCourse && (
                <button
                  onClick={() => setShowEditCourseModal(true)}
                  title="Rename / Edit Course"
                  className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center transition cursor-pointer shrink-0"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              )}

              {activeCourse && onDeleteCourse && (
                <button
                  onClick={() => {
                    setDeleteConfirmationText('');
                    setShowDeleteCourseModal(true);
                  }}
                  title="Delete Course (With Cascade Cleanup)"
                  className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Folder Selector Pill */}
          {activeCourse && (
            <div className="hidden sm:flex items-center bg-amber-50/60 border border-amber-200/80 rounded-xl p-1 shadow-2xs">
              <Folder className="w-3.5 h-3.5 text-amber-600 ml-2 shrink-0" />
              <div className="relative">
                <select
                  aria-label="Select Folder Scope"
                  value={activeFolderId === null ? 'null' : activeFolderId || 'all'}
                  onChange={(e) => {
                    const val = e.target.value;
                    onSelectFolder(val === 'all' ? 'all' : val === 'null' ? null : val);
                  }}
                  className="appearance-none bg-transparent pl-2 pr-7 py-1 text-xs sm:text-sm font-semibold text-slate-800 cursor-pointer focus:outline-none max-w-[140px] truncate"
                >
                  <option value="all">📂 All Folders</option>
                  <option value="null">📄 Root (Unassigned)</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      📁 {f.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-amber-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <button
                onClick={() => setShowFolderModal(true)}
                title="Create New Folder"
                className="w-7 h-7 rounded-lg bg-white border border-amber-200 text-amber-700 hover:bg-amber-100 flex items-center justify-center transition cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Center: Search input */}
        <div className="flex-1 max-w-md hidden md:flex mx-2">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
              placeholder={activeCourse ? `Search in ${activeCourse.code} • ${activeFolderName}…` : 'Search materials, past papers…'}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
            />
          </div>
        </div>

        {/* Right side: Indicators, User & Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {activeCourse && (
            <div className="hidden xl:flex">
              <VectorSyncIndicator
                activeCourse={activeCourse}
                activeFolderId={activeFolderId}
                folders={folders}
                onNavigateToTab={(tab) => onSelectTab(tab)}
              />
            </div>
          )}

          {/* Sync status pill */}
          {/* PWA In-App Install Prompt */}
          <PWAInstallButton className="hidden sm:inline-flex" />

          <button
            onClick={onOpenSyncModal}
            title="Open Local-First Persistence & Sync Hub"
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition shadow-2xs cursor-pointer ${
              !syncState.isOnline
                ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                : syncState.isSyncing
                ? 'bg-blue-50 text-blue-800 border-blue-300'
                : syncState.pendingCount > 0
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
            }`}
          >
            {!syncState.isOnline ? (
              <WifiOff className="w-3.5 h-3.5 text-amber-600" />
            ) : syncState.isSyncing ? (
              <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />
            ) : (
              <Database className="w-3.5 h-3.5 text-emerald-600" />
            )}
            <span className="hidden md:inline">
              {!syncState.isOnline
                ? 'Offline (IndexedDB)'
                : syncState.isSyncing
                ? 'Syncing…'
                : syncState.pendingCount > 0
                ? `${syncState.pendingCount} Pending`
                : 'Synced'}
            </span>
            <span
              className={`w-2 h-2 rounded-full ${
                !syncState.isOnline ? 'bg-amber-500' : syncState.isSyncing ? 'bg-blue-500 animate-pulse' : 'bg-emerald-500'
              }`}
            />
          </button>

          {/* Notifications button */}
          <div className="relative">
            <button
              onClick={() => setShowNotificationToast(!showNotificationToast)}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer relative"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-600 ring-2 ring-white" />
            </button>

            {showNotificationToast && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-50 text-xs animate-in fade-in">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                  <span className="font-bold text-slate-900">Notifications</span>
                  <span className="text-[10px] text-slate-400">Study Buddy AI</span>
                </div>
                <div className="space-y-2">
                  <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100">
                    <span className="font-bold text-indigo-900 block">Vector RAG Ready</span>
                    <span className="text-slate-600 text-[11px] block mt-0.5">
                      Grounding active for {activeCourse?.code || 'your course'}. All questions cited.
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100">
                    <span className="font-bold text-emerald-900 block">Offline Cache Up to Date</span>
                    <span className="text-slate-600 text-[11px] block mt-0.5">
                      IndexedDB synchronized for uninterrupted offline learning.
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Persona Switcher */}
          <div className="relative flex items-center pl-2 ml-1 border-l border-slate-200">
            <div className="hidden lg:block text-right leading-tight mr-2.5">
              <span className="text-xs font-bold text-slate-900 block truncate max-w-[110px]">
                {currentUser?.name || 'Alex Chen'}
              </span>
              <span className="text-[10px] text-slate-400 block truncate max-w-[110px]">
                {currentUser?.email.split('@')[0] || 'student'}
              </span>
            </div>

            <div className="relative group">
              <select
                aria-label="Switch User Persona"
                value={currentUser?.id || ''}
                onChange={(e) => onSwitchUser(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full"
              >
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>

              <div className="w-8 h-8 rounded-full sb-gradient-primary text-white flex items-center justify-center font-bold text-xs shadow-sm ring-2 ring-indigo-100">
                {(currentUser?.name || 'A').charAt(0)}
              </div>
            </div>

            <button
              onClick={() => onSelectTab('diagnostics')}
              className="p-1.5 ml-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition hidden sm:flex cursor-pointer"
              title="Settings & Diagnostics"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

          <div className="hidden lg:flex">
            <PWAInstallButton />
          </div>
        </div>
      </div>

      {/* Modal: Create Course */}
      <CreateCourseModal
        isOpen={showCourseModal}
        onClose={() => setShowCourseModal(false)}
        onCreateCourse={onCreateCourse}
      />

      {/* Modal: Create Folder */}
      {showFolderModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Add Study Folder</h3>
                <p className="text-xs text-slate-500">Isolate document chunks within {activeCourse?.code}.</p>
              </div>
              <button onClick={() => setShowFolderModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFolderSubmit} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Folder Name</label>
                <input
                  type="text"
                  placeholder="e.g. Week 1: Optimization Basics"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowFolderModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow transition"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit / Rename Course */}
      {showEditCourseModal && activeCourse && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Rename / Edit Course</h3>
                <p className="text-xs text-slate-500">Update course details and metadata.</p>
              </div>
              <button
                onClick={() => setShowEditCourseModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditCourseSubmit} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Course Code</label>
                <input
                  type="text"
                  value={editCourseCode}
                  onChange={(e) => setEditCourseCode(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Course Title</label>
                <input
                  type="text"
                  value={editCourseTitle}
                  onChange={(e) => setEditCourseTitle(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editCourseDesc}
                  onChange={(e) => setEditCourseDesc(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Color Accent</label>
                <div className="flex items-center gap-2">
                  {['#4F46E5', '#0D9488', '#8B5CF6', '#F59E0B', '#EC4899', '#3B82F6'].map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setEditCourseColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition ${
                        editCourseColor === c ? 'border-slate-900 scale-110 shadow' : 'border-white shadow-2xs'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditCourseModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCourse}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow transition disabled:opacity-50"
                >
                  {isSavingCourse ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Course with Safety Warning & Confirmation */}
      {showDeleteCourseModal && activeCourse && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-red-100 animate-in fade-in space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-red-50 text-red-600 border border-red-200 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Delete Course "{activeCourse.code}"?
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeCourse.title}
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-red-50/60 border border-red-200 rounded-xl text-xs text-red-900 space-y-2">
              <p className="font-semibold">
                ⚠️ Warning: Cascaded Deletion
              </p>
              <p className="leading-relaxed text-[11px] text-red-800">
                Deleting this course will permanently remove all associated study folders, uploaded documents, extracted vector embeddings, tutor chat history, and exam revision progress. Database and storage records will be purged immediately.
              </p>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="block text-slate-700 font-semibold">
                Type <span className="font-mono font-bold text-red-700 select-all">{activeCourse.code}</span> to confirm deletion:
              </label>
              <input
                type="text"
                placeholder={activeCourse.code}
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-500 outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteCourseModal(false);
                  setDeleteConfirmationText('');
                }}
                disabled={isDeletingCourse}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCourseSubmit}
                disabled={deleteConfirmationText.trim().toUpperCase() !== activeCourse.code.toUpperCase() || isDeletingCourse}
                className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingCourse ? 'Deleting Course & Records…' : 'Delete Course'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
