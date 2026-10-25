import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Bot,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Database,
  ExternalLink,
  FileText,
  Filter,
  Layers,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { api, getActiveUserId } from '../lib/api';
import { offlineDb } from '../lib/offlineDb';
import { syncManager } from '../lib/syncManager';
import { Citation, Course, Folder, TutorMessage } from '../types';
import { VectorSyncIndicator } from './VectorSyncIndicator';

interface TutorViewProps {
  activeCourse: Course | null;
  activeFolderId: string | null | 'all';
  folders: Folder[];
  onSelectFolder: (folderId: string | null | 'all') => void;
  uploadNotice?: string | null;
  onDismissUploadNotice?: () => void;
  onOpenCreateCourseModal?: () => void;
}

export const TutorView: React.FC<TutorViewProps> = ({
  activeCourse,
  activeFolderId,
  folders,
  onSelectFolder,
  uploadNotice,
  onDismissUploadNotice,
  onOpenCreateCourseModal,
}) => {
  const syncState = useSyncStatus();
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tutorStyle, setTutorStyle] = useState<'direct' | 'socratic' | 'summary' | 'exam_prep'>('direct');
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeCourse) return;
    loadChatHistory();
  }, [activeCourse?.id, activeFolderId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const loadChatHistory = async () => {
    if (!activeCourse) return;
    const userId = getActiveUserId();

    // Read cached messages from IndexedDB
    try {
      const cached = await offlineDb.getChatMessages(userId, activeCourse.id, activeFolderId);
      if (cached && cached.length > 0) {
        setMessages(cached);
      }
    } catch (err) {
      console.warn('[TutorView] Error reading chat from IndexedDB:', err);
    }

    // Fresh fetch from server if online
    if (navigator.onLine) {
      try {
        const res = await api.getTutorMessages(activeCourse.id, activeFolderId);
        const serverMessages = res.messages || [];
        setMessages(serverMessages);
        await offlineDb.saveChatMessages(userId, activeCourse.id, activeFolderId, serverMessages);
        syncManager.refreshStats();
      } catch (err) {
        console.warn('[TutorView] Server fetch failed, keeping IndexedDB chat:', err);
      }
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, queryOverride?: string) => {
    if (e) e.preventDefault();
    const query = (queryOverride || inputQuery).trim();
    if (!query || !activeCourse || isLoading) return;

    if (!queryOverride) {
      setInputQuery('');
    }
    const userId = getActiveUserId();

    const tempUserMsg: TutorMessage = {
      id: `user_msg_${Date.now()}`,
      courseId: activeCourse.id,
      folderId: activeFolderId === 'all' ? null : activeFolderId,
      ownerId: userId,
      role: 'user',
      content: query,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    // If offline, save locally to IndexedDB and queue sync action
    if (!navigator.onLine) {
      const offlineNoticeMsg: TutorMessage = {
        id: `offline_ai_${Date.now()}`,
        courseId: activeCourse.id,
        folderId: activeFolderId === 'all' ? null : activeFolderId,
        ownerId: userId,
        role: 'assistant',
        content: `📡 [Offline Mode]: Your question has been stored in IndexedDB. Once reconnected, your AI Tutor will generate a grounded answer.`,
        timestamp: new Date().toISOString(),
      };

      await offlineDb.appendChatMessage(userId, activeCourse.id, activeFolderId, tempUserMsg, true, 'pending');
      await offlineDb.appendChatMessage(userId, activeCourse.id, activeFolderId, offlineNoticeMsg, true, 'synced');
      await offlineDb.enqueueSyncAction({
        userId,
        type: 'chat_message',
        payload: {
          courseId: activeCourse.id,
          folderId: activeFolderId,
          query,
          tutorStyle,
        },
      });

      setMessages((prev) => [...prev, offlineNoticeMsg]);
      syncManager.refreshStats();
      return;
    }

    setIsLoading(true);
    await offlineDb.appendChatMessage(userId, activeCourse.id, activeFolderId, tempUserMsg, false, 'synced');

    try {
      const res = await api.sendTutorChat({
        courseId: activeCourse.id,
        folderId: activeFolderId,
        message: query,
        tutorStyle,
      });

      setMessages((prev) => [...prev.filter((m) => m.id !== tempUserMsg.id), tempUserMsg, res.message]);
      await offlineDb.appendChatMessage(userId, activeCourse.id, activeFolderId, res.message, false, 'synced');
      syncManager.refreshStats();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const errorMsg: TutorMessage = {
        id: `err_${Date.now()}`,
        courseId: activeCourse.id,
        folderId: activeFolderId === 'all' ? null : activeFolderId,
        ownerId: userId,
        role: 'assistant',
        content: `Notice from AI Tutor: ${msg}. Please verify your course materials are indexed in this folder.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = async () => {
    if (!activeCourse) return;
    const userId = getActiveUserId();
    try {
      await offlineDb.clearChatOffline(userId, activeCourse.id, activeFolderId);
      if (navigator.onLine) {
        await api.clearTutorChat(activeCourse.id, activeFolderId);
      }
      setMessages([]);
      syncManager.refreshStats();
    } catch (err) {
      console.error('Failed to clear chat:', err);
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const activeFolderName =
    activeFolderId === 'all'
      ? 'All Course Folders'
      : activeFolderId === null
      ? 'Root (Unassigned)'
      : folders.find((f) => f.id === activeFolderId)?.name || 'Selected Folder';

  const starterPrompts = [
    'Explain the fundamental concept from our latest uploaded document.',
    'What are the key mathematical formulas or rules defined here?',
    'Summarize the core takeaways in 3 bullet points.',
    'Test my understanding with a challenging conceptual question.',
  ];

  if (!activeCourse) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center animate-in fade-in">
        <div className="sb-card p-10 space-y-4 border-indigo-100 shadow-sm">
          <BookOpen className="w-12 h-12 text-indigo-400 mx-auto mb-2" />
          <h3 className="text-xl font-bold text-slate-800">Select or Create a Course to Begin Tutoring</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            Grounded AI tutoring requires an active course to pull semantic passages and verify citations.
          </p>
          {onOpenCreateCourseModal && (
            <div className="pt-2">
              <button
                onClick={onOpenCreateCourseModal}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow transition inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Course</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col h-[calc(100vh-140px)]">
      {/* Upload & Automatic Save Notification Banner */}
      {uploadNotice && (
        <div className="bg-gradient-to-r from-indigo-50 via-teal-50 to-indigo-50 border border-indigo-200 p-3.5 rounded-2xl mb-3 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="font-bold text-slate-800">{uploadNotice}</span>
            </div>
            {onDismissUploadNotice && (
              <button
                onClick={onDismissUploadNotice}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition cursor-pointer"
                title="Dismiss notice"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-indigo-100 text-[11px]">
            <span className="text-slate-400 font-semibold uppercase text-[10px]">Quick Ask:</span>
            <button
              type="button"
              onClick={() => handleSendMessage(undefined, 'Please provide a comprehensive summary of my newly uploaded study notes, highlighting key principles.')}
              className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 font-semibold rounded-lg border border-indigo-200 shadow-2xs transition cursor-pointer"
            >
              💡 Summarize Notes
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage(undefined, 'Generate 3 realistic exam practice questions based on this document, with explanations.')}
              className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 font-semibold rounded-lg border border-indigo-200 shadow-2xs transition cursor-pointer"
            >
              📝 Practice Quiz
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage(undefined, 'Extract the key formulas, definitions, and exam terminology from this document.')}
              className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 font-semibold rounded-lg border border-indigo-200 shadow-2xs transition cursor-pointer"
            >
              🔍 Key Formulas
            </button>
          </div>
        </div>
      )}

      {/* Control bar: Folder isolation pill, Tutor style selector, Clear chat */}
      <div className="sb-card p-3 mb-4 flex flex-wrap items-center justify-between gap-3 border-t-4 border-t-indigo-600">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 shrink-0">
            <Filter className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-slate-800">Grounded Scope:</span>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 font-bold text-indigo-700 border border-indigo-200 truncate">
                {activeFolderName}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate mt-0.5">
              {activeFolderId === 'all'
                ? 'Retrieval active across all folders in this course'
                : 'Strict vector isolation enabled: only chunks in this folder are retrieved'}
            </p>
          </div>
        </div>

        {/* Style selector + Clear */}
        <div className="flex items-center gap-2 shrink-0">
          <VectorSyncIndicator
            activeCourse={activeCourse}
            activeFolderId={activeFolderId}
            folders={folders}
          />

          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1 text-xs">
            <span className="px-2 font-medium text-slate-500">Style:</span>
            <select
              value={tutorStyle}
              onChange={(e: any) => setTutorStyle(e.target.value)}
              className="bg-white border-0 font-bold text-slate-800 rounded-lg px-2.5 py-1 shadow-2xs cursor-pointer focus:ring-1 focus:ring-indigo-500"
            >
              <option value="direct">Direct Tutor</option>
              <option value="socratic">Socratic Coach</option>
              <option value="summary">Summary Notes</option>
              <option value="exam_prep">Exam Prep</option>
            </select>
          </div>

          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition text-xs flex items-center gap-1 cursor-pointer"
              title="Clear Conversation"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto bg-white/70 rounded-2xl border border-slate-200/90 p-4 sm:p-5 space-y-4 shadow-inner">
        {messages.length === 0 && (
          <div className="text-center py-10 max-w-lg mx-auto space-y-4">
            <div className="w-14 h-14 rounded-2xl sb-gradient-primary text-white flex items-center justify-center mx-auto shadow-md">
              <Sparkles className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                AI Study Tutor for {activeCourse.code}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                Answers are grounded strictly in verified chunks from <strong>{activeFolderName}</strong>. Every response includes page and slide provenance.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left pt-2">
              {starterPrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => setInputQuery(p)}
                  className="p-3 bg-slate-50 hover:bg-indigo-50/60 rounded-xl border border-slate-200 hover:border-indigo-200 text-xs text-slate-800 font-medium transition flex items-center justify-between group shadow-2xs cursor-pointer"
                >
                  <span className="line-clamp-2">{p}</span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition shrink-0 ml-1.5" />
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-xl sb-gradient-primary text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-2xl p-4 shadow-2xs ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-tr-none'
                  : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-2 mb-1.5 text-[11px] opacity-80">
                <span className="font-bold">
                  {msg.role === 'user' ? 'You' : 'Study Buddy AI'}
                </span>
                <div className="flex items-center gap-2">
                  <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => handleCopyText(msg.id, msg.content)}
                      className="hover:opacity-100 transition p-0.5 rounded cursor-pointer"
                      title="Copy Answer"
                    >
                      {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                {msg.content}
              </div>

              {/* Citations & Source Provenance */}
              {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                      <Layers className="w-3 h-3 text-indigo-600" />
                      Verified Source Chunks ({msg.citations.length})
                    </span>
                    {msg.retrievalMetadata && (
                      <span className="text-[10px] text-slate-400 capitalize">
                        {msg.retrievalMetadata.matchType} Match
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {msg.citations.map((cite, i) => (
                      <button
                        key={cite.chunkId || i}
                        onClick={() => setSelectedCitation(cite)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50/70 hover:bg-indigo-100/80 border border-indigo-200 text-[11px] text-indigo-950 font-medium transition cursor-pointer shadow-2xs"
                      >
                        <FileText className="w-3 h-3 text-indigo-600" />
                        <span className="max-w-[120px] truncate font-semibold">{cite.filename}</span>
                        <span className="text-indigo-500 font-mono">p.{cite.pageOrSlide}</span>
                        <span className="text-indigo-700 font-bold text-[10px] bg-white px-1 py-0.2 rounded border border-indigo-100">
                          {Math.round(cite.relevanceScore * 100)}%
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                <UserIcon className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <Bot className="w-4 h-4 animate-pulse" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-4 max-w-[85%] shadow-2xs">
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <RefreshCw className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                <span>Searching vector embeddings in {activeFolderName} & synthesizing grounded answer…</span>
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input Form Bar */}
      <form onSubmit={handleSendMessage} className="mt-3 flex gap-2">
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder={`Ask about ${activeCourse.code} (${activeFolderName})…`}
          className="flex-1 text-xs sm:text-sm px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none shadow-2xs font-medium text-slate-800"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={!inputQuery.trim() || isLoading}
          className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl transition shadow flex items-center gap-2 cursor-pointer text-xs sm:text-sm shrink-0"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Ask AI</span>
        </button>
      </form>

      {/* Citation Inspector Modal */}
      {selectedCitation && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative animate-in fade-in">
            <button
              onClick={() => setSelectedCitation(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">{selectedCitation.filename}</h4>
                <p className="text-xs text-slate-500">
                  Page/Slide {selectedCitation.pageOrSlide} • Chunk: {selectedCitation.chunkId}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 mb-4 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Retrieval Confidence:</span>
                <span className="font-bold text-emerald-700">{Math.round(selectedCitation.relevanceScore * 100)}% Match</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Scope Isolation:</span>
                <span className="font-semibold text-slate-700">
                  {selectedCitation.folderId ? `Folder: ${selectedCitation.folderId}` : 'Root Document'}
                </span>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Exact Verified Source Chunk Excerpt
              </label>
              <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-800 font-mono leading-relaxed max-h-52 overflow-y-auto">
                "{selectedCitation.sourceExcerpt}"
              </div>
            </div>

            <p className="text-[11px] text-slate-400 italic">
              Grounding guarantee: The AI tutor is strictly constrained to this excerpt and other verified chunks for its answers.
            </p>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setSelectedCitation(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
