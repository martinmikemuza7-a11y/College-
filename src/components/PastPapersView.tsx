import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle,
  Clock,
  Eye,
  FileText,
  Filter,
  Folder as FolderIcon,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { Course, Folder, PastPaper } from '../types';

interface PastPapersViewProps {
  activeCourse: Course | null;
  folders: Folder[];
  activeFolderId: string | null | 'all';
  onSelectFolder: (folderId: string | null | 'all') => void;
  onLaunchExamWithPaper?: (paperId: string) => void;
  onOpenCreateCourseModal?: () => void;
}

export const PastPapersView: React.FC<PastPapersViewProps> = ({
  activeCourse,
  folders,
  activeFolderId,
  onSelectFolder,
  onLaunchExamWithPaper,
  onOpenCreateCourseModal,
}) => {
  const [pastPapers, setPastPapers] = useState<PastPaper[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedPaper, setSelectedPaper] = useState<PastPaper | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleMovePaper = async (paperId: string, targetFolderId: string | null) => {
    try {
      const res = await api.updatePastPaper(paperId, { folderId: targetFolderId });
      setPastPapers((prev) =>
        prev.map((p) => (p.id === paperId ? { ...p, folderId: res.pastPaper.folderId } : p))
      );
    } catch (err) {
      console.error('Failed to move past paper:', err);
    }
  };

  const activeFolderName =
    activeFolderId === 'all'
      ? 'All Folders'
      : activeFolderId === null
      ? 'Course Root'
      : folders.find((f) => f.id === activeFolderId)?.name || 'Selected Folder';

  useEffect(() => {
    if (activeCourse) {
      loadPastPapers();
    }
  }, [activeCourse, activeFolderId]);

  const loadPastPapers = async () => {
    if (!activeCourse) return;
    setIsLoading(true);
    try {
      const res = await api.getPastPapers(activeCourse.id, activeFolderId);
      setPastPapers(res.pastPapers || []);
    } catch (err) {
      console.error('Failed to load past papers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeCourse) return;

    const MAX_SIZE = 30 * 1024 * 1024; // 30MB ceiling
    if (file.size > MAX_SIZE) {
      setUploadError(
        `File "${file.name}" (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds the 30MB limit. Please compress or split the document.`
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const folderTarget = activeFolderId === 'all' ? null : activeFolderId;

    try {
      const res = await api.uploadPastPaperFile(activeCourse.id, folderTarget, file);
      setPastPapers((prev) => [res.pastPaper, ...prev]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setUploadError(msg);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeletePaper = async (id: string) => {
    try {
      await api.deletePastPaper(id);
      setPastPapers((prev) => prev.filter((p) => p.id !== id));
      if (selectedPaper?.id === id) setSelectedPaper(null);
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Failed to delete past paper:', err);
    }
  };

  if (!activeCourse) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center animate-in fade-in">
        <div className="sb-card p-10 space-y-4">
          <BookOpen className="w-12 h-12 text-indigo-400 mx-auto mb-2" />
          <h2 className="text-xl font-bold text-slate-800">Select or Create a Course</h2>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            Choose a course or create a new one to manage and practice with university past exam papers.
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Past Exam Papers</h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
              {activeCourse.code}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Official exams, residential tests, and midterm papers. Calibrate AI exam style, marks, and question formats.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".pdf,.docx,.doc,.pptx,.ppsx,.ppt,.txt,.png,.jpg,.jpeg,.webp"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow transition cursor-pointer disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {isUploading ? 'Parsing Exam Questions…' : 'Upload Past Paper'}
          </button>
        </div>
      </div>

      {uploadError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
          <button onClick={() => setUploadError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Scope Filtering bar */}
      <div className="sb-card p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-indigo-500" />
          <span className="font-semibold text-slate-500 uppercase tracking-wider text-[11px]">Folder Scope:</span>
          <button
            onClick={() => onSelectFolder('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              activeFolderId === 'all'
                ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Folders
          </button>
          <button
            onClick={() => onSelectFolder(null)}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              activeFolderId === null
                ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Course Root
          </button>
          {folders.map((f) => (
            <button
              key={f.id}
              onClick={() => onSelectFolder(f.id)}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                activeFolderId === f.id
                  ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              📁 {f.name}
            </button>
          ))}
        </div>

        <span className="text-slate-500 text-xs">
          Scope: <strong className="text-slate-800">{activeFolderName}</strong> ({pastPapers.length} papers)
        </span>
      </div>

      {/* Grid of Papers */}
      {isLoading ? (
        <div className="text-center py-16 sb-card">
          <Clock className="w-6 h-6 text-indigo-600 animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-medium">Loading past examination papers…</p>
        </div>
      ) : pastPapers.length === 0 ? (
        <div className="sb-card p-12 text-center space-y-3">
          <FileText className="w-12 h-12 text-indigo-200 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No Past Papers in this Folder</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Upload past exam papers, midterm questionnaires, or practice test scans to calibrate AI questions.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow cursor-pointer inline-flex items-center gap-1.5"
          >
            <Upload className="w-4 h-4" />
            Upload First Exam Paper
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pastPapers.map((paper) => (
            <div
              key={paper.id}
              className="sb-card p-5 flex flex-col justify-between sb-card-hover border-t-4 border-t-blue-500 space-y-3"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                    <FileText className="w-4 h-4" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {paper.status === 'ready' ? 'Ready' : paper.status}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-sm line-clamp-1" title={paper.title}>
                  {paper.title}
                </h3>
                <p className="text-xs text-slate-400 font-mono truncate mt-0.5">{paper.filename}</p>

                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Term</span>
                    <span className="font-semibold text-slate-800">{paper.examTerm || 'Final Exam'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Year</span>
                    <span className="font-semibold text-slate-800">{paper.year || '2024'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Pages</span>
                    <span className="font-semibold text-slate-800">{paper.pageCount} pages</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Questions</span>
                    <span className="font-bold text-indigo-600">
                      {paper.extractedQuestions?.length || 0} parsed
                    </span>
                  </div>
                </div>

                {/* Folder Location & Organization */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-600 truncate">
                    <FolderIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span className="truncate">
                      {folders.find((f) => f.id === paper.folderId)?.name || 'Course Root'}
                    </span>
                  </div>
                  <select
                    value={paper.folderId || 'root'}
                    onChange={(e) => handleMovePaper(paper.id, e.target.value === 'root' ? null : e.target.value)}
                    className="text-[10px] px-2 py-1 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 cursor-pointer shrink-0 font-medium"
                    title="Move past paper to another folder"
                  >
                    <option value="root">Course Root</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        📁 {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                {onLaunchExamWithPaper && (
                  <button
                    onClick={() => onLaunchExamWithPaper(paper.id)}
                    className="w-full py-2 px-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Practice AI Exam (Notes Grounded)</span>
                  </button>
                )}

                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    onClick={() => setSelectedPaper(paper)}
                    className="font-bold text-slate-700 hover:text-indigo-600 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Inspect Exam Blueprint</span>
                  </button>

                  <button
                    onClick={() => setDeleteConfirmId(paper.id)}
                    title="Delete paper"
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inspect Structure Modal */}
      {selectedPaper && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div>
                <h3 className="font-bold text-slate-900 text-base">{selectedPaper.title}</h3>
                <p className="text-xs text-slate-500">
                  {selectedPaper.examTerm} {selectedPaper.year} • {selectedPaper.extractedQuestions?.length || 0} questions parsed
                </p>
              </div>
              <button onClick={() => setSelectedPaper(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 flex-1 text-xs">
              {selectedPaper.extractedQuestions && selectedPaper.extractedQuestions.length > 0 ? (
                selectedPaper.extractedQuestions.map((q, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                          Q{q.questionNumber}
                        </span>
                        {q.section && <span className="font-semibold text-slate-600">{q.section}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {q.type.replace('_', ' ')}
                        </span>
                        {q.allocatedMarks && (
                          <span className="font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                            {q.allocatedMarks} marks
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-sm font-semibold text-slate-800 leading-snug">{q.prompt}</p>

                    {q.options && q.options.length > 0 && (
                      <div className="space-y-1 pl-2 text-slate-600">
                        {q.options.map((opt, oIdx) => (
                          <div key={oIdx}>• {opt}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400">No questions parsed.</div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/70">
              <span className="text-xs text-slate-500">Course: <strong>{activeCourse.title}</strong></span>
              <div className="flex items-center gap-2">
                {onLaunchExamWithPaper && (
                  <button
                    onClick={() => {
                      const id = selectedPaper.id;
                      setSelectedPaper(null);
                      onLaunchExamWithPaper(id);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Calibrate Mock Exam</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedPaper(null)}
                  className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Delete Past Exam Paper</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Are you sure you want to delete this past paper? Its extracted questions will no longer be available for mock exam calibration.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeletePaper(deleteConfirmId)}
                className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow"
              >
                Delete Paper
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
