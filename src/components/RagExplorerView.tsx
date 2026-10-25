import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  Database,
  FileText,
  Filter,
  Layers,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react';
import { api } from '../lib/api';
import { Course, DocumentChunk, Folder, RagRetrieveResponse } from '../types';
import { VectorSyncIndicator } from './VectorSyncIndicator';

interface RagExplorerViewProps {
  activeCourse: Course | null;
  folders: Folder[];
  activeFolderId: string | null | 'all';
  onSelectFolder: (folderId: string | null | 'all') => void;
}

export const RagExplorerView: React.FC<RagExplorerViewProps> = ({
  activeCourse,
  folders,
  activeFolderId,
  onSelectFolder,
}) => {
  const [query, setQuery] = useState('scaled dot product attention vanishing gradients');
  const [topK, setTopK] = useState(4);
  const [forceLexical, setForceLexical] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [results, setResults] = useState<RagRetrieveResponse | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeCourse || !query.trim()) return;

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.testRetrieve({
        query: query.trim(),
        courseId: activeCourse.id,
        folderId: activeFolderId,
        topK,
        forceLexical,
      });
      setResults(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Retrieval note: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const activeFolderName =
    activeFolderId === 'all'
      ? 'All Folders (Course Wide)'
      : activeFolderId === null
      ? 'Root (Unassigned)'
      : folders.find((f) => f.id === activeFolderId)?.name || 'Selected Folder';

  if (!activeCourse) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Intro Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-indigo-950 rounded-2xl p-6 sm:p-8 text-white shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-xs font-bold border border-teal-500/30">
                Vector RAG Engine
              </span>
              <span className="text-xs text-slate-300">Model: gemini-embedding-2-preview (768d)</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Vector Search & Scope Isolation Tester</h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mt-1 leading-relaxed">
              Test semantic cosine similarity ranking, verify strict folder isolation barriers, and test automatic lexical fallback side-by-side.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <VectorSyncIndicator
              activeCourse={activeCourse}
              activeFolderId={activeFolderId}
              folders={folders}
            />

            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3.5 py-2 rounded-full border border-white/10 text-xs font-medium">
              <Shield className="w-4 h-4 text-teal-300" />
              <span>Scope: <strong>{activeFolderName}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="font-bold px-2 py-0.5">✕</button>
        </div>
      )}

      {/* Query Bar */}
      <div className="sb-card p-5 border-t-4 border-t-teal-600 space-y-4">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter search query or concept to test vector similarity…"
                className="w-full text-xs sm:text-sm pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-teal-500 outline-none font-medium text-slate-800"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold shadow transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Embedding & Searching…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Execute RAG Query
                </>
              )}
            </button>
          </div>

          {/* Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-teal-600" />
                Folder Scope:
              </label>
              <select
                value={activeFolderId === null ? 'null' : activeFolderId}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'all') onSelectFolder('all');
                  else if (val === 'null') onSelectFolder(null);
                  else onSelectFolder(val);
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold text-slate-800 cursor-pointer"
              >
                <option value="all">📂 All Course Folders (Global)</option>
                <option value="null">📄 Root / Unassigned Only</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    📁 {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>Top Chunks (Top-K):</span>
                <span className="text-teal-700 font-bold">{topK}</span>
              </label>
              <input
                type="range"
                min="1"
                max="8"
                value={topK}
                onChange={(e) => setTopK(parseInt(e.target.value, 10))}
                className="w-full accent-teal-600 cursor-pointer mt-1"
              />
            </div>

            <div className="flex items-center gap-2 pt-4">
              <input
                type="checkbox"
                id="forceLexical"
                checked={forceLexical}
                onChange={(e) => setForceLexical(e.target.checked)}
                className="w-4 h-4 text-teal-600 rounded"
              />
              <label htmlFor="forceLexical" className="font-semibold text-slate-700 cursor-pointer select-none">
                Force Lexical Fallback (Test keyword matching)
              </label>
            </div>
          </div>
        </form>
      </div>

      {/* Results */}
      {results && (
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <span className="text-slate-500">Method: </span>
                <span
                  className={`font-bold px-2 py-0.5 rounded ${
                    results.retrievalMethod === 'vector_primary'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  {results.retrievalMethod === 'vector_primary' ? 'PRIMARY VECTOR RETRIEVAL' : 'SECONDARY LEXICAL FALLBACK'}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Scope Chunks: </span>
                <span className="font-bold text-slate-800">{results.totalChunksInScope} searched</span>
              </div>
              <div>
                <span className="text-slate-500">Retrieved: </span>
                <span className="font-bold text-slate-800">{results.results.length} chunks</span>
              </div>
            </div>

            <span className="text-slate-400 text-[11px]">
              🔒 Strictly scoped to {activeFolderName}
            </span>
          </div>

          {results.usedFallback && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2.5">
              <Zap className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Fallback Active:</strong> Vector embeddings were bypassed or unavailable for this query. High-precision lexical matching was used.
              </span>
            </div>
          )}

          {results.results.length === 0 ? (
            <div className="sb-card p-12 text-center text-slate-500 text-xs">
              No matching chunks found in this folder scope. Try broadening your query or switching to "All Folders".
            </div>
          ) : (
            <div className="space-y-3">
              {results.results.map((res, idx) => {
                const chunk = res.chunk;
                const scorePercent = Math.round(res.score * 100);
                const folderObj = folders.find((f) => f.id === chunk.folderId);

                return (
                  <div
                    key={chunk.chunkId || idx}
                    className="sb-card p-4 border-l-4 border-l-teal-600 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-teal-50 text-teal-700 font-bold text-xs flex items-center justify-center border border-teal-200">
                          #{idx + 1}
                        </span>
                        <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                          <FileText className="w-3.5 h-3.5 text-teal-600" />
                          <span>{chunk.filename}</span>
                          <span className="text-slate-400 font-normal">
                            • Page/Slide {chunk.pageOrSlide}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            res.matchType === 'vector'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {res.matchType === 'vector' ? 'Vector Cosine Match' : 'Keyword Match'}
                        </span>
                        <span className="text-xs font-bold text-slate-700">{scorePercent}%</span>
                        <div className="w-16 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                          <div
                            className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full"
                            style={{ width: `${Math.min(100, Math.max(5, scorePercent))}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                      <span className="text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                        📁 {folderObj ? folderObj.name : 'Root'}
                      </span>
                      <span>•</span>
                      <span>ID: {chunk.chunkId}</span>
                      <span>•</span>
                      <span>~{chunk.tokenEstimate} tokens</span>
                    </div>

                    {/* Source Excerpt */}
                    {(res.relevantExcerpt || chunk.sourceExcerpt) && (
                      <div className="p-2.5 rounded-xl bg-teal-50/60 border border-teal-100 text-xs text-teal-950 font-medium">
                        <div className="text-[10px] font-bold text-teal-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          Relevant Excerpt
                        </div>
                        <p className="leading-relaxed">"{res.relevantExcerpt || chunk.sourceExcerpt}"</p>
                      </div>
                    )}

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 leading-relaxed font-sans max-h-36 overflow-y-auto">
                      {chunk.text}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
