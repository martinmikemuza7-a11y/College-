import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileText,
  Folder,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { Course, Folder as FolderType, VectorSyncStatus } from '../types';

interface VectorSyncIndicatorProps {
  activeCourse: Course | null;
  activeFolderId: string | null | 'all';
  folders: FolderType[];
  onNavigateToTab?: (tab: 'materials' | 'rag') => void;
  className?: string;
}

export const VectorSyncIndicator: React.FC<VectorSyncIndicatorProps> = ({
  activeCourse,
  activeFolderId,
  folders,
  onNavigateToTab,
  className = '',
}) => {
  const [status, setStatus] = useState<VectorSyncStatus | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isResyncing, setIsResyncing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [animatedProgress, setAnimatedProgress] = useState(100);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const activeFolderName =
    activeFolderId === 'all'
      ? 'All Folders (Course Wide)'
      : activeFolderId === null
      ? 'Root (Unassigned)'
      : folders.find((f) => f.id === activeFolderId)?.name || 'Selected Folder';

  useEffect(() => {
    if (!activeCourse) {
      setStatus(null);
      return;
    }

    setIsScanning(true);
    setAnimatedProgress(15);

    const timer = setTimeout(() => {
      setAnimatedProgress(65);
    }, 150);

    fetchSyncStatus(true).finally(() => {
      clearTimeout(timer);
      setTimeout(() => {
        setIsScanning(false);
      }, 300);
    });

    return () => {
      clearTimeout(timer);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [activeCourse?.id, activeFolderId]);

  const fetchSyncStatus = async (initial = false) => {
    if (!activeCourse) return;
    try {
      const res = await api.getVectorSyncStatus(activeCourse.id, activeFolderId);
      setStatus(res);
      setAnimatedProgress(res.syncPercentage);

      if (res.syncState === 'indexing') {
        if (!pollTimerRef.current) {
          pollTimerRef.current = setInterval(() => {
            fetchSyncStatus(false);
          }, 2000);
        }
      } else {
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      }
    } catch (err) {
      console.warn('Failed to fetch vector sync status:', err);
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }
  };

  const handleManualResync = async () => {
    if (!activeCourse || isResyncing) return;
    setIsResyncing(true);
    setAnimatedProgress(25);

    try {
      await api.triggerVectorResync(activeCourse.id, activeFolderId);
      setAnimatedProgress(85);
      await fetchSyncStatus(false);
    } catch (err) {
      console.error('Resync failed:', err);
    } finally {
      setTimeout(() => {
        setIsResyncing(false);
      }, 350);
    }
  };

  if (!activeCourse) return null;

  const totalChunks = status?.totalChunks ?? 0;
  const embeddedChunks = status?.embeddedChunks ?? 0;
  const totalDocs = status?.totalDocuments ?? 0;
  const isReady = status?.syncState === 'synced';
  const isEmpty = status?.syncState === 'empty' || totalDocs === 0;
  const isIndexing = isScanning || isResyncing || status?.syncState === 'indexing';

  return (
    <>
      <div className={`relative inline-flex items-center ${className}`}>
        <button
          onClick={() => setShowModal(true)}
          type="button"
          title={`Vector Index Status for ${activeFolderName}: Click for details`}
          className={`group flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition cursor-pointer select-none ${
            isIndexing
              ? 'bg-indigo-50/90 text-indigo-900 border-indigo-200 hover:bg-indigo-100'
              : isReady
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100/90'
              : isEmpty
              ? 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
          }`}
        >
          {/* Status Icon */}
          <div className="relative flex items-center justify-center">
            {isIndexing ? (
              <RefreshCw className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
            ) : isReady ? (
              <div className="relative flex items-center justify-center">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping absolute opacity-75" />
                <span className="w-2 h-2 rounded-full bg-emerald-600 relative" />
              </div>
            ) : isEmpty ? (
              <Database className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            )}
          </div>

          <div className="flex items-center gap-1.5 font-semibold text-xs leading-none">
            <span>
              {isIndexing
                ? 'Syncing Vectors…'
                : isReady
                ? 'Vector Ready'
                : isEmpty
                ? 'Vector Idle'
                : 'Attention Needed'}
            </span>
            {isReady && (
              <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100/90 text-emerald-800 rounded font-bold">
                {embeddedChunks} chunks
              </span>
            )}
          </div>
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div
            className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden shadow-2xl border border-slate-200 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                    Vector RAG Status & Scope
                  </h3>
                  <p className="text-xs text-slate-500">
                    Course: <strong className="text-slate-700 font-semibold">{activeCourse.code}</strong> • Scope: <strong className="text-indigo-600 font-semibold">{activeFolderName}</strong>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/50 transition cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs sm:text-sm">
              <div
                className={`p-4 rounded-xl border flex flex-col gap-3 ${
                  isReady
                    ? 'bg-emerald-50/70 border-emerald-200'
                    : isIndexing
                    ? 'bg-indigo-50/70 border-indigo-200'
                    : isEmpty
                    ? 'bg-slate-50 border-slate-200'
                    : 'bg-amber-50 border-amber-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isReady ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : isIndexing ? (
                      <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
                    ) : isEmpty ? (
                      <Folder className="w-5 h-5 text-slate-400" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                    )}

                    <div>
                      <span className="font-bold text-slate-900 block text-sm">
                        {isReady
                          ? 'Vector Embeddings Synchronized'
                          : isIndexing
                          ? 'Generating Embeddings…'
                          : isEmpty
                          ? 'No Documents in this Scope'
                          : 'Index Attention Needed'}
                      </span>
                      <span className="text-xs text-slate-600">
                        {isReady
                          ? 'All chunks embedded in 768-dim vector space for high-precision grounding.'
                          : isIndexing
                          ? 'Extracting text and generating dense vector embeddings for this folder.'
                          : isEmpty
                          ? 'Upload lecture notes or slides to this folder to activate AI tutoring.'
                          : 'Some files in this folder require attention.'}
                      </span>
                    </div>
                  </div>

                  <span className="text-lg font-black text-slate-900 ml-2">
                    {animatedProgress}%
                  </span>
                </div>

                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      isReady ? 'bg-emerald-600' : isIndexing ? 'bg-indigo-600' : 'bg-slate-400'
                    }`}
                    style={{ width: `${animatedProgress}%` }}
                  />
                </div>
              </div>

              {/* Scope Isolation Guarantee */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-slate-600">
                <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold text-slate-800">
                    Strict Folder Isolation Active
                  </span>
                  <p className="mt-0.5">
                    When you ask questions in <strong className="text-indigo-600">{activeFolderName}</strong>, RAG retrieval strictly isolates search chunks to this folder.
                  </p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase block">Documents</span>
                  <span className="text-base font-bold text-slate-900 mt-0.5 block">{totalDocs}</span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase block">Total Chunks</span>
                  <span className="text-base font-bold text-slate-900 mt-0.5 block">{totalChunks}</span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase block">Indexed</span>
                  <span className="text-base font-bold text-emerald-600 mt-0.5 block">{embeddedChunks}</span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase block">Dimension</span>
                  <span className="text-base font-bold text-indigo-600 mt-0.5 block">{status?.vectorDimensions || 768}d</span>
                </div>
              </div>

              {/* Documents List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    Documents in Scope ({status?.documents?.length || 0})
                  </span>
                  {status?.lastSyncedAt && (
                    <span className="text-[11px] text-slate-400">
                      Verified {new Date(status.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>

                {status?.documents && status.documents.length > 0 ? (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    {status.documents.map((doc) => (
                      <div key={doc.id} className="p-3 bg-white hover:bg-slate-50 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-900 truncate block">{doc.filename}</span>
                            <span className="text-[11px] text-slate-500">{doc.chunkCount} chunks • {(doc.extractedTextLength || 0).toLocaleString()} chars</span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                          Indexed ({doc.embeddedChunksCount}/{doc.chunkCount})
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl bg-slate-50 text-slate-500">
                    <Database className="w-6 h-6 mx-auto mb-1 text-slate-400" />
                    <p className="font-medium text-xs">No documents uploaded to this folder yet.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
              <button
                onClick={handleManualResync}
                disabled={isResyncing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isResyncing ? 'animate-spin' : ''}`} />
                <span>{isResyncing ? 'Re-verifying…' : 'Re-verify Index'}</span>
              </button>

              <div className="flex items-center gap-2">
                {onNavigateToTab && (
                  <>
                    <button
                      onClick={() => {
                        setShowModal(false);
                        onNavigateToTab('materials');
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium transition cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Manage Files</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowModal(false);
                        onNavigateToTab('rag');
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition cursor-pointer shadow-xs"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>RAG Explorer</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
