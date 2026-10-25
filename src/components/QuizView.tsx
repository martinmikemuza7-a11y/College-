import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Award,
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  Download,
  Eye,
  EyeOff,
  FileCheck,
  FileText,
  Filter,
  Flame,
  Folder as FolderIcon,
  GraduationCap,
  HelpCircle,
  Layers,
  ListChecks,
  Play,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Share2,
  ShieldCheck,
  Sparkles,
  Timer,
  Upload,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { Course, Folder, Material, PastPaper, QuestionType, QuizQuestion, UserProgress } from '../types';
import { VectorSyncIndicator } from './VectorSyncIndicator';

interface QuizViewProps {
  activeCourse: Course | null;
  courses?: Course[];
  folders: Folder[];
  activeFolderId: string | null | 'all';
  initialPastPaperId?: string | null;
  initialDocumentId?: string | null;
  onOpenCreateCourseModal?: () => void;
  onNavigateToMaterials?: () => void;
  onNavigateToPastPapers?: () => void;
}

export const QuizView: React.FC<QuizViewProps> = ({
  activeCourse,
  courses = [],
  folders,
  activeFolderId,
  initialPastPaperId,
  initialDocumentId,
  onOpenCreateCourseModal,
  onNavigateToMaterials,
  onNavigateToPastPapers,
}) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Generation Mode: 'past_paper' uses past papers for question structure & notes for factual answers
  // 'notes_based' generates questions directly from course notes
  const [generationMode, setGenerationMode] = useState<'past_paper' | 'notes_based'>(
    initialPastPaperId ? 'past_paper' : 'past_paper'
  );

  // View Layout: 'sheet' displays all questions first without answers (Requirement 3)
  // 'interactive' allows step-by-step drilling
  const [viewLayout, setViewLayout] = useState<'sheet' | 'interactive'>('sheet');
  const [showAnswerKey, setShowAnswerKey] = useState(false);

  // Student inputs across all questions in the sheet: questionId -> answer string
  const [sheetAnswers, setSheetAnswers] = useState<Record<string, string>>({});

  // Single-question interactive states
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [shortAnswerInput, setShortAnswerInput] = useState('');
  const [fillInBlankInput, setFillInBlankInput] = useState('');
  const [essayInput, setEssayInput] = useState('');
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [isCurrentAnswerCorrect, setIsCurrentAnswerCorrect] = useState<boolean | null>(null);

  // Generator & continuation states
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<string | null>(null);
  const [hasMoreContinuation, setHasMoreContinuation] = useState(false);
  const [batchContinuationIndex, setBatchContinuationIndex] = useState(0);
  const [missedQuestions, setMissedQuestions] = useState<QuizQuestion[]>([]);
  const [isSavedForRevision, setIsSavedForRevision] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [savedRevisions, setSavedRevisions] = useState<any[]>([]);

  // Assessment Configuration
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [questionCount, setQuestionCount] = useState(5);
  const [topicFocus, setTopicFocus] = useState('');
  const [selectedQuestionType, setSelectedQuestionType] = useState<'all' | QuestionType>('all');
  const [questionStyle, setQuestionStyle] = useState<'all' | 'definitions' | 'explanations' | 'comparisons' | 'applied'>('all');
  const [isMockExam, setIsMockExam] = useState(false);
  const [mockExamDuration, setMockExamDuration] = useState(30);
  const [mockTimeRemaining, setMockTimeRemaining] = useState<number | null>(null);

  // Target Source Selection (Multi-select documents & past papers)
  const [materialsList, setMaterialsList] = useState<Material[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>(
    initialDocumentId ? [initialDocumentId] : []
  );

  const [availablePastPapers, setAvailablePastPapers] = useState<PastPaper[]>([]);
  const [selectedPastPaperIds, setSelectedPastPaperIds] = useState<string[]>(
    initialPastPaperId ? [initialPastPaperId] : []
  );

  // Explicit Cross-Course Multi-Select (Course Isolation enforcement)
  const [enableCrossCourse, setEnableCrossCourse] = useState(false);
  const [selectedCrossCourseIds, setSelectedCrossCourseIds] = useState<string[]>([]);

  // Stats & Progress
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [coverageData, setCoverageData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCoverageModal, setShowCoverageModal] = useState(false);
  const [showExamFinishedModal, setShowExamFinishedModal] = useState(false);

  const [examResults, setExamResults] = useState<{
    correctCount: number;
    totalCount: number;
    marksObtained: number;
    totalMarks: number;
  }>({ correctCount: 0, totalCount: 0, marksObtained: 0, totalMarks: 0 });

  useEffect(() => {
    if (!activeCourse) return;
    loadProgress();
    loadCoverage();
    loadPastPapers();
    loadMaterials();
    loadSavedRevisions();
  }, [activeCourse?.id, activeFolderId]);

  useEffect(() => {
    if (initialPastPaperId) {
      setSelectedPastPaperIds([initialPastPaperId]);
      setGenerationMode('past_paper');
      setIsMockExam(true);
    }
  }, [initialPastPaperId]);

  useEffect(() => {
    if (initialDocumentId) {
      setSelectedDocumentIds([initialDocumentId]);
    }
  }, [initialDocumentId]);

  // Mock Exam Timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isMockExam && mockTimeRemaining !== null && mockTimeRemaining > 0 && !showExamFinishedModal) {
      interval = setInterval(() => {
        setMockTimeRemaining((prev) => {
          if (prev !== null && prev <= 1) {
            setShowExamFinishedModal(true);
            return 0;
          }
          return prev !== null ? prev - 1 : null;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isMockExam, mockTimeRemaining, showExamFinishedModal]);

  const loadProgress = async () => {
    if (!activeCourse) return;
    try {
      const res = await api.getProgress(activeCourse.id);
      setProgress(res.progress);
    } catch (err) {
      console.warn('Failed to load progress:', err);
    }
  };

  const loadCoverage = async () => {
    if (!activeCourse) return;
    try {
      const res = await api.getCoverage(activeCourse.id, activeFolderId);
      setCoverageData(res);
    } catch (err) {
      console.warn('Failed to load coverage:', err);
    }
  };

  const loadPastPapers = async () => {
    if (!activeCourse) return;
    try {
      const res = await api.getPastPapers(activeCourse.id, activeFolderId);
      const papers = res.pastPapers || [];
      setAvailablePastPapers(papers);
      if (papers.length === 0 && !initialPastPaperId) {
        // If no past papers exist, default to notes-based mode
        setGenerationMode('notes_based');
      }
    } catch (err) {
      console.warn('Failed to load past papers:', err);
    }
  };

  const loadMaterials = async () => {
    if (!activeCourse) return;
    try {
      const res = await api.getMaterials(activeCourse.id, activeFolderId);
      setMaterialsList(res.materials || []);
    } catch (err) {
      console.warn('Failed to load materials:', err);
    }
  };

  const loadSavedRevisions = () => {
    if (!activeCourse) return;
    try {
      const key = `study_buddy_revisions_${activeCourse.id}`;
      const saved = JSON.parse(localStorage.getItem(key) || '[]');
      setSavedRevisions(saved);
    } catch (e) {
      console.warn('Failed to parse revisions:', e);
    }
  };

  const handleGenerateQuiz = async () => {
    if (!activeCourse || isGenerating) return;

    // Guardrail: Check for required materials based on mode
    if (generationMode === 'past_paper') {
      if (availablePastPapers.length === 0) {
        setErrorMessage(
          `No past examination papers are uploaded for ${activeCourse.code}. Please upload past exam papers in the "Past Papers" section, or switch to "Notes-Based Practice" mode below.`
        );
        return;
      }
      if (materialsList.length === 0) {
        setErrorMessage(
          `No course notes or lecture documents are available for ${activeCourse.code}. Past Paper Practice requires course documents to provide verified factual answers. Please upload your lecture notes or slides first.`
        );
        return;
      }
    } else {
      if (materialsList.length === 0) {
        setErrorMessage(
          `No study notes or documents found in this course. Please upload lecture notes or slides to generate practice questions.`
        );
        return;
      }
    }

    setIsGenerating(true);
    setGenerationProgress(
      generationMode === 'past_paper'
        ? 'Calibrating question styles from past papers and grounding answers in course notes…'
        : 'Synthesizing practice questions directly from course lecture notes…'
    );
    setErrorMessage(null);
    setQuestions([]);
    setCurrentIndex(0);
    setSheetAnswers({});
    setShowAnswerKey(false);
    resetQuestionInputStates();
    setShowExamFinishedModal(false);
    setMissedQuestions([]);
    setIsCurrentAnswerCorrect(null);

    const typesToRequest = selectedQuestionType === 'all' ? undefined : [selectedQuestionType];
    const targetCount = questionCount;
    let accumulated: QuizQuestion[] = [];
    let currentBatchIndex = 0;
    let moreAvailable = true;

    try {
      while (accumulated.length < targetCount && moreAvailable) {
        const remainingToFetch = targetCount - accumulated.length;
        const countForThisBatch = Math.min(5, remainingToFetch);

        setGenerationProgress(
          accumulated.length > 0
            ? `Generating grounded questions in batches (${accumulated.length} of ${targetCount} ready)…`
            : generationMode === 'past_paper'
            ? 'Styling questions from past exams and retrieving verified answers from notes…'
            : 'Synthesizing verified questions from course notes and slides…'
        );

        const res = await api.generateQuiz({
          courseId: activeCourse.id,
          folderId: activeFolderId,
          mode: generationMode,
          selectedDocumentIds: selectedDocumentIds.length > 0 ? selectedDocumentIds : undefined,
          pastPaperIds:
            generationMode === 'past_paper'
              ? selectedPastPaperIds.length > 0
                ? selectedPastPaperIds
                : availablePastPapers.map((p) => p.id)
              : undefined,
          crossCourseIds: enableCrossCourse && selectedCrossCourseIds.length > 0 ? selectedCrossCourseIds : undefined,
          questionCount: countForThisBatch,
          batchIndex: currentBatchIndex,
          difficulty,
          questionTypes: typesToRequest,
          questionStyle: questionStyle === 'all' ? undefined : questionStyle,
          topic: topicFocus.trim() || undefined,
          isMockExam,
        });

        if (!res.questions || res.questions.length === 0) {
          moreAvailable = false;
          break;
        }

        accumulated = [...accumulated, ...res.questions];
        setQuestions([...accumulated]);
        currentBatchIndex++;
        moreAvailable = !!res.hasMore;

        if (accumulated.length >= targetCount) break;
      }

      setHasMoreContinuation(moreAvailable);
      setBatchContinuationIndex(currentBatchIndex);

      if (accumulated.length > 0) {
        if (isMockExam) {
          setMockTimeRemaining(mockExamDuration * 60);
          const totalMarks = accumulated.reduce((sum, q) => sum + (q.allocatedMarks || 2), 0);
          setExamResults({ correctCount: 0, totalCount: accumulated.length, marksObtained: 0, totalMarks });
        }
      } else {
        setErrorMessage(
          'No questions could be generated. Ensure documents in this course contain readable text passages.'
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsGenerating(false);
      setGenerationProgress(null);
      loadCoverage();
    }
  };

  const handleLoadMoreQuestions = async () => {
    if (!activeCourse || isGenerating) return;
    setIsGenerating(true);
    setGenerationProgress('Synthesizing additional questions from remaining course passages…');
    const typesToRequest = selectedQuestionType === 'all' ? undefined : [selectedQuestionType];

    try {
      const res = await api.generateQuiz({
        courseId: activeCourse.id,
        folderId: activeFolderId,
        mode: generationMode,
        selectedDocumentIds: selectedDocumentIds.length > 0 ? selectedDocumentIds : undefined,
        pastPaperIds:
          generationMode === 'past_paper'
            ? selectedPastPaperIds.length > 0
              ? selectedPastPaperIds
              : availablePastPapers.map((p) => p.id)
            : undefined,
        crossCourseIds: enableCrossCourse && selectedCrossCourseIds.length > 0 ? selectedCrossCourseIds : undefined,
        questionCount: 5,
        batchIndex: batchContinuationIndex,
        difficulty,
        questionTypes: typesToRequest,
        questionStyle: questionStyle === 'all' ? undefined : questionStyle,
        topic: topicFocus.trim() || undefined,
        isMockExam,
      });

      if (res.questions && res.questions.length > 0) {
        setQuestions((prev) => [...prev, ...res.questions]);
        setBatchContinuationIndex((prev) => prev + 1);
        setHasMoreContinuation(!!res.hasMore);
      } else {
        setHasMoreContinuation(false);
      }
    } catch (err) {
      console.warn('Continuation error:', err);
    } finally {
      setIsGenerating(false);
      setGenerationProgress(null);
    }
  };

  const resetQuestionInputStates = () => {
    setSelectedAnswer(null);
    setShortAnswerInput('');
    setFillInBlankInput('');
    setEssayInput('');
    setIsAnswerSubmitted(false);
    setIsCurrentAnswerCorrect(null);
  };

  // Handler for answering questions on the Examination Sheet
  const handleSetSheetAnswer = (questionId: string, answer: string) => {
    setSheetAnswers((prev) => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  // Interactive single-question submit
  const handleSubmitInteractiveAnswer = async () => {
    if (!activeCourse || !currentQuestion || isAnswerSubmitted) return;

    let isCorrect = false;
    let studentAns = '';

    if (currentQuestion.type === 'multiple_choice' || currentQuestion.type === 'true_false') {
      studentAns = selectedAnswer || '';
      isCorrect = studentAns.trim().toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase();
    } else if (currentQuestion.type === 'fill_in_blank') {
      studentAns = fillInBlankInput.trim();
      const acceptable = [currentQuestion.correctAnswer, ...(currentQuestion.acceptableAnswers || [])];
      isCorrect = acceptable.some((ans) => ans.trim().toLowerCase() === studentAns.toLowerCase());
    } else if (currentQuestion.type === 'short_answer') {
      studentAns = shortAnswerInput.trim();
      isCorrect = studentAns.length >= 15;
    } else if (currentQuestion.type === 'short_essay') {
      studentAns = essayInput.trim();
      isCorrect = studentAns.length >= 40;
    }

    setIsAnswerSubmitted(true);
    setIsCurrentAnswerCorrect(isCorrect);

    if (!isCorrect) {
      setMissedQuestions((prev) => {
        if (!prev.some((q) => q.id === currentQuestion.id)) {
          return [...prev, currentQuestion];
        }
        return prev;
      });
    }

    try {
      const res = await api.recordQuizAnswer({
        courseId: activeCourse.id,
        isCorrect,
        topic: topicFocus || currentQuestion.topic || 'Active Recall',
      });
      setProgress(res.progress);
    } catch (err) {
      console.warn('Failed to record answer:', err);
    }
  };

  const handleSaveResultsForRevision = () => {
    if (!activeCourse || questions.length === 0) return;
    const revisionSession = {
      id: `rev_${Date.now()}`,
      date: new Date().toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      courseCode: activeCourse.code,
      courseTitle: activeCourse.title,
      mode: generationMode,
      totalQuestions: questions.length,
      correctCount: examResults.correctCount,
      accuracy: Math.round((examResults.correctCount / (questions.length || 1)) * 100),
      questions,
      sheetAnswers,
    };

    const key = `study_buddy_revisions_${activeCourse.id}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    existing.unshift(revisionSession);
    const updated = existing.slice(0, 30);
    localStorage.setItem(key, JSON.stringify(updated));
    setSavedRevisions(updated);
    setIsSavedForRevision(true);
    setTimeout(() => setIsSavedForRevision(false), 3000);
  };

  const handlePrintExam = () => {
    window.print();
  };

  const currentQuestion = questions[currentIndex];
  const activeFolderName =
    activeFolderId === 'all'
      ? 'All Course Folders'
      : activeFolderId === null
      ? 'Root (Unassigned)'
      : folders.find((f) => f.id === activeFolderId)?.name || 'Selected Folder';

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const totalMarks = questions.reduce((sum, q) => sum + (q.allocatedMarks || 2), 0);
  const answeredCount = Object.keys(sheetAnswers).filter((k) => sheetAnswers[k]?.trim()).length;

  const accuracy =
    progress && progress.totalQuestionsAnswered > 0
      ? Math.round((progress.correctAnswers / progress.totalQuestionsAnswered) * 100)
      : 0;

  if (!activeCourse) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center animate-in fade-in">
        <div className="sb-card p-10 space-y-4 border-rose-100 shadow-sm">
          <GraduationCap className="w-12 h-12 text-rose-400 mx-auto mb-2" />
          <h2 className="text-xl font-bold text-slate-800">Select or Create a Course for Exam Practice</h2>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            Choose an existing course or create a new one to generate grounded mock exams and recall tests.
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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* 1. View Header with Progress & Course Scope */}
      <div className="sb-card p-6 border-t-4 border-t-rose-500 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Examination Preparation Agent
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-rose-50 text-rose-700 border border-rose-200">
              {activeCourse.code}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl leading-relaxed">
            Intelligent, dual-source exam engine. Past papers govern question styles and structure; verified course notes provide the factual answers and citations.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2 flex items-center gap-2.5">
            <Flame className="w-5 h-5 text-amber-500" />
            <div>
              <span className="text-[10px] font-bold text-amber-800 uppercase block leading-none">Streak</span>
              <span className="text-sm font-bold text-amber-900">{progress?.streakDays || 1} day(s)</span>
            </div>
          </div>

          <div className="bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2 flex items-center gap-2.5">
            <Award className="w-5 h-5 text-rose-500" />
            <div>
              <span className="text-[10px] font-bold text-rose-800 uppercase block leading-none">Accuracy</span>
              <span className="text-sm font-bold text-rose-900">{accuracy}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Course Isolation & Strict Scope Verification Notice */}
      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            <strong>Course Isolation Active:</strong> Sourcing strictly from{' '}
            <strong className="text-slate-900">{activeCourse.title} ({activeCourse.code})</strong>.
            Materials from other courses are isolated.
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-slate-400 font-medium">
            {materialsList.length} notes • {availablePastPapers.length} past papers
          </span>
          <VectorSyncIndicator
            activeCourse={activeCourse}
            activeFolderId={activeFolderId}
            folders={folders}
          />
        </div>
      </div>

      {/* 3. Examination Configuration & Source Selection Card */}
      <div className="sb-card p-6 space-y-5">
        {/* Step A: Choose Generation Mode */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
            Select Question-Generation Mode
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Mode 1: Past Paper Practice */}
            <button
              type="button"
              onClick={() => setGenerationMode('past_paper')}
              className={`p-4 rounded-xl border text-left transition cursor-pointer relative ${
                generationMode === 'past_paper'
                  ? 'border-indigo-600 bg-indigo-50/80 shadow-2xs ring-1 ring-indigo-500'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                  <FileCheck className={`w-4 h-4 ${generationMode === 'past_paper' ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span>Past Paper Practice</span>
                </div>
                {generationMode === 'past_paper' && (
                  <span className="w-2 h-2 rounded-full bg-indigo-600" />
                )}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Uses uploaded <strong>past papers</strong> as the blueprint for question structure, format, and difficulty, with factual answers verified from your <strong>course notes</strong>.
              </p>
              <div className="mt-2 text-[11px] font-semibold text-indigo-700">
                {availablePastPapers.length} past exam paper(s) available in this course
              </div>
            </button>

            {/* Mode 2: Notes-Based Practice */}
            <button
              type="button"
              onClick={() => setGenerationMode('notes_based')}
              className={`p-4 rounded-xl border text-left transition cursor-pointer relative ${
                generationMode === 'notes_based'
                  ? 'border-rose-600 bg-rose-50/80 shadow-2xs ring-1 ring-rose-500'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                  <Brain className={`w-4 h-4 ${generationMode === 'notes_based' ? 'text-rose-600' : 'text-slate-400'}`} />
                  <span>Notes-Based Practice</span>
                </div>
                {generationMode === 'notes_based' && (
                  <span className="w-2 h-2 rounded-full bg-rose-600" />
                )}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Generates questions directly from selected lecture notes and slides. Perfect for active recall on recently studied topics and lectures.
              </p>
              <div className="mt-2 text-[11px] font-semibold text-rose-700">
                {materialsList.length} study note(s) & slide deck(s) available
              </div>
            </button>
          </div>
        </div>

        {/* Missing Source Warning Banners */}
        {generationMode === 'past_paper' && availablePastPapers.length === 0 && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                No past examination papers uploaded for <strong>{activeCourse.code}</strong> yet.
              </span>
            </div>
            {onNavigateToPastPapers && (
              <button
                type="button"
                onClick={onNavigateToPastPapers}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shrink-0 cursor-pointer transition text-xs"
              >
                Upload Past Paper
              </button>
            )}
          </div>
        )}

        {materialsList.length === 0 && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                No lecture notes or course slides uploaded for <strong>{activeCourse.code}</strong>. Course documents are required to supply verified factual answers.
              </span>
            </div>
            {onNavigateToMaterials && (
              <button
                type="button"
                onClick={onNavigateToMaterials}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shrink-0 cursor-pointer transition text-xs"
              >
                Upload Notes
              </button>
            )}
          </div>
        )}

        {/* Step B: Fine-Grained Source Selection (Checkboxes for Past Papers and Notes) */}
        <div className="pt-2 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
              {generationMode === 'past_paper' ? 'Select Past Paper & Notes Sources' : 'Select Notes Source Scope'}
            </span>
            <span className="text-[11px] text-slate-400">
              Only documents from {activeCourse.code} are included
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Past Papers Selector (in past_paper mode) */}
            {generationMode === 'past_paper' && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                    Past Exam Papers ({availablePastPapers.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedPastPaperIds.length === availablePastPapers.length) {
                        setSelectedPastPaperIds([]);
                      } else {
                        setSelectedPastPaperIds(availablePastPapers.map((p) => p.id));
                      }
                    }}
                    className="text-[11px] font-semibold text-indigo-600 hover:underline cursor-pointer"
                  >
                    {selectedPastPaperIds.length === availablePastPapers.length ? 'Clear All' : 'Select All'}
                  </button>
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                  {availablePastPapers.length === 0 ? (
                    <div className="text-slate-400 italic text-[11px] py-1">No past papers uploaded yet.</div>
                  ) : (
                    availablePastPapers.map((paper) => {
                      const isChecked = selectedPastPaperIds.length === 0 || selectedPastPaperIds.includes(paper.id);
                      return (
                        <label
                          key={paper.id}
                          className="flex items-center gap-2 p-1.5 rounded hover:bg-white text-slate-700 cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={selectedPastPaperIds.includes(paper.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPastPaperIds((prev) => [...prev, paper.id]);
                              } else {
                                setSelectedPastPaperIds((prev) => prev.filter((id) => id !== paper.id));
                              }
                            }}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                          <span className="truncate flex-1 font-medium">{paper.title}</span>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0">{paper.year || 'Exam'}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Course Notes Selector */}
            <div className={`p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 ${generationMode === 'notes_based' ? 'md:col-span-2' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-rose-600" />
                  Course Notes & Slides ({materialsList.length})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedDocumentIds.length === materialsList.length) {
                      setSelectedDocumentIds([]);
                    } else {
                      setSelectedDocumentIds(materialsList.map((m) => m.id));
                    }
                  }}
                  className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                >
                  {selectedDocumentIds.length === materialsList.length ? 'Clear All' : 'Select All'}
                </button>
              </div>

              <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                {materialsList.length === 0 ? (
                  <div className="text-slate-400 italic text-[11px] py-1">No course notes uploaded yet.</div>
                ) : (
                  materialsList.map((mat) => {
                    return (
                      <label
                        key={mat.id}
                        className="flex items-center gap-2 p-1.5 rounded hover:bg-white text-slate-700 cursor-pointer text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={selectedDocumentIds.includes(mat.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedDocumentIds((prev) => [...prev, mat.id]);
                            } else {
                              setSelectedDocumentIds((prev) => prev.filter((id) => id !== mat.id));
                            }
                          }}
                          className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                        />
                        <span className="truncate flex-1 font-medium">{mat.filename}</span>
                        <span className="text-[10px] text-slate-400 shrink-0">{mat.chunkCount || 0} chunks</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Step C: Assessment Controls (Types, Difficulty, Quantity) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs pt-2 border-t border-slate-100">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Question Type</label>
            <select
              value={selectedQuestionType}
              onChange={(e: any) => setSelectedQuestionType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium cursor-pointer"
            >
              <option value="all">All 5 Types (Balanced Exam Mix)</option>
              <option value="multiple_choice">Multiple Choice (MCQ)</option>
              <option value="true_false">True / False</option>
              <option value="fill_in_blank">Fill-in-the-Blank</option>
              <option value="short_answer">Short Answer</option>
              <option value="short_essay">Short Essay & Analysis</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Question Style Focus</label>
            <select
              value={questionStyle}
              onChange={(e: any) => setQuestionStyle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium cursor-pointer"
            >
              <option value="all">Standard Examination Mix</option>
              <option value="definitions">Definitions & Facts</option>
              <option value="explanations">Mechanisms & Explanations</option>
              <option value="comparisons">Comparative Analysis</option>
              <option value="applied">Applied Problem Solving</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Difficulty</label>
            <select
              value={difficulty}
              onChange={(e: any) => setDifficulty(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium cursor-pointer"
            >
              <option value="easy">Easy (Foundations & Recall)</option>
              <option value="medium">Medium (Analytical Application)</option>
              <option value="hard">Hard (Synthesis & Proofs)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Question Quantity</label>
            <select
              value={questionCount}
              onChange={(e) => setQuestionCount(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium cursor-pointer"
            >
              <option value={3}>3 Questions</option>
              <option value={5}>5 Questions</option>
              <option value={8}>8 Questions</option>
              <option value={10}>10 Questions</option>
              <option value={15}>15 Questions (Batched)</option>
              <option value={20}>20 Questions (Batched)</option>
              <option value={25}>25 Questions (Comprehensive)</option>
              <option value={30}>30 Questions (Full Paper Coverage)</option>
            </select>
          </div>
        </div>

        {/* Step D: Optional Topic Focus & Multi-Course Isolation Override */}
        <div className="space-y-3 pt-1">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <input
              type="text"
              placeholder="Optional topic focus (e.g. Attention Mechanisms, Mitochondria, Constitutional Law)…"
              value={topicFocus}
              onChange={(e) => setTopicFocus(e.target.value)}
              className="w-full sm:flex-1 px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none"
            />

            <button
              onClick={handleGenerateQuiz}
              disabled={isGenerating}
              className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Synthesizing Exam…</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>
                    {generationMode === 'past_paper'
                      ? `Generate Exam Practice (${questionCount} Questions)`
                      : `Generate Notes Quiz (${questionCount} Questions)`}
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Optional Multi-Course toggle */}
          {courses.length > 1 && (
            <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
              <input
                type="checkbox"
                id="crossCourseToggle"
                checked={enableCrossCourse}
                onChange={(e) => setEnableCrossCourse(e.target.checked)}
                className="rounded border-slate-300 text-rose-600 cursor-pointer"
              />
              <label htmlFor="crossCourseToggle" className="cursor-pointer">
                Explicitly permit cross-course reference materials (course isolation relaxed)
              </label>
            </div>
          )}

          {enableCrossCourse && courses.length > 1 && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3 flex-wrap text-xs">
              <span className="font-bold text-slate-700">Include Materials From:</span>
              {courses
                .filter((c) => c.id !== activeCourse.id)
                .map((c) => (
                  <label key={c.id} className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCrossCourseIds.includes(c.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCrossCourseIds((prev) => [...prev, c.id]);
                        } else {
                          setSelectedCrossCourseIds((prev) => prev.filter((id) => id !== c.id));
                        }
                      }}
                      className="rounded border-slate-300 text-rose-600 cursor-pointer"
                    />
                    <span>{c.code} ({c.title})</span>
                  </label>
                ))}
            </div>
          )}
        </div>

        {/* Error / Feedback Message */}
        {errorMessage && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start justify-between gap-3 animate-in fade-in">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-500 hover:text-rose-700 font-bold ml-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {generationProgress && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs flex items-center gap-2.5 text-rose-900 font-medium animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin text-rose-600 shrink-0" />
            <span>{generationProgress}</span>
          </div>
        )}
      </div>

      {/* 4. Active Examination Sheet / Practice Area */}
      {questions.length > 0 && (
        <div className="space-y-6">
          {/* Top Exam Sticky Action Toolbar */}
          <div className="sticky top-20 z-20 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-md flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap text-xs">
              <span className="font-bold text-slate-900 px-3 py-1 rounded-full bg-slate-100 border border-slate-200">
                {questions.length} Questions • {totalMarks} Marks
              </span>
              <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] ${
                generationMode === 'past_paper'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                {generationMode === 'past_paper' ? 'Past Paper Calibrated' : 'Notes-Based Practice'}
              </span>
              <span className="text-slate-500 font-medium">
                Answered {answeredCount} of {questions.length}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Layout Switcher: Sheet (All Questions First) vs Step-by-Step */}
              <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setViewLayout('sheet')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    viewLayout === 'sheet'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Exam Sheet (All Questions)
                </button>
                <button
                  type="button"
                  onClick={() => setViewLayout('interactive')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    viewLayout === 'interactive'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Step-by-Step Drill
                </button>
              </div>

              {/* Requirement 3: Separate "Show Answers" button that reveals the answer key afterward */}
              <button
                type="button"
                onClick={() => setShowAnswerKey(!showAnswerKey)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm ${
                  showAnswerKey
                    ? 'bg-slate-800 text-white hover:bg-slate-900'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'
                }`}
              >
                {showAnswerKey ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Hide Answer Key</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>Show Answers & Explanations</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handlePrintExam}
                className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
                title="Print or Export Examination Sheet"
              >
                <Printer className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleSaveResultsForRevision}
                className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
                title="Save session to Revision History"
              >
                <Save className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* VIEW LAYOUT A: Examination Sheet (All Questions First - Requirement 3) */}
          {viewLayout === 'sheet' && (
            <div className="space-y-6">
              {questions.map((q, idx) => {
                const studentAns = sheetAnswers[q.id] || '';
                const isAnswered = !!studentAns.trim();
                const isCorrect = studentAns.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();

                return (
                  <div
                    key={q.id}
                    className="sb-card p-6 border-slate-200 hover:border-slate-300 transition space-y-4 relative"
                  >
                    {/* Question Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-slate-900 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                          Question {idx + 1}
                        </span>
                        <span className="font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-md capitalize">
                          {q.type.replace('_', ' ')}
                        </span>
                        {q.allocatedMarks && (
                          <span className="font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                            {q.allocatedMarks} marks
                          </span>
                        )}
                        {q.mode === 'past_paper' && (
                          <span className="font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md text-[10px]">
                            Past Paper Calibrated
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-medium capitalize">
                          Difficulty: {q.difficulty}
                        </span>
                        {isAnswered && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500" title="Answer entered" />
                        )}
                      </div>
                    </div>

                    {/* Question Prompt */}
                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                      {q.question}
                    </h3>

                    {/* Student Input Options according to question type */}
                    <div className="space-y-3">
                      {q.type === 'multiple_choice' && q.options && (
                        <div className="space-y-2">
                          {q.options.map((opt, oIdx) => {
                            const isSelected = studentAns === opt;
                            return (
                              <button
                                key={oIdx}
                                type="button"
                                onClick={() => handleSetSheetAnswer(q.id, opt)}
                                className={`w-full text-left p-3.5 rounded-xl border text-xs sm:text-sm transition flex items-center justify-between cursor-pointer ${
                                  isSelected
                                    ? 'border-rose-500 bg-rose-50 text-rose-950 font-bold ring-1 ring-rose-400'
                                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800'
                                }`}
                              >
                                <span>{opt}</span>
                                {isSelected && <Check className="w-4 h-4 text-rose-600 shrink-0 ml-2" />}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {q.type === 'true_false' && (
                        <div className="grid grid-cols-2 gap-3 max-w-xs">
                          {['True', 'False'].map((val) => {
                            const isSelected = studentAns.toLowerCase() === val.toLowerCase();
                            return (
                              <button
                                key={val}
                                type="button"
                                onClick={() => handleSetSheetAnswer(q.id, val)}
                                className={`p-3 rounded-xl border text-center font-bold text-xs sm:text-sm transition cursor-pointer ${
                                  isSelected
                                    ? 'border-rose-500 bg-rose-50 text-rose-950 ring-1 ring-rose-400'
                                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800'
                                }`}
                              >
                                {val}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {q.type === 'fill_in_blank' && (
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-500 block">
                            Type the missing term:
                          </label>
                          <input
                            type="text"
                            placeholder="Enter missing term…"
                            value={studentAns}
                            onChange={(e) => handleSetSheetAnswer(q.id, e.target.value)}
                            className="w-full p-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none"
                          />
                        </div>
                      )}

                      {q.type === 'short_answer' && (
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-500 block">
                            Your answer / definition:
                          </label>
                          <input
                            type="text"
                            placeholder="State your answer clearly…"
                            value={studentAns}
                            onChange={(e) => handleSetSheetAnswer(q.id, e.target.value)}
                            className="w-full p-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none"
                          />
                        </div>
                      )}

                      {q.type === 'short_essay' && (
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-500 block">
                            Write your essay response:
                          </label>
                          <textarea
                            rows={4}
                            placeholder="Compose your structured academic response here…"
                            value={studentAns}
                            onChange={(e) => handleSetSheetAnswer(q.id, e.target.value)}
                            className="w-full p-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none resize-y"
                          />
                        </div>
                      )}
                    </div>

                    {/* REVEALED ANSWER KEY & EXPLANATIONS (Requirement 3) */}
                    {showAnswerKey && (
                      <div className="pt-4 border-t border-slate-100 space-y-3.5 bg-slate-50/70 -mx-6 -mb-6 p-6 rounded-b-2xl animate-in fade-in">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200 text-xs">
                          <span className="font-bold text-slate-900 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            Official Answer Key & Marking Guide
                          </span>

                          {/* Verification flag */}
                          {q.isVerifiedFromNotes !== false ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" />
                              Verified from Course Notes
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              ⚠️ Unverified against course notes
                            </span>
                          )}
                        </div>

                        {/* Verified Correct Answer Box */}
                        <div className="p-3 rounded-xl bg-white border border-emerald-200 space-y-1 text-xs">
                          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                            Verified Correct Answer
                          </span>
                          <div className="font-bold text-slate-900 text-sm">
                            {q.correctAnswer}
                          </div>
                        </div>

                        {/* Marking Points Rubric */}
                        {q.markingPoints && q.markingPoints.length > 0 && (
                          <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1.5 text-xs">
                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                              Marking Scheme & Scoring Rubric
                            </span>
                            <ul className="space-y-1 text-slate-700">
                              {q.markingPoints.map((pt, pIdx) => (
                                <li key={pIdx} className="flex items-start gap-1.5">
                                  <span className="w-4 h-4 rounded-full bg-indigo-50 text-indigo-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                                    {pIdx + 1}
                                  </span>
                                  <span>{pt}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Exemplar Sample Answer */}
                        {q.sampleAnswer && (
                          <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1 text-xs">
                            <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">
                              Model Exemplar Answer
                            </span>
                            <p className="text-slate-700 italic leading-relaxed">
                              "{q.sampleAnswer}"
                            </p>
                          </div>
                        )}

                        {/* Detailed Explanation */}
                        {q.explanation && (
                          <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1 text-xs">
                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                              Academic Explanation
                            </span>
                            <p className="text-slate-700 leading-relaxed">
                              {q.explanation}
                            </p>
                          </div>
                        )}

                        {/* Grounded Citations (Document, Page/Slide, Verbatim Excerpt) */}
                        {q.citations && q.citations.length > 0 && (
                          <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2 text-xs">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                              Source Document Grounding & Verified References
                            </span>
                            {q.citations.map((cite, cIdx) => (
                              <div
                                key={cIdx}
                                className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 space-y-1"
                              >
                                <div className="flex items-center justify-between text-[11px] font-bold text-slate-800">
                                  <span className="flex items-center gap-1.5">
                                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                                    {cite.filename}
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono text-[10px]">
                                    Page/Slide {cite.pageOrSlide}
                                  </span>
                                </div>
                                <p className="text-slate-600 text-[11px] italic font-serif leading-relaxed">
                                  "{cite.sourceExcerpt}"
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Bottom Examination Actions & Continuation */}
              <div className="sb-card p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 border-dashed border-2 border-slate-200 bg-slate-50/50">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <FileCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>
                    <strong>{questions.length} Questions</strong> generated for this paper.
                    {generationMode === 'past_paper'
                      ? ' Formatted like past paper; facts & answers grounded in course notes.'
                      : ' Questions synthesized directly from course notes.'}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleLoadMoreQuestions}
                    disabled={isGenerating}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isGenerating ? 'Generating Questions…' : 'Generate 5 More Questions'}</span>
                  </button>

                  <button
                    onClick={() => setShowAnswerKey(!showAnswerKey)}
                    className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    {showAnswerKey ? <EyeOff className="w-3.5 h-3.5 text-slate-500" /> : <Eye className="w-3.5 h-3.5 text-indigo-600" />}
                    <span>{showAnswerKey ? 'Hide Answer Key' : 'Reveal Official Answer Key'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VIEW LAYOUT B: Interactive Step-by-Step Drill Mode */}
          {viewLayout === 'interactive' && currentQuestion && (
            <div className="sb-card p-6 border-t-4 border-t-rose-500 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                    Question {currentIndex + 1} of {questions.length}
                  </span>
                  <span className="font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-md capitalize">
                    {currentQuestion.type.replace('_', ' ')}
                  </span>
                  {currentQuestion.allocatedMarks && (
                    <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {currentQuestion.allocatedMarks} marks
                    </span>
                  )}
                </div>

                <span className="font-medium text-slate-400 capitalize">Difficulty: {currentQuestion.difficulty}</span>
              </div>

              <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                {currentQuestion.question}
              </h3>

              {/* Options */}
              {currentQuestion.type === 'multiple_choice' && currentQuestion.options && (
                <div className="space-y-2.5">
                  {currentQuestion.options.map((opt, i) => {
                    const isSelected = selectedAnswer === opt;
                    const isCorrect = opt.trim().toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase();

                    let style = 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800';
                    if (isAnswerSubmitted) {
                      if (isCorrect) style = 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold';
                      else if (isSelected) style = 'border-red-400 bg-red-50 text-red-900';
                    } else if (isSelected) {
                      style = 'border-rose-500 bg-rose-50 text-rose-950 font-bold ring-2 ring-rose-500/20';
                    }

                    return (
                      <button
                        key={i}
                        disabled={isAnswerSubmitted}
                        onClick={() => setSelectedAnswer(opt)}
                        className={`w-full text-left p-4 rounded-xl border text-sm transition flex items-center justify-between cursor-pointer ${style}`}
                      >
                        <span className="flex-1">{opt}</span>
                        {isAnswerSubmitted && isCorrect && <Check className="w-5 h-5 text-emerald-600 ml-2 shrink-0" />}
                        {isAnswerSubmitted && isSelected && !isCorrect && <X className="w-5 h-5 text-red-600 ml-2 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {currentQuestion.type === 'true_false' && (
                <div className="grid grid-cols-2 gap-4">
                  {['True', 'False'].map((choice) => {
                    const isSelected = selectedAnswer === choice;
                    const isCorrect = choice.toLowerCase() === currentQuestion.correctAnswer.toLowerCase();

                    let style = 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800';
                    if (isAnswerSubmitted) {
                      if (isCorrect) style = 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold';
                      else if (isSelected) style = 'border-red-400 bg-red-50 text-red-900';
                    } else if (isSelected) {
                      style = 'border-rose-500 bg-rose-50 text-rose-950 font-bold';
                    }

                    return (
                      <button
                        key={choice}
                        disabled={isAnswerSubmitted}
                        onClick={() => setSelectedAnswer(choice)}
                        className={`p-4 rounded-xl border text-center font-bold text-sm transition cursor-pointer ${style}`}
                      >
                        {choice}
                      </button>
                    );
                  })}
                </div>
              )}

              {currentQuestion.type === 'fill_in_blank' && (
                <div className="space-y-2 text-xs">
                  <label className="font-semibold text-slate-700 block">Type the missing term:</label>
                  <input
                    type="text"
                    disabled={isAnswerSubmitted}
                    placeholder="Enter missing term…"
                    value={fillInBlankInput}
                    onChange={(e) => setFillInBlankInput(e.target.value)}
                    className="w-full p-3.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none"
                  />
                </div>
              )}

              {currentQuestion.type === 'short_answer' && (
                <div className="space-y-2 text-xs">
                  <label className="font-semibold text-slate-700 block">Provide your definition / answer:</label>
                  <input
                    type="text"
                    disabled={isAnswerSubmitted}
                    placeholder="Type response…"
                    value={shortAnswerInput}
                    onChange={(e) => setShortAnswerInput(e.target.value)}
                    className="w-full p-3.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none"
                  />
                </div>
              )}

              {currentQuestion.type === 'short_essay' && (
                <div className="space-y-2 text-xs">
                  <label className="font-semibold text-slate-700 block">Compose your analytical essay:</label>
                  <textarea
                    rows={5}
                    disabled={isAnswerSubmitted}
                    placeholder="Write your analysis here…"
                    value={essayInput}
                    onChange={(e) => setEssayInput(e.target.value)}
                    className="w-full p-3.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none"
                  />
                </div>
              )}

              {/* Action buttons */}
              {!isAnswerSubmitted ? (
                <button
                  onClick={handleSubmitInteractiveAnswer}
                  className="w-full py-3 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white rounded-xl font-bold text-sm shadow transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Submit Answer for Instant Verification</span>
                </button>
              ) : (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div
                    className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold gap-3 ${
                      isCurrentAnswerCorrect
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                        : 'bg-rose-50 border-rose-200 text-rose-950'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isCurrentAnswerCorrect ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                      )}
                      <span className="truncate">
                        {isCurrentAnswerCorrect
                          ? 'Correct! Grounded in verified evidence from uploaded course files.'
                          : 'Incorrect response. Review the verified explanation below.'}
                      </span>
                    </div>
                  </div>

                  {/* Verification & Explanations */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">Verified Answer:</span>
                      {currentQuestion.isVerifiedFromNotes !== false ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          ✓ Verified from Course Notes
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                          ⚠️ Unverified from course notes
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-slate-900 text-sm">
                      {currentQuestion.correctAnswer}
                    </div>
                    <p className="text-slate-600 leading-relaxed pt-1">
                      {currentQuestion.explanation}
                    </p>
                  </div>

                  {/* Navigation */}
                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => {
                        if (currentIndex > 0) {
                          setCurrentIndex((prev) => prev - 1);
                          resetQuestionInputStates();
                        }
                      }}
                      disabled={currentIndex === 0}
                      className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </button>

                    <button
                      onClick={() => {
                        if (currentIndex < questions.length - 1) {
                          setCurrentIndex((prev) => prev + 1);
                          resetQuestionInputStates();
                        }
                      }}
                      disabled={currentIndex === questions.length - 1}
                      className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Continuation Batch loader */}
          {hasMoreContinuation && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={handleLoadMoreQuestions}
                disabled={isGenerating}
                className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-2xs"
              >
                <Plus className="w-4 h-4 text-rose-600" />
                <span>Load Next Batch of Questions ({batchContinuationIndex * 5} ready)</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Revision History Modal */}
      {showRevisionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">Saved Revision Sessions</h3>
              </div>
              <button onClick={() => setShowRevisionModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2 pr-1 text-xs">
              {savedRevisions.length === 0 ? (
                <div className="text-center py-8 text-slate-400">No saved sessions yet.</div>
              ) : (
                savedRevisions.map((rev) => (
                  <div key={rev.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">{rev.date}</span>
                      <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold text-[10px]">
                        {rev.totalQuestions} questions
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Mode: <span className="font-semibold text-slate-700 capitalize">{rev.mode?.replace('_', ' ') || 'Exam Practice'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
