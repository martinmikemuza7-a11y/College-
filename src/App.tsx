import React, { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  Cpu,
  Download,
  FileText,
  Folder,
  Layers,
  Sparkles,
} from 'lucide-react';
import { DashboardView } from './components/DashboardView';
import { DiagnosticsView } from './components/DiagnosticsView';
import { Header, NavigationTab } from './components/Header';
import { MaterialsView } from './components/MaterialsView';
import { OfflineBanner } from './components/OfflineBanner';
import { OfflineSyncModal } from './components/OfflineSyncModal';
import { PastPapersView } from './components/PastPapersView';
import { PWAInstallerView } from './components/PWAInstallerView';
import { QuizView } from './components/QuizView';
import { RagExplorerView } from './components/RagExplorerView';
import { Sidebar } from './components/Sidebar';
import { StudyPlannerView } from './components/StudyPlannerView';
import { TutorView } from './components/TutorView';
import { UploadQueueWidget } from './components/UploadQueueWidget';
import { CreateCourseModal } from './components/CreateCourseModal';
import { useSyncStatus } from './hooks/useSyncStatus';
import { api, getActiveUserId, setActiveUserId } from './lib/api';
import { offlineDb } from './lib/offlineDb';
import { syncManager } from './lib/syncManager';
import { Course, Folder as FolderType, Material, QueuedUploadItem, QuizQuestion, User } from './types';

