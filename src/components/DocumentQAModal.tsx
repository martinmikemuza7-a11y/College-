import React, { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Cpu,
  FileText,
  HelpCircle,
  Play,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { Material, QuizQuestion } from '../types';

interface DocumentQAModalProps {
  material: Material | null;
  initialQuestions?: QuizQuestion[];
  onClose: () => void;
  onLaunchQuizWithDocument?: (docId: string) => void;
}

export const DocumentQAModal: React.FC<DocumentQAModalProps> = ({
  material,
  initialQuestions,
  onClose,
  onLaunchQuizWithDocument,
}) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>(initialQuestions || []);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [revealedAnswers, setRevealedAnswers] = useState<Record<number, boolean>>({});

  if (!material) return null;

  const handleGenerateQuestions = async () => {
    setIsGenerating(true);
    try {
      const res = await api.generateQuiz({
        courseId: material.courseId,
        folderId: material.folderId,
        selectedDocumentIds: [material.id],
        questionCount: 4,
      });
      setQuestions(res.questions || []);
      setRevealedAnswers({});
      setActiveQuestionIdx(0);
    } catch (err) {
      console.warn('Failed to generate document Q&A:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleReveal = (idx: number) => {
    setRevealedAnswers((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[88vh] overflow-hidden shadow-2xl border border-slate-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                Document AI Q&A & Key Insights
              </h3>
              <p className="text-xs text-slate-500 truncate max-w-md">
                {material.title} ({material.filename})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/50 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs sm:text-sm">
          {questions.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-3">
              <HelpCircle className="w-10 h-10 text-slate-300 mx-auto" />
              <h4 className="font-bold text-slate-800 text-sm">No Q&A Generated Yet</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Generate high-yield study questions and verified exemplar answers directly from this document's text chunks.
              </p>
              <button
                onClick={handleGenerateQuestions}
                disabled={isGenerating}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow transition flex items-center gap-2 mx-auto cursor-pointer disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Analyzing Chunks & Generating…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Document Questions
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  {questions.length} Grounded Study Questions
                </span>
                <button
                  onClick={handleGenerateQuestions}
                  disabled={isGenerating}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />
                  Regenerate
                </button>
              </div>

              <div className="space-y-3">
                {questions.map((q, idx) => (
                  <div key={q.id || idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                        Q{idx + 1} • {q.type.replace('_', ' ')}
                      </span>
                      <span className="text-slate-400 font-medium capitalize">{q.difficulty}</span>
                    </div>

                    <p className="text-sm font-semibold text-slate-800 leading-snug">{q.question}</p>

                    {q.options && q.options.length > 0 && (
                      <div className="space-y-1 pl-2 text-xs text-slate-600">
                        {q.options.map((opt, oIdx) => (
                          <div key={oIdx} className="p-1.5 rounded bg-white border border-slate-200">
                            {opt}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="pt-2">
                      <button
                        onClick={() => toggleReveal(idx)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                      >
                        {revealedAnswers[idx] ? 'Hide Answer & Explanation' : 'Reveal Verified Answer'}
                      </button>

                      {revealedAnswers[idx] && (
                        <div className="mt-2 p-3 bg-white border border-emerald-200 rounded-xl space-y-1.5 animate-in fade-in">
                          <span className="text-[11px] font-bold text-emerald-800 uppercase block">
                            Correct Answer:
                          </span>
                          <p className="text-xs font-semibold text-slate-900">{q.correctAnswer}</p>
                          <p className="text-xs text-slate-600 leading-relaxed">{q.explanation}</p>
                          {q.sampleAnswer && (
                            <p className="text-xs text-slate-500 italic mt-1 border-t border-slate-100 pt-1">
                              Exemplar: "{q.sampleAnswer}"
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          {onLaunchQuizWithDocument && (
            <button
              onClick={() => {
                onClose();
                onLaunchQuizWithDocument(material.id);
              }}
              className="px-4 py-2 bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-xl text-xs font-bold shadow hover:opacity-90 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Cpu className="w-3.5 h-3.5" />
              Launch Active Exam Practice
            </button>
          )}

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition ml-auto cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
