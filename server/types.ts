export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface Course {
  id: string;
  ownerId: string;
  title: string;
  code: string;
  description: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface Folder {
  id: string;
  courseId: string;
  ownerId: string;
  name: string;
  color?: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

export type MaterialStatus = 'waiting' | 'queued' | 'uploading' | 'processing' | 'indexing' | 'indexing_vectors' | 'indexed' | 'ready' | 'failed' | 'error';

export interface DocumentChunk {
  chunkId: string;
  documentId: string;
  filename: string;
  courseId: string;
  folderId: string | null;
  ownerId: string;
  pageOrSlide: number;
  chunkIndex: number;
  text: string;
  sourceExcerpt: string;
  embedding?: number[];
  tokenEstimate: number;
}

export interface RetrievalResult {
  chunk: DocumentChunk;
  score: number;
  matchType: 'vector' | 'lexical' | 'hybrid';
  retrievalMethod?: 'vector_primary' | 'lexical_fallback' | 'hybrid_fusion';
  relevantExcerpt?: string;
  matchedKeywords?: string[];
}

export interface RagRetrieveResponse {
  results: RetrievalResult[];
  matchType: 'vector' | 'lexical' | 'hybrid';
  retrievalMethod: 'vector_primary' | 'lexical_fallback' | 'hybrid_fusion';
  usedFallback: boolean;
  fallbackReason?: 'vector_failed' | 'no_vector_matches' | 'no_embeddings_available' | 'forced_lexical';
  matchedKeywords?: string[];
  totalChunksInScope: number;
}

export interface Material {
  id: string;
  courseId: string;
  folderId: string | null;
  ownerId: string;
  title: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  extractedTextLength: number;
  chunkCount: number;
  status: MaterialStatus;
  statusMessage?: string;
  hasEmbeddings: boolean;
  generatedQuestions?: QuizQuestion[];
  isFavorite?: boolean;
  tags?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type QuestionType =
  | 'multiple_choice'
  | 'true_false'
  | 'short_answer'
  | 'short_essay'
  | 'fill_in_blank';

export interface Citation {
  chunkId: string;
  documentId: string;
  filename: string;
  courseId: string;
  folderId: string | null;
  folderName?: string;
  pageOrSlide: number;
  sourceExcerpt: string;
  relevanceScore: number;
}

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  difficulty: 'easy' | 'medium' | 'hard';
  allocatedMarks?: number;
  question: string;
  topic?: string;
  questionStyle?: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  markingPoints?: string[];
  sampleAnswer?: string;
  acceptableAnswers?: string[];
  citations: Citation[];
  isVerifiedFromNotes?: boolean;
  verificationNote?: string;
  mode?: 'actual_past_paper' | 'past_paper' | 'notes_based';
  sourceExamTitle?: string;
  sourceQuestionNumber?: string;
  sourceSection?: string;
}

export interface PastPaperQuestionStructure {
  questionNumber: string;
  section?: string;
  type: QuestionType;
  prompt: string;
  options?: string[];
  allocatedMarks?: number;
  markingGuide?: string;
  sourcePage?: number;
}

export interface PastPaper {
  id: string;
  courseId: string;
  folderId: string | null;
  ownerId: string;
  title: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  year?: string;
  examTerm?: string;
  institution?: string;
  pageCount: number;
  extractedTextLength: number;
  extractedQuestions: PastPaperQuestionStructure[];
  status: 'waiting' | 'processing' | 'ready' | 'error';
  statusMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TutorMessage {
  id: string;
  courseId: string;
  folderId: string | null;
  ownerId: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  timestamp: string;
  retrievalMetadata?: {
    courseId: string;
    folderId: string | null;
    totalChunksSearched: number;
    matchType: 'vector' | 'lexical' | 'hybrid';
    chunksRetrieved: number;
  };
}

export interface SavedQuizMistake {
  questionId: string;
  question: string;
  studentAnswer: string;
  correctAnswer: string;
  explanation: string;
  citations?: Citation[];
}

export interface SavedQuizResult {
  id: string;
  userId: string;
  courseId: string;
  folderId?: string | null;
  folderName?: string;
  timestamp: string;
  totalQuestions: number;
  correctAnswers: number;
  scorePercentage: number;
  mistakes: SavedQuizMistake[];
  topic?: string;
}

export interface UserProgress {
  userId: string;
  courseId: string;
  totalQuestionsAnswered: number;
  correctAnswers: number;
  streakDays: number;
  lastStudiedAt: string;
  topicMastery: Record<string, number>;
  savedResults?: SavedQuizResult[];
}

export interface StudyCalendarEvent {
  id: string;
  userId: string;
  courseId: string;
  folderId?: string | null;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  isRecurring: boolean;
  recurrenceRule?: 'daily' | 'weekly' | 'weekdays' | 'monthly';
  reminderMinutesBefore?: number;
  completed: boolean;
  createdAt: string;
}

export interface StudySessionLog {
  id: string;
  userId: string;
  courseId: string;
  folderId?: string | null;
  durationMinutes: number;
  completedAt: string;
  notes?: string;
}
