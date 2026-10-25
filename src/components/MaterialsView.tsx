import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Bot,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  Edit2,
  FileText,
  FileUp,
  Folder as FolderIcon,
  FolderPlus,
  HelpCircle,
  Layers,
  ListChecks,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Star,
  Trash2,
  UploadCloud,
  WifiOff,
  X,
} from 'lucide-react';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { api, getActiveUserId } from '../lib/api';
import { offlineDb } from '../lib/offlineDb';
import { syncManager } from '../lib/syncManager';
import {
  Course,
  DocumentChunk,
  Folder,
  Material,
  QueuedUploadItem,
  QuizQuestion,
  StagedFileItem,
} from '../types';
import { VectorSyncIndicator } from './VectorSyncIndicator';
import { DocumentQAModal } from './DocumentQAModal';
import { PostUploadSaveModal } from './PostUploadSaveModal';
import { CreateCourseModal } from './CreateCourseModal';

export const DOCUMENT_CATEGORIES = [
  'Lecture Notes',
  'Slides / Presentation',
  'Syllabus & Guide',
  'Exam Prep & Review',
  'Homework & Lab',
  'Textbook Chapter',
  'Reference Material',
];

export function detectCategory(filename: string): string {
  const lower = filename.toLowerCase();
  if (/\.(pptx?|ppsx?|ppt)$/i.test(lower) || lower.includes('slide') || lower.includes('deck')) {
    return 'Slides / Presentation';
  }
  if (lower.includes('exam') || lower.includes('quiz') || lower.includes('test') || lower.includes('midterm')) {
    return 'Exam Prep & Review';
  }
  if (lower.includes('lab') || lower.includes('homework') || lower.includes('hw')) {
    return 'Homework & Lab';
  }
  if (lower.includes('syllabus') || lower.includes('guide') || lower.includes('schedule')) {
    return 'Syllabus & Guide';
  }
  return 'Lecture Notes';
}

interface MaterialsViewProps {
  activeCourse: Course | null;
  folders: Folder[];
  activeFolderId: string | null | 'all';
  onSelectFolder: (folderId: string | null | 'all') => void;
  onRefreshFolders: () => void;
  onCreateCourse?: (data: { title: string; code: string; description: string; color: string }) => Promise<Course | void> | void;
  onOpenCreateCourseModal?: () => void;
  onUpdateCourse?: (courseId: string, updates: Partial<Course>) => Promise<void>;
  onDeleteCourse?: (courseId: string) => Promise<void>;
  onLaunchQuizWithDocument?: (documentId: string) => void;
  onNavigateToTutor?: (targetFolderId?: string | null, count?: number) => void;
  uploadQueue: QueuedUploadItem[];
  onEnqueueUploads: (
    items: QueuedUploadItem[],
    navigateToTutor?: boolean,
    targetFolderId?: string | null
  ) => void;
  onClearCompletedQueue: () => void;
  onRemoveQueueItem: (id: string) => void;
  onRetryQueueItem: (item: QueuedUploadItem) => void;
  isQueueMinimized: boolean;
  onToggleQueueMinimized: () => void;
}