export default function App() {
  const syncState = useSyncStatus();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null | 'all'>('all');

  // Sidebar Layout State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const pathToTab = (pathname: string): NavigationTab => {
    const clean = pathname.toLowerCase().replace(/\/$/, '') || '/';
    if (clean === '/ai-tutor' || clean === '/tutor') return 'tutor';
    if (clean === '/courses' || clean === '/materials') return 'materials';
    if (clean === '/past-papers' || clean === '/past_papers') return 'past_papers';
    if (clean === '/study' || clean === '/recall') return 'study';
    if (clean === '/calendar' || clean === '/planner') return 'calendar';
    if (clean === '/rag') return 'rag';
    if (clean === '/diagnostics' || clean === '/progress' || clean === '/settings') return 'diagnostics';
    if (clean === '/pwainstaller' || clean === '/install' || clean === '/pwa') return 'pwainstaller';
    return 'dashboard';
  };

  const tabToPath = (tab: NavigationTab): string => {
    switch (tab) {
      case 'dashboard': return '/';
      case 'tutor': return '/ai-tutor';
      case 'materials': return '/courses';
      case 'past_papers': return '/past-papers';
      case 'study': return '/study';
      case 'calendar': return '/calendar';
      case 'rag': return '/rag';
      case 'diagnostics': return '/settings';
      case 'pwainstaller': return '/pwainstaller';
      default: return '/';
    }
  };

  const [activeTab, setActiveTabState] = useState<NavigationTab>(() => {
    if (typeof window !== 'undefined') {
      return pathToTab(window.location.pathname);
    }
    return 'dashboard';
  });

  const setActiveTab = (tab: NavigationTab) => {
    setActiveTabState(tab);
    setMobileSidebarOpen(false);
    if (typeof window !== 'undefined') {
      const targetPath = tabToPath(tab);
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, '', targetPath);
      }
    }
  };

  // Browser navigation history popstate listener
  useEffect(() => {
    const handlePopState = () => {
      setActiveTabState(pathToTab(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showCreateCourseModal, setShowCreateCourseModal] = useState(false);
  const [initialPastPaperForExam, setInitialPastPaperForExam] = useState<string | null>(null);
  const [initialDocumentForQuiz, setInitialDocumentForQuiz] = useState<string | null>(null);

  // Global Background Vector Indexing Queue
  const [uploadQueue, setUploadQueue] = useState<QueuedUploadItem[]>([]);
  const [isQueueMinimized, setIsQueueMinimized] = useState(false);
  const isProcessingQueueRef = useRef(false);
  const [tutorUploadNotice, setTutorUploadNotice] = useState<string | null>(null);

  // Keep SyncManager updated with active context
  useEffect(() => {
    syncManager.setActiveContext(activeCourse?.id || null, activeFolderId);
  }, [activeCourse?.id, activeFolderId]);

  // Initial user and courses load
  useEffect(() => {
    loadUserAndCourses();
  }, []);

  // Background Vector Indexing Worker
  useEffect(() => {
    const processNextQueueItem = async () => {
      if (isProcessingQueueRef.current) return;
      const nextItem = uploadQueue.find((item) => item.status === 'queued');
      if (!nextItem) return;

      isProcessingQueueRef.current = true;

      setUploadQueue((prev) =>
        prev.map((item) =>
          item.id === nextItem.id
            ? {
                ...item,
                status: 'uploading',
                statusMessage: 'Uploading & extracting text…',
                progressPercent: 30,
                startedAt: Date.now(),
              }
            : item
        )
      );

      try {
        setTimeout(() => {
          setUploadQueue((prev) =>
            prev.map((item) =>
              item.id === nextItem.id && item.status === 'uploading'
                ? {
                    ...item,
                    status: 'indexing',
                    statusMessage: 'Generating 768d embeddings & vector indexing…',
                    progressPercent: 65,
                  }
                : item
            )
          );
        }, 300);

        let uploadRes: { material: Material; questions?: QuizQuestion[] };
        const uploadOptions = {
          autoGenerateQuestions: nextItem.autoGenerateQA,
          questionCount: nextItem.questionCount,
          difficulty: nextItem.difficulty,
          title: nextItem.customTitle,
          category: nextItem.category,
        };

        if (nextItem.file) {
          uploadRes = await api.uploadMaterialFile(
            nextItem.courseId,
            nextItem.folderId,
            nextItem.file,
            uploadOptions
          );
        } else if (nextItem.textPayload) {
          uploadRes = await api.uploadMaterialText(
            nextItem.courseId,
            nextItem.folderId,
            nextItem.textPayload.filename,
            nextItem.textPayload.text,
            uploadOptions
          );
        } else {
          throw new Error('Missing file payload');
        }

        setUploadQueue((prev) =>
          prev.map((item) =>
            item.id === nextItem.id
              ? {
                  ...item,
                  status: 'ready',
                  statusMessage: `Vector Indexed (${uploadRes.material.chunkCount} chunks)`,
                  progressPercent: 100,
                  material: uploadRes.material,
                  generatedQuestions: uploadRes.questions,
                  completedAt: Date.now(),
                  file: undefined,
                }
              : item
          )
        );

        const userId = getActiveUserId();
        await offlineDb.saveMaterial(userId, uploadRes.material);
        await syncManager.refreshStats();
        loadFoldersForCourse(nextItem.courseId);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setUploadQueue((prev) =>
          prev.map((item) =>
            item.id === nextItem.id
              ? {
                  ...item,
                  status: 'error',
                  statusMessage: msg,
                  error: msg,
                  progressPercent: 100,
                  completedAt: Date.now(),
                }
              : item
          )
        );
      } finally {
        isProcessingQueueRef.current = false;
      }
    };

    processNextQueueItem();
  }, [uploadQueue]);

  const loadUserAndCourses = async () => {
    const userId = getActiveUserId();

    // Read cached courses from IndexedDB
    try {
      const cached = await offlineDb.getCourses(userId);
      if (cached && cached.length > 0) {
        setCourses(cached);
        setActiveCourse(cached[0]);
        const cachedFolders = await offlineDb.getFolders(cached[0].id);
        if (cachedFolders && cachedFolders.length > 0) {
          setFolders(cachedFolders);
        }
      }
    } catch (dbErr) {
      console.warn('[App] Error reading cached courses from IndexedDB:', dbErr);
    }

    // Server fetch
    if (navigator.onLine) {
      try {
        const authRes = await api.getMe();
        setCurrentUser(authRes.user);
        setAvailableUsers(authRes.availableUsers || []);

        const courseRes = await api.getCourses();
        const list = courseRes.courses || [];
        setCourses(list);
        await offlineDb.saveCourses(userId, list);

        if (list.length > 0) {
          const currentStillExists = activeCourse && list.find((c) => c.id === activeCourse.id);
          const courseToSet = currentStillExists || list[0];
          setActiveCourse(courseToSet);
          loadFoldersForCourse(courseToSet.id);
        } else {
          setActiveCourse(null);
          setFolders([]);
        }
        syncManager.refreshStats();
      } catch (err) {
        console.warn('Error loading state from server:', err);
      }
    }
  };

  const loadFoldersForCourse = async (courseId: string) => {
    try {
      const cachedFolders = await offlineDb.getFolders(courseId);
      if (cachedFolders && cachedFolders.length > 0) {
        setFolders(cachedFolders);
      }
    } catch {}

    if (navigator.onLine) {
      try {
        const res = await api.getFolders(courseId);
        const folderList = res.folders || [];
        setFolders(folderList);
        await offlineDb.saveFolders(courseId, folderList);
        syncManager.refreshStats();
      } catch (err) {
        console.warn('Error loading folders:', err);
      }
    }
  };

  const handleSwitchUser = (userId: string) => {
    setActiveUserId(userId);
    const targetUser = availableUsers.find((u) => u.id === userId);
    if (targetUser) setCurrentUser(targetUser);
    setActiveFolderId('all');

    offlineDb.getCourses(userId).then((cached) => {
      if (cached && cached.length > 0) {
        setCourses(cached);
        setActiveCourse(cached[0]);
        loadFoldersForCourse(cached[0].id);
      }
    });

    if (navigator.onLine) {
      api.getCourses().then(async (res) => {
        const list = res.courses || [];
        setCourses(list);
        await offlineDb.saveCourses(userId, list);
        if (list.length > 0) {
          setActiveCourse(list[0]);
          loadFoldersForCourse(list[0].id);
        } else {
          setActiveCourse(null);
          setFolders([]);
        }
        syncManager.refreshStats();
      });
    }
  };

  const handleSelectCourse = (course: Course) => {
    setActiveCourse(course);
    setActiveFolderId('all');
    loadFoldersForCourse(course.id);
  };

  const handleCreateCourse = async (data: {
    title: string;
    code: string;
    description: string;
    color: string;
  }): Promise<Course> => {
    const userId = getActiveUserId();
    let newCourse: Course;

    if (navigator.onLine) {
      try {
        const res = await api.createCourse(data);
        newCourse = res.course;
      } catch (err: unknown) {
        // If network error, gracefully fallback to local offline course
        const isNetworkErr =
          err instanceof TypeError ||
          (err instanceof Error && (err.message.includes('fetch') || err.message.includes('Network')));
        if (isNetworkErr) {
          newCourse = {
            id: `crs_offline_${Date.now()}`,
            ownerId: userId,
            title: data.title.trim(),
            code: data.code.trim().toUpperCase(),
            description: data.description ? data.description.trim() : '',
            color: data.color || '#4F46E5',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        } else {
          throw err;
        }
      }
    } else {
      newCourse = {
        id: `crs_offline_${Date.now()}`,
        ownerId: userId,
        title: data.title.trim(),
        code: data.code.trim().toUpperCase(),
        description: data.description ? data.description.trim() : '',
        color: data.color || '#4F46E5',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    const updatedList = [newCourse, ...courses.filter((c) => c.id !== newCourse.id)];
    setCourses(updatedList);
    setActiveCourse(newCourse);
    setActiveFolderId('all');
    setFolders([]);
    await offlineDb.saveCourses(userId, updatedList);
    syncManager.refreshStats();
    setShowCreateCourseModal(false);
    return newCourse;
  };

  const handleUpdateCourse = async (courseId: string, data: Partial<Course>) => {
    try {
      const res = await api.updateCourse(courseId, data);
      const updatedList = courses.map((c) => (c.id === courseId ? res.course : c));
      setCourses(updatedList);
      if (activeCourse?.id === courseId) {
        setActiveCourse(res.course);
      }
      const userId = getActiveUserId();
      await offlineDb.saveCourses(userId, updatedList);
      syncManager.refreshStats();
    } catch (err) {
      console.error('Update course failed:', err);
      throw err;
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    try {
      await api.deleteCourse(courseId);
      const updatedList = courses.filter((c) => c.id !== courseId);
      setCourses(updatedList);
      const userId = getActiveUserId();
      await offlineDb.saveCourses(userId, updatedList);
      
      if (activeCourse?.id === courseId) {
        const nextCourse = updatedList[0] || null;
        setActiveCourse(nextCourse);
        setActiveFolderId('all');
        if (nextCourse) {
          loadFoldersForCourse(nextCourse.id);
        } else {
          setFolders([]);
        }
      }
      syncManager.refreshStats();
    } catch (err) {
      console.error('Delete course failed:', err);
      throw err;
    }
  };

  const handleCreateFolder = async (name: string) => {
    if (!activeCourse) return;
    try {
      const res = await api.createFolder(activeCourse.id, { name });
      const updated = [...folders, res.folder];
      setFolders(updated);
      setActiveFolderId(res.folder.id);
      await offlineDb.saveFolders(activeCourse.id, updated);
      syncManager.refreshStats();
    } catch (err) {
      console.error('Create folder failed:', err);
    }
  };

  const handleLaunchExamWithPaper = (paperId: string) => {
    setInitialPastPaperForExam(paperId);
    setInitialDocumentForQuiz(null);
    setActiveTab('study');
  };

  const handleLaunchQuizWithDocument = (docId: string) => {
    setInitialDocumentForQuiz(docId);
    setInitialPastPaperForExam(null);
    setActiveTab('study');
  };

  const handleEnqueueUploads = (
    items: QueuedUploadItem[],
    navigateToTutor: boolean = true,
    targetFolderId?: string | null
  ) => {
    setUploadQueue((prev) => [...prev, ...items]);
    setIsQueueMinimized(false);

    if (navigateToTutor) {
      if (targetFolderId !== undefined && targetFolderId !== null) {
        setActiveFolderId(targetFolderId);
      }
      setActiveTab('tutor');
      const targetFolder = folders.find((f) => f.id === targetFolderId);
      const folderMsg = targetFolder ? ` into "${targetFolder.name}"` : '';
      const docTitles = items.slice(0, 2).map((i) => `"${i.customTitle || i.filename}"`).join(', ');
      const moreMsg = items.length > 2 ? ` and ${items.length - 2} more` : '';
      setTutorUploadNotice(
        `📥 Automatically saved ${items.length} document${items.length === 1 ? '' : 's'}${folderMsg} (${docTitles}${moreMsg}). Background vector indexing active — you can ask questions right now!`
      );
    }
  };

  const handleRemoveQueueItem = (id: string) => {
    setUploadQueue((prev) => prev.filter((i) => i.id !== id));
  };

  const handleClearCompletedQueue = () => {
    setUploadQueue((prev) => prev.filter((i) => i.status !== 'ready'));
  };

  const handleRetryQueueItem = (item: QueuedUploadItem) => {
    setUploadQueue((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? {
              ...i,
              status: 'queued',
              statusMessage: 'Retrying in queue…',
              progressPercent: 0,
              error: undefined,
            }
          : i
      )
    );
  };

  return (
    <div className="min-h-screen bg-[#F5F7FC] text-[#172033] flex font-sans antialiased">
      {/* 1. Left Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        courseCount={courses.length}
        docCount={folders.length}
        courses={courses}
        activeCourse={activeCourse}
        onSelectCourse={handleSelectCourse}
        onOpenCreateCourseModal={() => setShowCreateCourseModal(true)}
      />

      {/* 2. Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-[260px]'
        }`}
      >
        {/* Header */}
        <Header
          currentUser={currentUser}
          availableUsers={availableUsers}
          onSwitchUser={handleSwitchUser}
          courses={courses}
          activeCourse={activeCourse}
          onSelectCourse={handleSelectCourse}
          folders={folders}
          activeFolderId={activeFolderId}
          onSelectFolder={setActiveFolderId}
          onCreateCourse={handleCreateCourse}
          onOpenCreateCourseModal={() => setShowCreateCourseModal(true)}
          onUpdateCourse={handleUpdateCourse}
          onDeleteCourse={handleDeleteCourse}
          onCreateFolder={handleCreateFolder}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          isOnline={syncState.isOnline}
          onOpenSyncModal={() => setShowSyncModal(true)}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
          onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Global Offline / Sync Banner */}
        <OfflineBanner onOpenSyncModal={() => setShowSyncModal(true)} />

        {/* Storage & Sync Modal */}
        <OfflineSyncModal
          isOpen={showSyncModal}
          onClose={() => setShowSyncModal(false)}
          activeCourse={activeCourse}
          onTriggerRefresh={loadUserAndCourses}
        />

        {/* Global Create Course Modal */}
        <CreateCourseModal
          isOpen={showCreateCourseModal}
          onClose={() => setShowCreateCourseModal(false)}
          onCreateCourse={handleCreateCourse}
        />

        {/* Views Container */}
        <main className="flex-1 pb-20 lg:pb-8 sb-gradient-mesh min-h-[calc(100vh-64px)]">
          {/* Dashboard View */}
          {activeTab === 'dashboard' && (
            <DashboardView
              activeCourse={activeCourse}
              courses={courses}
              folders={folders}
              activeFolderId={activeFolderId}
              onSelectTab={setActiveTab}
              onSelectFolder={setActiveFolderId}
              onSelectCourse={handleSelectCourse}
              currentUser={currentUser}
              onOpenUploadModal={() => setActiveTab('materials')}
              onOpenCreateCourseModal={() => setShowCreateCourseModal(true)}
            />
          )}

          {/* AI Tutor View */}
          {activeTab === 'tutor' && (
            <TutorView
              activeCourse={activeCourse}
              activeFolderId={activeFolderId}
              folders={folders}
              onSelectFolder={setActiveFolderId}
              uploadNotice={tutorUploadNotice}
              onDismissUploadNotice={() => setTutorUploadNotice(null)}
              onOpenCreateCourseModal={() => setShowCreateCourseModal(true)}
            />
          )}

          {/* Materials & Notes View */}
          {activeTab === 'materials' && (
            <MaterialsView
              activeCourse={activeCourse}
              folders={folders}
              activeFolderId={activeFolderId}
              onSelectFolder={setActiveFolderId}
              onRefreshFolders={() => {
                if (activeCourse) loadFoldersForCourse(activeCourse.id);
              }}
              onCreateCourse={handleCreateCourse}
              onOpenCreateCourseModal={() => setShowCreateCourseModal(true)}
              onUpdateCourse={handleUpdateCourse}
              onDeleteCourse={handleDeleteCourse}
              onLaunchQuizWithDocument={handleLaunchQuizWithDocument}
              onNavigateToTutor={(targetFolderId, count) => {
                if (targetFolderId !== undefined && targetFolderId !== null) {
                  setActiveFolderId(targetFolderId);
                }
                setActiveTab('tutor');
                if (count && count > 0) {
                  setTutorUploadNotice(`📥 Saved ${count} document${count > 1 ? 's' : ''}. Background vector indexing active.`);
                }
              }}
              uploadQueue={uploadQueue}
              onEnqueueUploads={handleEnqueueUploads}
              onClearCompletedQueue={handleClearCompletedQueue}
              onRemoveQueueItem={handleRemoveQueueItem}
              onRetryQueueItem={handleRetryQueueItem}
              isQueueMinimized={isQueueMinimized}
              onToggleQueueMinimized={() => setIsQueueMinimized(!isQueueMinimized)}
            />
          )}

          {/* Past Papers View */}
          {activeTab === 'past_papers' && (
            <PastPapersView
              activeCourse={activeCourse}
              folders={folders}
              activeFolderId={activeFolderId}
              onSelectFolder={setActiveFolderId}
              onLaunchExamWithPaper={handleLaunchExamWithPaper}
              onOpenCreateCourseModal={() => setShowCreateCourseModal(true)}
            />
          )}

          {/* Study & Recall Quiz View */}
          {activeTab === 'study' && (
            <QuizView
              activeCourse={activeCourse}
              courses={courses}
              folders={folders}
              activeFolderId={activeFolderId}
              initialPastPaperId={initialPastPaperForExam}
              initialDocumentId={initialDocumentForQuiz}
              onOpenCreateCourseModal={() => setShowCreateCourseModal(true)}
              onNavigateToMaterials={() => setActiveTab('materials')}
              onNavigateToPastPapers={() => setActiveTab('past_papers')}
            />
          )}

          {/* Study Calendar & Focus Timer View */}
          {activeTab === 'calendar' && (
            <StudyPlannerView
              activeCourse={activeCourse}
              courses={courses}
              folders={folders}
            />
          )}

          {/* Vector RAG Explorer View */}
          {activeTab === 'rag' && (
            <RagExplorerView
              activeCourse={activeCourse}
              folders={folders}
              activeFolderId={activeFolderId}
              onSelectFolder={setActiveFolderId}
            />
          )}

          {/* Diagnostics View */}
          {activeTab === 'diagnostics' && <DiagnosticsView />}

          {/* PWA Installer View */}
          {activeTab === 'pwainstaller' && <PWAInstallerView />}
        </main>

        {/* Global Floating Background Vector Indexing Queue Manager */}
        <UploadQueueWidget
          uploadQueue={uploadQueue}
          isQueueMinimized={isQueueMinimized}
          onToggleMinimized={() => setIsQueueMinimized(!isQueueMinimized)}
          onClearCompleted={handleClearCompletedQueue}
          onRemoveItem={handleRemoveQueueItem}
          onRetryItem={handleRetryQueueItem}
          onNavigateToTutor={() => setActiveTab('tutor')}
        />

        {/* Mobile Touch-Friendly Bottom Navigation Bar */}
        <nav
          aria-label="Mobile Bottom Navigation"
          className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-1 py-1.5 flex items-center justify-around shadow-[0_-4px_20px_rgba(15,23,42,0.06)]"
        >
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition min-w-[50px] cursor-pointer ${
              activeTab === 'dashboard' ? 'text-indigo-600 font-bold bg-indigo-50/80 ring-1 ring-indigo-200' : 'text-slate-500'
            }`}
          >
            <Layers className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Home</span>
          </button>

          <button
            onClick={() => setActiveTab('tutor')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition min-w-[50px] cursor-pointer ${
              activeTab === 'tutor' ? 'text-indigo-600 font-bold bg-indigo-50/80 ring-1 ring-indigo-200' : 'text-slate-500'
            }`}
          >
            <Sparkles className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Tutor</span>
          </button>

          <button
            onClick={() => setActiveTab('materials')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition min-w-[50px] cursor-pointer ${
              activeTab === 'materials' ? 'text-amber-600 font-bold bg-amber-50/80 ring-1 ring-amber-200' : 'text-slate-500'
            }`}
          >
            <Folder className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Notes</span>
          </button>

          <button
            onClick={() => setActiveTab('past_papers')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition min-w-[50px] cursor-pointer ${
              activeTab === 'past_papers' ? 'text-blue-600 font-bold bg-blue-50/80 ring-1 ring-blue-200' : 'text-slate-500'
            }`}
          >
            <FileText className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Papers</span>
          </button>

          <button
            onClick={() => setActiveTab('study')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition min-w-[50px] cursor-pointer ${
              activeTab === 'study' ? 'text-rose-600 font-bold bg-rose-50/80 ring-1 ring-rose-200' : 'text-slate-500'
            }`}
          >
            <Cpu className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Mock</span>
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition min-w-[50px] cursor-pointer ${
              activeTab === 'calendar' ? 'text-emerald-600 font-bold bg-emerald-50/80 ring-1 ring-emerald-200' : 'text-slate-500'
            }`}
          >
            <Calendar className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Timer</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
