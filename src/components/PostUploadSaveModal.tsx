import React, { useState } from 'react';
import {
  Folder,
  Save,
  Tag,
  X,
} from 'lucide-react';
import { Folder as FolderType, Material, QuizQuestion } from '../types';

interface PostUploadSaveModalProps {
  material: Material | null;
  folders: FolderType[];
  questions?: QuizQuestion[];
  onClose: () => void;
  onSave: (updates: { title: string; folderId: string | null; tags: string[]; notes: string }) => Promise<void>;
}

export const PostUploadSaveModal: React.FC<PostUploadSaveModalProps> = ({
  material,
  folders,
  onClose,
  onSave,
}) => {
  if (!material) return null;

  const [title, setTitle] = useState(material.title);
  const [folderId, setFolderId] = useState<string | null>(material.folderId);
  const [tagsStr, setTagsStr] = useState((material.tags || []).join(', '));
  const [notes, setNotes] = useState(material.notes || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const tags = tagsStr
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await onSave({ title: title.trim(), folderId, tags, notes: notes.trim() });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
              <Save className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">Save & Organize Document</h3>
              <p className="text-xs text-slate-500">Edit metadata, tags, notes, and destination folder</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs sm:text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Document Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Destination Study Folder</label>
            <select
              value={folderId || 'null'}
              onChange={(e) => setFolderId(e.target.value === 'null' ? null : e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
            >
              <option value="null">Root (Unassigned)</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  📁 {f.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tags (Comma-separated)</label>
            <input
              type="text"
              placeholder="e.g. Attention, Transformers, Midterm"
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Study Notes / Synopsis</label>
            <textarea
              rows={3}
              placeholder="Key concepts, formulas, or reminders for this document…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow transition cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