export const MaterialsView: React.FC<MaterialsViewProps> = ({
  activeCourse,
  folders,
  activeFolderId,
  onSelectFolder,
  onRefreshFolders,
  onCreateCourse,
  onOpenCreateCourseModal,
  onUpdateCourse,
  onDeleteCourse,
  onLaunchQuizWithDocument,
  onNavigateToTutor,
  uploadQueue,
  onEnqueueUploads,
  onClearCompletedQueue,
  onRemoveQueueItem,
  onRetryQueueItem,
  isQueueMinimized,
  onToggleQueueMinimized,
}) => {
  const syncState = useSyncStatus();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTab, setUploadTab] = useState<'file' | 'text'>('file');
  const [showLocalCreateCourseModal, setShowLocalCreateCourseModal] = useState(false);

  // Course Management modals
  const [showEditCourseModal, setShowEditCourseModal] = useState(false);
  const [showDeleteCourseModal, setShowDeleteCourseModal] = useState(false);
  const [deleteCourseConfirmText, setDeleteCourseConfirmText] = useState('');
  const [isDeletingCourse, setIsDeletingCourse] = useState(false);
  const [isUpdatingCourse, setIsUpdatingCourse] = useState(false);

  const [editTitle, setEditTitle] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editColor, setEditColor] = useState('#4F46E5');

  // File Deletion with confirmation
  const [materialToDelete, setMaterialToDelete] = useState<Material | null>(null);
  const [isDeletingMaterial, setIsDeletingMaterial] = useState(false);

  useEffect(() => {
    if (activeCourse) {
      setEditTitle(activeCourse.title);
      setEditCode(activeCourse.code);
      setEditDesc(activeCourse.description || '');
      setEditColor(activeCourse.color || '#4F46E5');
    }
  }, [activeCourse]);

  // Multi-file staging
  const [stagedFiles, setStagedFiles] = useState<StagedFileItem[]>([]);
  const [bulkFolderId, setBulkFolderId] = useState<string | null | 'all'>(
    activeFolderId === 'all' ? null : activeFolderId
  );
  const [bulkCategory, setBulkCategory] = useState<string>('Lecture Notes');
  const [isDragOver, setIsDragOver] = useState(false);
  const [pastedTitle, setPastedTitle] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [pastedCategory, setPastedCategory] = useState<string>('Lecture Notes');
  const [targetUploadFolderId, setTargetUploadFolderId] = useState<string | null>(
    activeFolderId === 'all' ? null : activeFolderId
  );
  const [autoReturnToTutor, setAutoReturnToTutor] = useState(true);

  // Auto-generate Q&A options
  const [uploadAutoGenerateQA, setUploadAutoGenerateQA] = useState(true);
  const [uploadQuestionCount, setUploadQuestionCount] = useState(5);
  const [uploadDifficulty, setUploadDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

  // Modals state
  const [saveModalMaterial, setSaveModalMaterial] = useState<Material | null>(null);
  const [saveModalQuestions, setSaveModalQuestions] = useState<QuizQuestion[] | undefined>(undefined);
  const [qaModalMaterial, setQaModalMaterial] = useState<Material | null>(null);
  const [qaModalQuestions, setQaModalQuestions] = useState<QuizQuestion[] | undefined>(undefined);

  // Folder CRUD
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newCreatedFolderName, setNewCreatedFolderName] = useState('');
  const [folderToRename, setFolderToRename] = useState<Folder | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);
  const [reassignTargetFolderId, setReassignTargetFolderId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Chunk inspection
  const [inspectingMaterial, setInspectingMaterial] = useState<Material | null>(null);
  const [materialChunks, setMaterialChunks] = useState<DocumentChunk[]>([]);
  const [isLoadingChunks, setIsLoadingChunks] = useState(false);

  useEffect(() => {
    if (!activeCourse) return;
    loadMaterials();
  }, [activeCourse?.id, activeFolderId]);

  useEffect(() => {
    setTargetUploadFolderId(activeFolderId === 'all' ? null : activeFolderId);
  }, [activeFolderId]);

  const loadMaterials = async () => {
    if (!activeCourse) return;
    const userId = getActiveUserId();

    try {
      const cached = await offlineDb.getMaterials(userId, activeCourse.id, activeFolderId);
      if (cached && cached.length > 0) {
        setMaterials(cached);
      }
    } catch (err) {
      console.warn('[MaterialsView] IndexedDB read notice:', err);
    }

    if (navigator.onLine) {
      setIsLoading(true);
      try {
        const res = await api.getMaterials(activeCourse.id, activeFolderId);
        const list = res.materials || [];
        setMaterials(list);
        await offlineDb.saveMaterials(userId, activeCourse.id, activeFolderId, list);
        syncManager.refreshStats();
      } catch (err) {
        console.warn('[MaterialsView] Server load failed:', err);
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  };

  const handleFilesSelected = (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    const MAX_SIZE = 30 * 1024 * 1024; // 30MB limit
    const oversized = list.filter((f) => f.size > MAX_SIZE);
    if (oversized.length > 0) {
      setFeedbackMessage({
        text: `⚠️ ${oversized.length} file${oversized.length > 1 ? 's' : ''} exceeded the 30MB limit and were skipped (${oversized.map((f) => f.name).join(', ')}). Please compress or split large documents.`,
      });
    }

    const validList = list.filter((f) => f.size <= MAX_SIZE);
    if (validList.length === 0) return;

    setStagedFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => `${f.name}_${f.size}`));
      const newItems: StagedFileItem[] = validList
        .filter((f) => !existingKeys.has(`${f.name}_${f.size}`))
        .map((file) => ({
          id: `staged_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          file,
          name: file.name,
          size: file.size,
          folderId: targetUploadFolderId,
          category: detectCategory(file.name),
          customTitle: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
        }));
      return [...prev, ...newItems];
    });
  };

  const handleEnqueueUpload = (e?: React.FormEvent, destination?: 'tutor' | 'materials') => {
    if (e) e.preventDefault();
    if (!activeCourse) return;

    const chosenDestination = destination || (autoReturnToTutor ? 'tutor' : 'materials');

    if (uploadTab === 'file') {
      if (stagedFiles.length === 0) return;

      const newItems: QueuedUploadItem[] = stagedFiles.map((staged) => {
        const itemFolderId = staged.folderId;
        const targetFolderName =
          itemFolderId === null
            ? 'Root (Unassigned)'
            : folders.find((f) => f.id === itemFolderId)?.name || 'Folder';

        const customTitle = staged.customTitle?.trim() || staged.name.replace(/\.[^/.]+$/, '');

        return {
          id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          file: staged.file,
          courseId: activeCourse.id,
          folderId: itemFolderId,
          targetFolderName,
          filename: staged.name,
          customTitle,
          sizeBytes: staged.size,
          status: 'queued',
          statusMessage: 'In queue…',
          progressPercent: 0,
          autoGenerateQA: uploadAutoGenerateQA,
          questionCount: uploadQuestionCount,
          difficulty: uploadDifficulty,
          category: staged.category,
        };
      });

      const primaryFolderId =
        newItems.length > 0 && newItems.every((it) => it.folderId === newItems[0].folderId)
          ? newItems[0].folderId
          : newItems[0]?.folderId;

      onEnqueueUploads(newItems, chosenDestination === 'tutor', primaryFolderId);
      setShowUploadModal(false);
      setStagedFiles([]);

      if (chosenDestination === 'materials') {
        setFeedbackMessage({
          text: `Enqueued ${newItems.length} document${newItems.length === 1 ? '' : 's'}. Background vector indexing active.`,
        });
      }
    } else if (uploadTab === 'text') {
      if (!pastedText.trim()) return;

      const title = pastedTitle.trim() || 'Study Notes';
      const filename = `${title.replace(/\s+/g, '_')}.txt`;
      const targetFolderName =
        targetUploadFolderId === null
          ? 'Root (Unassigned)'
          : folders.find((f) => f.id === targetUploadFolderId)?.name || 'Folder';

      const newItem: QueuedUploadItem = {
        id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        textPayload: { filename, text: pastedText.trim() },
        courseId: activeCourse.id,
        folderId: targetUploadFolderId,
        targetFolderName,
        filename,
        customTitle: title,
        sizeBytes: new Blob([pastedText]).size,
        status: 'queued',
        statusMessage: 'In queue…',
        progressPercent: 0,
        autoGenerateQA: uploadAutoGenerateQA,
        questionCount: uploadQuestionCount,
        difficulty: uploadDifficulty,
        category: pastedCategory || 'Lecture Notes',
      };

      onEnqueueUploads([newItem], chosenDestination === 'tutor', targetUploadFolderId);
      setShowUploadModal(false);
      setPastedTitle('');
      setPastedText('');

      if (chosenDestination === 'materials') {
        setFeedbackMessage({
          text: `Enqueued notes "${filename}" for vector indexing.`,
        });
      }
    }
  };

  const handleToggleFavorite = async (mat: Material) => {
    const userId = getActiveUserId();
    const newFavorite = !mat.isFavorite;

    setMaterials((prev) => prev.map((m) => (m.id === mat.id ? { ...m, isFavorite: newFavorite } : m)));

    if (!navigator.onLine) {
      await offlineDb.updateMaterialOffline(userId, mat.id, { isFavorite: newFavorite });
      await offlineDb.enqueueSyncAction({
        userId,
        type: 'update_material',
        payload: { materialId: mat.id, updates: { isFavorite: newFavorite } },
      });
      syncManager.refreshStats();
      return;
    }

    try {
      const res = await api.updateMaterial(mat.id, { isFavorite: newFavorite });
      setMaterials((prev) => prev.map((m) => (m.id === mat.id ? res.material : m)));
      await offlineDb.saveMaterial(userId, res.material);
      syncManager.refreshStats();
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const handleMoveDocument = async (materialId: string, newFolderId: string | null) => {
    const userId = getActiveUserId();
    if (!navigator.onLine) {
      await offlineDb.updateMaterialOffline(userId, materialId, { folderId: newFolderId });
      await offlineDb.enqueueSyncAction({
        userId,
        type: 'move_material',
        payload: { materialId, targetFolderId: newFolderId },
      });
      syncManager.refreshStats();
      await loadMaterials();
      return;
    }

    try {
      await api.moveMaterial(materialId, newFolderId);
      setFeedbackMessage({ text: 'Document moved successfully.' });
      await loadMaterials();
      onRefreshFolders();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFeedbackMessage({ text: `Move note: ${msg}`, isError: true });
    }
  };

  const handleDeleteMaterial = async (id: string, filename: string) => {
    const userId = getActiveUserId();
    if (!navigator.onLine) {
      await offlineDb.deleteMaterialOffline(userId, id);
      await offlineDb.enqueueSyncAction({
        userId,
        type: 'delete_material',
        payload: { materialId: id },
      });
      syncManager.refreshStats();
      setFeedbackMessage({ text: `Removed "${filename}" locally (will sync deletion when online).` });
      await loadMaterials();
      return;
    }

    try {
      await api.deleteMaterial(id);
      await offlineDb.deleteMaterialOffline(userId, id);
      syncManager.refreshStats();
      setFeedbackMessage({ text: `Removed "${filename}".` });
      await loadMaterials();
      onRefreshFolders();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleConfirmDeleteMaterial = async () => {
    if (!materialToDelete) return;
    setIsDeletingMaterial(true);
    try {
      await handleDeleteMaterial(materialToDelete.id, materialToDelete.filename);
      setMaterialToDelete(null);
    } finally {
      setIsDeletingMaterial(false);
    }
  };

  const handleRetryProcessing = async (mat: Material) => {
    try {
      setFeedbackMessage({ text: `Retrying processing for "${mat.filename}"…` });
      await api.retryMaterial(mat.id);
      await loadMaterials();
      setFeedbackMessage({ text: `Successfully re-indexed "${mat.filename}".` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFeedbackMessage({ text: `Retry failed: ${msg}`, isError: true });
      await loadMaterials();
    }
  };

  const handleUpdateCourseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCourse || !onUpdateCourse || !editTitle.trim()) return;
    setIsUpdatingCourse(true);
    try {
      await onUpdateCourse(activeCourse.id, {
        title: editTitle.trim(),
        code: editCode.trim(),
        description: editDesc.trim(),
        color: editColor,
      });
      setShowEditCourseModal(false);
      setFeedbackMessage({ text: 'Course information updated.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFeedbackMessage({ text: `Failed to update course: ${msg}`, isError: true });
    } finally {
      setIsUpdatingCourse(false);
    }
  };

  const handleDeleteCourseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCourse || !onDeleteCourse) return;
    const cleanConfirm = deleteCourseConfirmText.trim().toLowerCase();
    const cleanCode = activeCourse.code.trim().toLowerCase();
    const cleanTitle = activeCourse.title.trim().toLowerCase();
    if (cleanConfirm !== cleanCode && cleanConfirm !== cleanTitle) {
      setFeedbackMessage({ text: `Please type "${activeCourse.code}" or the course name to confirm deletion.`, isError: true });
      return;
    }
    setIsDeletingCourse(true);
    try {
      await onDeleteCourse(activeCourse.id);
      setShowDeleteCourseModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFeedbackMessage({ text: `Failed to delete course: ${msg}`, isError: true });
      setIsDeletingCourse(false);
    }
  };

  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCourse || !newCreatedFolderName.trim()) return;
    try {
      await api.createFolder(activeCourse.id, { name: newCreatedFolderName.trim() });
      setNewCreatedFolderName('');
      setShowCreateFolderModal(false);
      onRefreshFolders();
    } catch (err) {
      console.error('Create folder failed:', err);
    }
  };

  const handleRenameFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderToRename || !newFolderName.trim()) return;
    try {
      await api.updateFolder(folderToRename.id, { name: newFolderName.trim() });
      setFolderToRename(null);
      setNewFolderName('');
      onRefreshFolders();
    } catch (err) {
      console.error('Rename folder failed:', err);
    }
  };

  const handleDeleteFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderToDelete) return;
    try {
      await api.deleteFolder(folderToDelete.id, reassignTargetFolderId);
      if (activeFolderId === folderToDelete.id) {
        onSelectFolder('all');
      }
      setFolderToDelete(null);
      setReassignTargetFolderId(null);
      onRefreshFolders();
      await loadMaterials();
    } catch (err) {
      console.error('Delete folder failed:', err);
    }
  };

  const handleInspectChunks = async (mat: Material) => {
    setInspectingMaterial(mat);
    setIsLoadingChunks(true);
    try {
      const res = await api.getMaterialChunks(mat.id);
      setMaterialChunks(res.chunks || []);
    } catch (err) {
      console.error('Failed to load chunks:', err);
    } finally {
      setIsLoadingChunks(false);
    }
  };

  if (!activeCourse) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center animate-in fade-in">
        <div className="sb-card p-10 space-y-5 border-indigo-100 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto shadow-2xs">
            <BookOpen className="w-7 h-7" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h2 className="text-xl font-bold text-slate-900">No Course Selected</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Create a new course to start uploading study notes, lecture slides, and past papers with semantic vector search.
            </p>
          </div>
          <div className="flex justify-center pt-2">
            <button
              onClick={() => {
                if (onOpenCreateCourseModal) {
                  onOpenCreateCourseModal();
                } else {
                  setShowLocalCreateCourseModal(true);
                }
              }}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Course</span>
            </button>
          </div>
        </div>

        {onCreateCourse && (
          <CreateCourseModal
            isOpen={showLocalCreateCourseModal}
            onClose={() => setShowLocalCreateCourseModal(false)}
            onCreateCourse={onCreateCourse}
          />
        )}
      </div>
    );
  }

  const currentFolder = folders.find((f) => f.id === activeFolderId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      {feedbackMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
            feedbackMessage.isError
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <span>{feedbackMessage.text}</span>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="font-bold px-2 py-0.5 ml-2 cursor-pointer hover:opacity-80"
          >
            ✕
          </button>
        </div>
      )}

      {/* Course Overview & Management Banner */}
      <div className="sb-card p-5 border-t-4 border-t-indigo-600 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-2.5 py-1 text-xs font-bold rounded-lg text-white bg-indigo-600">
                {activeCourse.code}
              </span>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight truncate">
                {activeCourse.title}
              </h1>
            </div>
            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
              {activeCourse.description ||
                'Course study hub: upload slides, PDFs, DOCX, or lecture notes for content-grounded semantic retrieval.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] font-semibold uppercase">Documents</span>
                <span className="font-bold text-slate-800">{materials.length}</span>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div>
                <span className="text-slate-400 block text-[10px] font-semibold uppercase">Folders</span>
                <span className="font-bold text-slate-800">{folders.length}</span>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div>
                <span className="text-slate-400 block text-[10px] font-semibold uppercase">Indexed Chunks</span>
                <span className="font-bold text-indigo-600">
                  {materials.reduce((sum, m) => sum + (m.chunkCount || 0), 0)}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                if (onOpenCreateCourseModal) {
                  onOpenCreateCourseModal();
                } else {
                  setShowLocalCreateCourseModal(true);
                }
              }}
              className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Create New Course"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-600" />
              <span>New Course</span>
            </button>

            <button
              onClick={() => {
                setEditTitle(activeCourse.title);
                setEditCode(activeCourse.code);
                setEditDesc(activeCourse.description || '');
                setEditColor(activeCourse.color || '#4F46E5');
                setShowEditCourseModal(true);
              }}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              title="Edit Course Name & Code"
            >
              <Edit2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Edit Course</span>
            </button>

            <button
              onClick={() => {
                setDeleteCourseConfirmText('');
                setShowDeleteCourseModal(true);
              }}
              className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              title="Delete Course and Associated Data"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
              <span>Delete Course</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Folders Directory */}
        <div className="lg:col-span-1 space-y-4">
          <div className="sb-card p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <FolderIcon className="w-4 h-4 text-amber-500" />
                Study Folders
              </span>
              <button
                onClick={() => {
                  setNewCreatedFolderName('');
                  setShowCreateFolderModal(true);
                }}
                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                title="Create New Folder"
              >
                <FolderPlus className="w-4 h-4" />
              </button>
            </div>

            <nav className="space-y-1 text-xs">
              <button
                onClick={() => onSelectFolder('all')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium transition cursor-pointer ${
                  activeFolderId === 'all'
                    ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 shadow-2xs'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <Layers className={`w-4 h-4 ${activeFolderId === 'all' ? 'text-indigo-600' : 'text-slate-400'}`} />
                  All Documents
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">{materials.length}</span>
              </button>

              <button
                onClick={() => onSelectFolder(null)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium transition cursor-pointer ${
                  activeFolderId === null
                    ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 shadow-2xs'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <FileText className={`w-4 h-4 ${activeFolderId === null ? 'text-indigo-600' : 'text-slate-400'}`} />
                  Root / Unassigned
                </span>
              </button>

              <div className="pt-2 border-t border-slate-100 space-y-1">
                {folders.map((folder) => {
                  const isSelected = activeFolderId === folder.id;
                  return (
                    <div
                      key={folder.id}
                      className={`group flex items-center justify-between px-3 py-2 rounded-xl transition cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 shadow-2xs'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <button
                        onClick={() => onSelectFolder(folder.id)}
                        className="flex items-center gap-2 truncate text-left flex-1 cursor-pointer"
                      >
                        <FolderIcon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-indigo-600' : 'text-amber-500'}`} />
                        <span className="truncate">{folder.name}</span>
                      </button>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFolderToRename(folder);
                            setNewFolderName(folder.name);
                          }}
                          className="p-1 rounded hover:bg-slate-200/60 text-slate-400 hover:text-slate-700"
                          title="Rename Folder"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFolderToDelete(folder);
                            setReassignTargetFolderId(null);
                          }}
                          className="p-1 rounded hover:bg-slate-200/60 text-slate-400 hover:text-red-600"
                          title="Delete Folder (Preserving Documents)"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </nav>

            <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400 leading-tight">
              🔒 <strong>Strict Scope Isolation:</strong> Chunks from selected folders are retrieved in RAG queries without cross-talk.
            </div>
          </div>
        </div>

        {/* Right Column: Documents List & Actions */}
        <div className="lg:col-span-3 space-y-4">
          {/* Header Bar */}
          <div className="sb-card p-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  {activeFolderId === 'all'
                    ? 'All Course Materials'
                    : activeFolderId === null
                    ? 'Root / Unassigned Documents'
                    : currentFolder?.name}
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200">
                  {materials.length} {materials.length === 1 ? 'document' : 'documents'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeFolderId === 'all'
                  ? 'Showing all uploaded resources across all course folders'
                  : 'Vector indexing and retrieval strictly constrained to this folder'}
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <VectorSyncIndicator
                activeCourse={activeCourse}
                activeFolderId={activeFolderId}
                folders={folders}
              />

              <button
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow transition flex items-center gap-2 cursor-pointer shrink-0"
              >
                <UploadCloud className="w-4 h-4" />
                Upload Documents
              </button>
            </div>
          </div>

          {/* Documents Grid */}
          {isLoading ? (
            <div className="text-center py-16 sb-card">
              <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">Loading documents & vector status…</p>
            </div>
          ) : materials.length === 0 ? (
            <div className="text-center py-16 sb-card p-6 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No Documents in this Scope</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Upload lecture slides, textbook notes, or PDF notes to generate 768-dim embeddings and enable grounded AI study.
              </p>
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow cursor-pointer"
              >
                Upload First Material
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {materials.map((mat) => {
                const folderObj = folders.find((f) => f.id === mat.folderId);
                const isPdf = /\.pdf$/i.test(mat.filename);
                const isDoc = /\.(docx?|docm)$/i.test(mat.filename);
                const isPpt = /\.(pptx?|ppsx?|ppt)$/i.test(mat.filename);

                return (
                  <div
                    key={mat.id}
                    className="sb-card p-4 flex flex-col justify-between sb-card-hover border-t-4 border-t-indigo-500"
                  >
                    <div>
                      {/* Status Badges */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {mat.status === 'waiting' ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600" />
                              Waiting
                            </span>
                          ) : mat.status === 'processing' || mat.status === 'indexing_vectors' ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
                              <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
                              Processing
                            </span>
                          ) : mat.status === 'failed' || mat.status === 'error' ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              Failed
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Indexed ({mat.chunkCount} chunks)
                            </span>
                          )}

                          {isPdf && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              PDF
                            </span>
                          )}
                          {isDoc && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                              WORD
                            </span>
                          )}
                          {isPpt && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-100 text-orange-800 border border-orange-200">
                              PPTX
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleFavorite(mat)}
                            className={`p-1 rounded-md transition cursor-pointer ${
                              mat.isFavorite
                                ? 'text-amber-500 bg-amber-50'
                                : 'text-slate-300 hover:text-amber-500 hover:bg-slate-100'
                            }`}
                            title={mat.isFavorite ? 'Starred core material' : 'Star as core material'}
                          >
                            <Star className={`w-3.5 h-3.5 ${mat.isFavorite ? 'fill-amber-500' : ''}`} />
                          </button>
                          <span className="text-[11px] text-slate-400">
                            {(mat.sizeBytes / 1024).toFixed(1)} KB
                          </span>
                        </div>
                      </div>

                      {/* Title & filename */}
                      <h4 className="text-sm font-bold text-slate-900 line-clamp-1 mb-0.5" title={mat.title}>
                        {mat.title}
                      </h4>
                      <p className="text-xs text-slate-500 flex items-center gap-1 font-mono mb-2">
                        <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{mat.filename}</span>
                      </p>

                      {/* Folder & chunks count */}
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 mb-2">
                        <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-medium">
                          📁 {folderObj ? folderObj.name : 'Root'}
                        </span>
                        <span>•</span>
                        <span>{mat.chunkCount} chunks</span>
                        <span>•</span>
                        <span>{mat.extractedTextLength.toLocaleString()} chars</span>
                      </div>

                      {/* Tags */}
                      {mat.tags && mat.tags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 mb-3">
                          {mat.tags.map((t) => (
                            <span
                              key={t}
                              className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium border border-slate-200"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Failed Status Error Details Box */}
                      {(mat.status === 'failed' || mat.status === 'error') && (
                        <div className="mb-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1.5">
                          <div className="flex items-center justify-between text-rose-800 font-bold text-[11px]">
                            <span className="flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              Processing Failed
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRetryProcessing(mat)}
                              className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold text-[10px] transition cursor-pointer flex items-center gap-1 shadow-2xs"
                            >
                              <RefreshCw className="w-2.5 h-2.5" />
                              Retry
                            </button>
                          </div>
                          <p className="text-[11px] text-rose-700 leading-relaxed font-mono">
                            {mat.statusMessage || 'Text extraction or semantic chunking encountered an error. Click Retry to re-process.'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Action Bar */}
                    <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          onClick={() => {
                            setSaveModalMaterial(mat);
                            setSaveModalQuestions(mat.generatedQuestions);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition flex items-center gap-1 cursor-pointer"
                          title="Save & Organize Options"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Save</span>
                        </button>

                        <button
                          onClick={() => {
                            setQaModalMaterial(mat);
                            setQaModalQuestions(mat.generatedQuestions || undefined);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition flex items-center gap-1 cursor-pointer"
                          title="AI Q&A from this document"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                          <span>AI Q&A</span>
                        </button>

                        {onNavigateToTutor && (
                          <button
                            onClick={() => onNavigateToTutor(mat.folderId)}
                            className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition flex items-center gap-1 cursor-pointer"
                            title="Ask AI Tutor"
                          >
                            <Bot className="w-3.5 h-3.5" />
                            <span>Tutor</span>
                          </button>
                        )}

                        {onLaunchQuizWithDocument && (
                          <button
                            onClick={() => onLaunchQuizWithDocument(mat.id)}
                            className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition flex items-center gap-1 cursor-pointer"
                            title="Exam Quiz"
                          >
                            <Cpu className="w-3.5 h-3.5 text-rose-600" />
                            <span>Quiz</span>
                          </button>
                        )}

                        <div className="relative">
                          <select
                            value={mat.folderId || 'null'}
                            onChange={(e) => {
                              const val = e.target.value === 'null' ? null : e.target.value;
                              handleMoveDocument(mat.id, val);
                            }}
                            className="text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border-0 rounded-lg px-2 py-1 cursor-pointer max-w-[110px] truncate"
                          >
                            <option value="null">Root</option>
                            {folders.map((f) => (
                              <option key={f.id} value={f.id}>
                                📁 {f.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <button
                          onClick={() => handleInspectChunks(mat)}
                          className="px-2 py-1 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition cursor-pointer"
                        >
                          Chunks ({mat.chunkCount})
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setMaterialToDelete(mat)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        title="Delete Document"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Multi-File Upload & Notes Staging */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 my-auto max-h-[92vh] flex flex-col animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Upload Course Study Materials</h3>
                  <p className="text-xs text-slate-500">
                    Stage files, assign folders & categories, and generate vector embeddings automatically.
                  </p>
                </div>
              </div>
              <button onClick={() => setShowUploadModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-100 py-3 shrink-0 text-xs">
              <button
                type="button"
                onClick={() => setUploadTab('file')}
                className={`font-bold px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  uploadTab === 'file' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <FileUp className="w-3.5 h-3.5" />
                <span>Upload Documents (PDF / Word / PPTX / Text)</span>
                {stagedFiles.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-white text-[10px] font-bold">
                    {stagedFiles.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setUploadTab('text')}
                className={`font-bold px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  uploadTab === 'text' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Paste Notes</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto py-4 space-y-4 flex-1 pr-1 text-xs">
              {uploadTab === 'file' ? (
                <div className="space-y-4">
                  {/* Dropzone */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      if (e.dataTransfer.files) handleFilesSelected(e.dataTransfer.files);
                    }}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center transition cursor-pointer ${
                      isDragOver ? 'border-indigo-600 bg-indigo-50/70' : 'border-slate-300 hover:border-indigo-500 bg-slate-50'
                    }`}
                  >
                    <input
                      type="file"
                      id="fileInput"
                      multiple
                      accept=".pdf,.docx,.doc,.pptx,.ppsx,.ppt,.txt,.md,.json"
                      onChange={(e) => {
                        if (e.target.files) handleFilesSelected(e.target.files);
                      }}
                      className="hidden"
                    />
                    <label htmlFor="fileInput" className="cursor-pointer block">
                      <UploadCloud className="w-10 h-10 text-indigo-600 mx-auto mb-2" />
                      <span className="font-bold text-slate-800 text-sm block">
                        {stagedFiles.length > 0
                          ? `+ Click or drag more files (${stagedFiles.length} currently staged)`
                          : 'Click to select or drag files here'}
                      </span>
                      <span className="text-[11px] text-slate-400 block mt-1">
                        PDF, Word (.docx), PowerPoint (.pptx), Markdown, Text (Up to 25MB each)
                      </span>
                    </label>
                  </div>

                  {/* Staged Queue */}
                  {stagedFiles.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <span className="font-bold text-slate-800">
                          Staged Files ({stagedFiles.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => setStagedFiles([])}
                          className="text-slate-400 hover:text-red-600 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          Clear All
                        </button>
                      </div>

                      <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                        {stagedFiles.map((f) => (
                          <div key={f.id} className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-slate-800 truncate block">{f.customTitle || f.name}</span>
                              <span className="text-[11px] text-slate-400 font-mono">{(f.size / 1024).toFixed(1)} KB</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <select
                                value={f.folderId || 'null'}
                                onChange={(e) => {
                                  const val = e.target.value === 'null' ? null : e.target.value;
                                  setStagedFiles((prev) => prev.map((item) => (item.id === f.id ? { ...item, folderId: val } : item)));
                                }}
                                className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
                              >
                                <option value="null">Root</option>
                                {folders.map((folder) => (
                                  <option key={folder.id} value={folder.id}>
                                    📁 {folder.name}
                                  </option>
                                ))}
                              </select>

                              <button
                                type="button"
                                onClick={() => setStagedFiles((prev) => prev.filter((item) => item.id !== f.id))}
                                className="p-1 text-slate-400 hover:text-red-600"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Notes Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Lecture 4: Attention Mechanisms"
                      value={pastedTitle}
                      onChange={(e) => setPastedTitle(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Lecture Content / Notes</label>
                    <textarea
                      rows={8}
                      placeholder="Paste your study notes, formulas, or summaries here…"
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Destination folder & options */}
              <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-3">
                <span className="font-bold text-indigo-950 block">Target Scope & Auto-Generation</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Target Folder</label>
                    <select
                      value={targetUploadFolderId || 'null'}
                      onChange={(e) => setTargetUploadFolderId(e.target.value === 'null' ? null : e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold"
                    >
                      <option value="null">Root (Unassigned)</option>
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>
                          📁 {f.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 pt-5">
                    <input
                      type="checkbox"
                      id="autoQA"
                      checked={uploadAutoGenerateQA}
                      onChange={(e) => setUploadAutoGenerateQA(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    <label htmlFor="autoQA" className="font-semibold text-slate-700 cursor-pointer">
                      Auto-generate assessment questions
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500">
                Scope: <strong>{activeCourse.code}</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={(e) => handleEnqueueUpload(e, 'materials')}
                  disabled={(uploadTab === 'file' && stagedFiles.length === 0) || (uploadTab === 'text' && !pastedText.trim())}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow transition disabled:opacity-50 cursor-pointer"
                >
                  Start Vector Indexing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Modal */}
      {saveModalMaterial && (
        <PostUploadSaveModal
          material={saveModalMaterial}
          folders={folders}
          questions={saveModalQuestions}
          onClose={() => setSaveModalMaterial(null)}
          onSave={async (updates) => {
            await api.updateMaterial(saveModalMaterial.id, updates);
            if (updates.folderId !== saveModalMaterial.folderId) {
              await api.moveMaterial(saveModalMaterial.id, updates.folderId);
            }
            await loadMaterials();
          }}
        />
      )}

      {/* Q&A Modal */}
      {qaModalMaterial && (
        <DocumentQAModal
          material={qaModalMaterial}
          initialQuestions={qaModalQuestions}
          onClose={() => setQaModalMaterial(null)}
          onLaunchQuizWithDocument={onLaunchQuizWithDocument}
        />
      )}

      {/* Create Folder Modal */}
      {showCreateFolderModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Add Isolated Study Folder</h3>
            <p className="text-xs text-slate-500 mb-4">Folders isolate document retrieval within {activeCourse.code}.</p>
            <form onSubmit={handleCreateFolderSubmit} className="space-y-4 text-xs">
              <input
                type="text"
                placeholder="Folder name (e.g. Week 1: Optimization Basics)"
                value={newCreatedFolderName}
                onChange={(e) => setNewCreatedFolderName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateFolderModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Folder Modal */}
      {folderToRename && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-2">Rename Folder</h3>
            <form onSubmit={handleRenameFolderSubmit} className="space-y-4 text-xs">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setFolderToRename(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Folder Modal */}
      {folderToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Delete Study Folder</h3>
            <p className="text-xs text-slate-500 mb-4">
              Documents inside "{folderToDelete.name}" can be preserved by reassigning them.
            </p>
            <form onSubmit={handleDeleteFolderSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Reassign documents to:</label>
                <select
                  value={reassignTargetFolderId || 'null'}
                  onChange={(e) => setReassignTargetFolderId(e.target.value === 'null' ? null : e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                >
                  <option value="null">Root (Unassigned)</option>
                  {folders
                    .filter((f) => f.id !== folderToDelete.id)
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        📁 {f.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setFolderToDelete(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow"
                >
                  Delete Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inspect Chunks Modal */}
      {inspectingMaterial && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Vector Chunks Inspection</h3>
                <p className="text-xs text-slate-500">{inspectingMaterial.title}</p>
              </div>
              <button onClick={() => setInspectingMaterial(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 flex-1 text-xs pr-1">
              {isLoadingChunks ? (
                <div className="py-12 text-center text-slate-400">Loading chunks…</div>
              ) : materialChunks.length === 0 ? (
                <div className="py-12 text-center text-slate-400">No chunks indexed.</div>
              ) : (
                materialChunks.map((chunk, cIdx) => (
                  <div key={chunk.chunkId || cIdx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between font-mono text-[11px] text-slate-500">
                      <span className="font-bold text-indigo-700">Chunk #{chunk.chunkIndex + 1}</span>
                      <span>Page/Slide {chunk.pageOrSlide} • ~{chunk.tokenEstimate} tokens</span>
                    </div>
                    <p className="text-slate-800 font-sans leading-relaxed">{chunk.text}</p>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setInspectingMaterial(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal: Confirm Delete Material */}
      {materialToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Remove Document?</h3>
                <p className="text-xs text-slate-500 truncate max-w-xs">{materialToDelete.filename}</p>
              </div>
            </div>

            <div className="p-3.5 bg-red-50/70 border border-red-200 rounded-xl text-xs text-red-900 space-y-2">
              <p className="font-semibold">
                This operation will clean up all database and vector storage records:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-red-800">
                <li>Permanently purges <strong>{materialToDelete.filename}</strong> ({materialToDelete.extractedTextLength.toLocaleString()} characters).</li>
                <li>Deletes all <strong>{materialToDelete.chunkCount} vector chunks</strong> from semantic retrieval.</li>
                <li>Future tutor queries and quizzes will no longer reference this document.</li>
              </ul>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 text-xs">
              <button
                type="button"
                disabled={isDeletingMaterial}
                onClick={() => setMaterialToDelete(null)}
                className="px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingMaterial}
                onClick={handleConfirmDeleteMaterial}
                className="px-4 py-2 font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow transition cursor-pointer flex items-center gap-1.5"
              >
                {isDeletingMaterial ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting…</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Course */}
      {showEditCourseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Edit Course Details</h3>
              </div>
              <button
                onClick={() => setShowEditCourseModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateCourseSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Course Code</label>
                <input
                  type="text"
                  required
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  placeholder="e.g. CS101, BIO320"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Course Title</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="e.g. Molecular Cell Biology"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Course topics, exam schedules, syllabus outline…"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditCourseModal(false)}
                  className="px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingCourse}
                  className="px-4 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow cursor-pointer flex items-center gap-1.5"
                >
                  {isUpdatingCourse ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving…</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Course with cascade warning and confirmation */}
      {showDeleteCourseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 border border-red-200">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Course: {activeCourse.code}?</h3>
                <p className="text-xs text-slate-500">Irreversible Action</p>
              </div>
            </div>

            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 space-y-2">
              <p className="font-bold">
                ⚠️ Warning: Deleting this course permanently deletes all associated data:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-red-800">
                <li>All <strong>{folders.length} study folders</strong> and folder structures</li>
                <li>All <strong>{materials.length} uploaded files</strong>, documents, and notes</li>
                <li>All <strong>indexed vector chunks</strong> and AI embeddings</li>
                <li>All student study progress, quiz history, and tutor messages</li>
              </ul>
              <p className="text-[11px] font-semibold text-red-950 pt-1">
                To prevent accidental deletion, type <code className="bg-white px-1.5 py-0.5 rounded border border-red-300 font-bold text-red-700">{activeCourse.code}</code> below:
              </p>
            </div>

            <form onSubmit={handleDeleteCourseSubmit} className="space-y-3 text-xs">
              <div>
                <input
                  type="text"
                  required
                  placeholder={`Type "${activeCourse.code}" to confirm`}
                  value={deleteCourseConfirmText}
                  onChange={(e) => setDeleteCourseConfirmText(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isDeletingCourse}
                  onClick={() => setShowDeleteCourseModal(false)}
                  className="px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isDeletingCourse ||
                    (deleteCourseConfirmText.trim().toLowerCase() !== activeCourse.code.trim().toLowerCase() &&
                     deleteCourseConfirmText.trim().toLowerCase() !== activeCourse.title.trim().toLowerCase())
                  }
                  className="px-4 py-2 font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 rounded-xl shadow cursor-pointer flex items-center gap-1.5"
                >
                  {isDeletingCourse ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting Course…</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Permanently Delete Course</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Course */}
      {onCreateCourse && (
        <CreateCourseModal
          isOpen={showLocalCreateCourseModal}
          onClose={() => setShowLocalCreateCourseModal(false)}
          onCreateCourse={onCreateCourse}
        />
      )}
    </div>
  );
};
