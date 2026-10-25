import React, { useState } from 'react';
import { BookOpen, Check, Loader2, Sparkles, X } from 'lucide-react';
import { Course } from '../types';

interface CreateCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateCourse: (data: {
    title: string;
    code: string;
    description: string;
    color: string;
  }) => Promise<Course | void> | void;
  onSuccess?: (course: Course) => void;
}

const PRESET_COLORS = [
  { hex: '#4F46E5', name: 'Indigo' },
  { hex: '#0D9488', name: 'Teal' },
  { hex: '#8B5CF6', name: 'Purple' },
  { hex: '#F59E0B', name: 'Amber' },
  { hex: '#EC4899', name: 'Pink' },
  { hex: '#3B82F6', name: 'Blue' },
  { hex: '#10B981', name: 'Emerald' },
  { hex: '#EF4444', name: 'Crimson' },
];

const PRESET_TEMPLATES = [
  { code: 'CS-224N', title: 'Deep Learning for NLP', color: '#4F46E5', desc: 'Neural architectures, transformers, and representation learning.' },
  { code: 'BIO-101', title: 'Molecular & Cell Biology', color: '#0D9488', desc: 'Genetics, cellular respiration, and molecular pathways.' },
  { code: 'MATH-251', title: 'Multivariable Calculus & Linear Algebra', color: '#3B82F6', desc: 'Vector spaces, matrices, eigenvalues, and gradient fields.' },
  { code: 'ECON-102', title: 'Principles of Macroeconomics', color: '#F59E0B', desc: 'Fiscal policy, monetary systems, GDP growth, and inflation.' },
];

export const CreateCourseModal: React.FC<CreateCourseModalProps> = ({
  isOpen,
  onClose,
  onCreateCourse,
  onSuccess,
}) => {
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#4F46E5');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    const cleanTitle = title.trim();

    if (!cleanCode) {
      setErrorMessage('Please enter a course code (e.g., CS-101 or BIO-200).');
      return;
    }
    if (!cleanTitle) {
      setErrorMessage('Please enter a course title.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const created = await onCreateCourse({
        code: cleanCode,
        title: cleanTitle,
        description: description.trim(),
        color,
      });

      // Reset form
      setCode('');
      setTitle('');
      setDescription('');
      setColor('#4F46E5');

      if (created && onSuccess) {
        onSuccess(created);
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg || 'Failed to create course. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplyTemplate = (tpl: typeof PRESET_TEMPLATES[0]) => {
    setCode(tpl.code);
    setTitle(tpl.title);
    setDescription(tpl.desc);
    setColor(tpl.color);
    setErrorMessage(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 text-slate-800 space-y-5 my-8">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl text-white flex items-center justify-center shadow-xs shrink-0"
              style={{ backgroundColor: color }}
            >
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Create New Course
              </h2>
              <p className="text-xs text-slate-500">
                Isolated workspace for your notes, slides, and RAG embeddings.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Starter Templates */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>Quick Start Templates</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {PRESET_TEMPLATES.map((tpl) => (
              <button
                key={tpl.code}
                type="button"
                onClick={() => handleApplyTemplate(tpl)}
                disabled={isSubmitting}
                className="text-left p-2 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-indigo-50 hover:border-indigo-200 transition group cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: tpl.color }}
                  />
                  <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 truncate">
                    {tpl.code}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 truncate mt-0.5">
                  {tpl.title}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between animate-in fade-in">
            <span>{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-500 hover:text-rose-700 font-bold ml-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Main Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Course Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. CS-224N"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  if (errorMessage) setErrorMessage(null);
                }}
                disabled={isSubmitting}
                className="w-full uppercase font-bold text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition disabled:opacity-60"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Course Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Natural Language Processing with Deep Learning"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                disabled={isSubmitting}
                className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition disabled:opacity-60"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Key topics, syllabus highlights, professor notes, and exam dates…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition resize-none disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Course Accent Color
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_COLORS.map((c) => {
                const isSelected = color.toLowerCase() === c.hex.toLowerCase();
                return (
                  <button
                    type="button"
                    key={c.hex}
                    onClick={() => setColor(c.hex)}
                    disabled={isSubmitting}
                    title={c.name}
                    className={`w-7 h-7 rounded-full transition flex items-center justify-center cursor-pointer disabled:opacity-60 ${
                      isSelected
                        ? 'ring-2 ring-offset-2 ring-slate-800 scale-110 shadow-sm'
                        : 'hover:scale-105 border border-white shadow-2xs'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !code.trim() || !title.trim()}
              className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating Course…</span>
                </>
              ) : (
                <span>Create Course</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
