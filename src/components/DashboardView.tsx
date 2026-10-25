import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  FileText,
  FileUp,
  Folder,
  Layers,
  Play,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Timer,
  TrendingUp,
  UploadCloud,
  ChevronRight,
} from 'lucide-react';
import { api, getActiveUserId } from '../lib/api';
import { offlineDb } from '../lib/offlineDb';
import { Course, Folder as FolderType, Material, User, UserProgress } from '../types';
import { NavigationTab } from './Header';
import { VectorSyncIndicator } from './VectorSyncIndicator';

interface DashboardViewProps {
  activeCourse: Course | null;
  courses: Course[];
  folders: FolderType[];
  activeFolderId: string | null | 'all';
  onSelectTab: (tab: NavigationTab) => void;
  onSelectFolder: (f: string | null | 'all') => void;
  onSelectCourse?: (course: Course) => void;
  currentUser: User | null;
  onOpenUploadModal: () => void;
  onOpenCreateCourseModal?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  activeCourse,
  courses,
  folders,
  activeFolderId,
  onSelectTab,
  onSelectFolder,
  onSelectCourse,
  currentUser,
  onOpenUploadModal,
  onOpenCreateCourseModal,
}) => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const activeFolderName =
    activeFolderId === 'all'
      ? 'All Folders'
      : activeFolderId === null
      ? 'Root (Unassigned)'
      : folders.find((f) => f.id === activeFolderId)?.name || 'Selected Folder';

  useEffect(() => {
    if (!activeCourse) return;
    const userId = getActiveUserId();

    // 1. Read cached from IndexedDB
    offlineDb.getMaterials(userId, activeCourse.id, activeFolderId).then((cached) => {
      if (cached && cached.length > 0) setMaterials(cached);
    });

    // 2. Fresh fetch
    setIsLoading(true);
    Promise.all([
      api.getMaterials(activeCourse.id, activeFolderId).then((r) => setMaterials(r.materials || [])).catch(() => {}),
      api.getProgress(activeCourse.id).then((r) => setProgress(r.progress)).catch(() => {}),
    ]).finally(() => setIsLoading(false));
  }, [activeCourse?.id, activeFolderId]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const readyCount = materials.filter((m) => m.hasEmbeddings).length;
  const indexingCount = materials.filter((m) => m.status === 'processing' || m.status === 'indexing_vectors').length;
  const favoriteCount = materials.filter((m) => m.isFavorite).length;

  const recentMaterials = [...materials]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  const accuracy =
    progress && progress.totalQuestionsAnswered > 0
      ? Math.round((progress.correctAnswers / progress.totalQuestionsAnswered) * 100)
      : 0;

  if (!activeCourse) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="sb-card p-8 sm:p-12 text-center space-y-6 border-indigo-100/90 shadow-md">
          <div className="w-16 h-16 rounded-2xl sb-gradient-primary text-white flex items-center justify-center mx-auto shadow-md">
            <BookOpen className="w-8 h-8" />
          </div>
          <div className="space-y-2 max-w-lg mx-auto">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Welcome to Study Buddy AI
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Create a course to organize lecture slides, textbook notes, and past examination papers with isolated vector-grounded tutoring and active recall practice.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            {onOpenCreateCourseModal && (
              <button
                onClick={onOpenCreateCourseModal}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-md transition flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Your First Course</span>
              </button>
            )}

            {courses.length > 0 && onSelectCourse && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">or</span>
                <select
                  aria-label="Select Existing Course"
                  onChange={(e) => {
                    const c = courses.find((x) => x.id === e.target.value);
                    if (c) onSelectCourse(c);
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs border border-slate-200 cursor-pointer focus:outline-none"
                >
                  <option value="">Select Existing Course…</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} • {c.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-in fade-in duration-150">
      {/* 1. Welcoming Hero Banner */}
      <div className="sb-card overflow-hidden border-indigo-100/80 shadow-md">
        <div className="bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-600 p-6 sm:p-8 text-white relative">
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-xs font-semibold backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{activeCourse.code} • {activeFolderName}</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {greeting}, {currentUser?.name?.split(' ')[0] || 'Scholar'} 👋
              </h1>

              <p className="text-sm text-indigo-100 max-w-xl leading-relaxed">
                Welcome to your AI study workspace. Your vector index for{' '}
                <strong className="text-white font-bold">{activeFolderName}</strong> is active with strict scope isolation.
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-white/20 font-semibold">{courses.length} Courses</span>
                <span className="px-2.5 py-1 rounded-lg bg-white/10 font-medium">{folders.length} Folders</span>
                <span className="px-2.5 py-1 rounded-lg bg-white/10 font-medium">{materials.length} Documents</span>
              </div>
            </div>

            {/* Action CTA buttons */}
            <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0">
              <button
                onClick={() => onSelectTab('tutor')}
                className="px-6 py-3 bg-white text-indigo-700 hover:bg-indigo-50 font-bold rounded-xl text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-indigo-700" />
                <span>Continue Studying</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>

              <button
                onClick={onOpenUploadModal}
                className="px-6 py-2.5 bg-indigo-500/30 hover:bg-indigo-500/50 border border-white/20 text-white font-semibold rounded-xl text-xs backdrop-blur transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Upload Notes & Slides</span>
              </button>

              {onOpenCreateCourseModal && (
                <button
                  onClick={onOpenCreateCourseModal}
                  className="px-6 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold rounded-xl text-xs backdrop-blur transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Another Course</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 2. Genuine Application Data Summary Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 bg-white">
          {/* Card 1: Study Progress */}
          <div className="p-4 sm:p-5 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Study Progress</span>
              <span className="text-lg font-black text-slate-900 block mt-0.5">{accuracy}% Accuracy</span>
              <span className="text-xs text-slate-500 truncate block">{progress?.totalQuestionsAnswered || 0} questions solved</span>
            </div>
          </div>

          {/* Card 2: Vector RAG Ready */}
          <div className="p-4 sm:p-5 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Vector RAG</span>
              <span className="text-lg font-black text-slate-900 block mt-0.5">{readyCount}/{materials.length} Ready</span>
              <span className="text-xs text-slate-500 truncate block">
                {indexingCount > 0 ? `${indexingCount} embedding…` : '768-dim space verified'}
              </span>
            </div>
          </div>

          {/* Card 3: Pending Revision */}
          <div className="p-4 sm:p-5 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Active Streak</span>
              <span className="text-lg font-black text-amber-900 block mt-0.5">{progress?.streakDays || 1} Day(s)</span>
              <span className="text-xs text-slate-500 truncate block">Keep revision habits active</span>
            </div>
          </div>

          {/* Card 4: Recent Activity */}
          <div className="p-4 sm:p-5 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 border border-violet-100 flex items-center justify-center shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Core Materials</span>
              <span className="text-lg font-black text-slate-900 block mt-0.5">{favoriteCount} Starred</span>
              <span className="text-xs text-slate-500 truncate block">High-yield study items</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left 2 columns (AI Tutor & Recent Materials), Right 1 column (Quick Actions & Scope) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols */}
        <div className="lg:col-span-2 space-y-6">
          {/* 3. Prominent AI Tutor Card */}
          <div className="sb-card p-6 border-t-4 border-t-indigo-600 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl sb-gradient-primary text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">Grounded AI Tutor</h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Gemini 3.8 Flash
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                    Ask any question grounded strictly in <strong className="text-slate-900">{activeFolderName}</strong>. Every response includes verified source citations with exact page numbers and relevance scores.
                  </p>
                </div>
              </div>
            </div>

            {/* Scope Status Bar */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-slate-500">Active Scope:</span>
                <span className="font-bold text-slate-800">{activeCourse.code} • {activeFolderName}</span>
              </div>

              <VectorSyncIndicator
                activeCourse={activeCourse}
                activeFolderId={activeFolderId}
                folders={folders}
                onNavigateToTab={(tab) => onSelectTab(tab)}
              />
            </div>

            {/* Quick Prompt Starters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
              <button
                onClick={() => onSelectTab('tutor')}
                className="p-3 rounded-xl border border-slate-200 bg-white hover:bg-indigo-50/50 hover:border-indigo-200 text-left font-semibold text-slate-800 transition flex items-center justify-between group cursor-pointer"
              >
                <span>💡 Summarize Key Concepts</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition" />
              </button>
              <button
                onClick={() => onSelectTab('tutor')}
                className="p-3 rounded-xl border border-slate-200 bg-white hover:bg-indigo-50/50 hover:border-indigo-200 text-left font-semibold text-slate-800 transition flex items-center justify-between group cursor-pointer"
              >
                <span>🔍 Key Exam Formulas</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition" />
              </button>
              <button
                onClick={() => onSelectTab('tutor')}
                className="p-3 rounded-xl border border-slate-200 bg-white hover:bg-indigo-50/50 hover:border-indigo-200 text-left font-semibold text-slate-800 transition flex items-center justify-between group cursor-pointer"
              >
                <span>📝 Test My Knowledge</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition" />
              </button>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                onClick={() => onSelectTab('tutor')}
                className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Open AI Tutor Workspace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 4. Recent Materials Section */}
          <div className="sb-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">Course Materials & Notes</h3>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
                  {materials.length}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={onOpenUploadModal}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Upload
                </button>
                <span className="text-slate-300">•</span>
                <button
                  onClick={() => onSelectTab('materials')}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  View All ({materials.length})
                </button>
              </div>
            </div>

            {/* Document list or clean empty state */}
            {isLoading ? (
              <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
                <span>Loading course documents and embeddings…</span>
              </div>
            ) : recentMaterials.length === 0 ? (
              /* Clean empty state with instructions and actions */
              <div className="text-center py-10 px-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center mx-auto shadow-2xs">
                  <FileUp className="w-6 h-6 text-indigo-500" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">No Documents in this Scope Yet</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                    Upload your lecture slides, PDF textbook chapters, or paste class notes. Study Buddy AI will automatically extract text, generate vector embeddings, and enable grounded Q&A.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-w-md mx-auto text-left text-xs">
                  <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
                    <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center text-[10px]">1</span>
                    <span className="font-bold text-slate-800 block">Upload Notes</span>
                    <span className="text-slate-400 text-[11px] block">PDF, Word, or plain text</span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
                    <span className="w-5 h-5 rounded-full bg-teal-50 text-teal-700 font-bold flex items-center justify-center text-[10px]">2</span>
                    <span className="font-bold text-slate-800 block">Vector Index</span>
                    <span className="text-slate-400 text-[11px] block">Automatic chunking & RAG</span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
                    <span className="w-5 h-5 rounded-full bg-violet-50 text-violet-700 font-bold flex items-center justify-center text-[10px]">3</span>
                    <span className="font-bold text-slate-800 block">Ask & Recall</span>
                    <span className="text-slate-400 text-[11px] block">Strict citations provided</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={onOpenUploadModal}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow transition inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>Upload First Document</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentMaterials.map((mat) => {
                  const folderObj = folders.find((f) => f.id === mat.folderId);
                  const isPdf = /\.pdf$/i.test(mat.filename);
                  const isDoc = /\.(docx?|docm)$/i.test(mat.filename);
                  const isPpt = /\.(pptx?|ppsx?)$/i.test(mat.filename);

                  return (
                    <div
                      key={mat.id}
                      className="p-3.5 bg-white border border-slate-200 rounded-xl hover:border-indigo-200 transition flex items-center justify-between gap-3 sb-card-hover"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                          {isPdf ? (
                            <span className="text-[10px] font-bold text-rose-600">PDF</span>
                          ) : isDoc ? (
                            <span className="text-[10px] font-bold text-blue-600">DOC</span>
                          ) : isPpt ? (
                            <span className="text-[10px] font-bold text-orange-600">PPT</span>
                          ) : (
                            <FileText className="w-4 h-4 text-indigo-600" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 text-xs sm:text-sm truncate block" title={mat.title}>
                            {mat.title}
                          </span>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            <span className="font-mono truncate">{mat.filename}</span>
                            <span>•</span>
                            <span>{mat.chunkCount} chunks</span>
                            <span>•</span>
                            <span className="text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                              📁 {folderObj ? folderObj.name : 'Root'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            mat.hasEmbeddings
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : mat.status === 'processing'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {mat.hasEmbeddings ? 'Vector Indexed' : mat.status}
                        </span>

                        <button
                          onClick={() => onSelectTab('tutor')}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition cursor-pointer"
                          title="Ask questions about this document"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Rail Column */}
        <div className="space-y-6">
          {/* Quick Actions Card */}
          <div className="sb-card p-5 space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">Quick Study Actions</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => onSelectTab('tutor')}
                className="p-3 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white font-bold text-left shadow transition hover:opacity-95 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 mb-2 text-indigo-200" />
                <span>Ask AI Tutor</span>
              </button>

              <button
                onClick={() => onSelectTab('study')}
                className="p-3 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white font-bold text-left shadow transition hover:opacity-95 cursor-pointer"
              >
                <Cpu className="w-4 h-4 mb-2 text-rose-200" />
                <span>Mock Exam</span>
              </button>

              <button
                onClick={() => onSelectTab('past_papers')}
                className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-sky-600 text-white font-bold text-left shadow transition hover:opacity-95 cursor-pointer"
              >
                <FileText className="w-4 h-4 mb-2 text-blue-200" />
                <span>Past Papers</span>
              </button>

              <button
                onClick={() => onSelectTab('calendar')}
                className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-bold text-left shadow transition hover:opacity-95 cursor-pointer"
              >
                <Timer className="w-4 h-4 mb-2 text-emerald-200" />
                <span>Focus Timer</span>
              </button>
            </div>
          </div>

          {/* Active Recall Topic Mastery */}
          <div className="sb-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Topic Mastery</h3>
              <span className="text-xs font-bold text-indigo-600">{accuracy}%</span>
            </div>

            <div className="space-y-2 text-xs">
              {progress?.topicMastery && Object.keys(progress.topicMastery).length > 0 ? (
                Object.entries(progress.topicMastery).map(([topic, pct]) => (
                  <div key={topic} className="space-y-1">
                    <div className="flex justify-between text-[11px] font-medium text-slate-600">
                      <span className="truncate max-w-[170px]">{topic}</span>
                      <span className="font-bold">{pct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-teal-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-4 text-center text-slate-400 text-xs">
                  Complete recall quizzes to build topic mastery analytics.
                </div>
              )}
            </div>

            <button
              onClick={() => onSelectTab('study')}
              className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition cursor-pointer mt-2"
            >
              Start Recall Assessment
            </button>
          </div>

          {/* Folder Scope Switcher Quick Card */}
          <div className="sb-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Folder className="w-4 h-4 text-amber-500" />
                <span>Isolated Folders</span>
              </h3>
              <span className="text-xs text-slate-400">{folders.length} available</span>
            </div>

            <div className="space-y-1 text-xs">
              <button
                onClick={() => onSelectFolder('all')}
                className={`w-full text-left px-3 py-2 rounded-xl transition cursor-pointer font-medium truncate ${
                  activeFolderId === 'all'
                    ? 'bg-amber-500 text-white font-bold shadow'
                    : 'bg-slate-50 hover:bg-amber-50 text-slate-700 border border-slate-200'
                }`}
              >
                📂 All Folders (Course Wide)
              </button>

              <button
                onClick={() => onSelectFolder(null)}
                className={`w-full text-left px-3 py-2 rounded-xl transition cursor-pointer font-medium truncate ${
                  activeFolderId === null
                    ? 'bg-amber-500 text-white font-bold shadow'
                    : 'bg-slate-50 hover:bg-amber-50 text-slate-700 border border-slate-200'
                }`}
              >
                📄 Root (Unassigned)
              </button>

              {folders.slice(0, 4).map((f) => (
                <button
                  key={f.id}
                  onClick={() => onSelectFolder(f.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl transition cursor-pointer font-medium truncate ${
                    activeFolderId === f.id
                      ? 'bg-amber-500 text-white font-bold shadow'
                      : 'bg-slate-50 hover:bg-amber-50 text-slate-700 border border-slate-200'
                  }`}
                >
                  📁 {f.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
