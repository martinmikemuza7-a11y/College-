import { Course, Folder, Material, PastPaper, QueuedUploadItem, QuizQuestion, RagRetrieveResponse, SavedQuizResult, StudyCalendarEvent, StudySessionLog, TutorMessage, User, UserProgress, VectorSyncStatus } from '../types';

let currentUserId = 'usr_alex';

export function getActiveUserId(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('study_buddy_active_user_id');
    if (saved) return saved;
  }
  return currentUserId;
}

export function setActiveUserId(id: string) {
  currentUserId = id;
  if (typeof window !== 'undefined') {
    localStorage.setItem('study_buddy_active_user_id', id);
  }
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

export const api = {
  async getMe(): Promise<{ user: User; availableUsers: User[] }> {
    const res = await fetch('/api/auth/me');
    if (!res.ok) throw new Error('Failed to fetch user persona');
    return res.json();
  },

  async switchUser(userId: string): Promise<{ success: boolean; user: User }> {
    setActiveUserId(userId);
    const res = await fetch('/api/auth/switch-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) throw new Error('Failed to switch persona');
    return res.json();
  },

  async getCourses(): Promise<{ courses: Course[] }> {
    const res = await fetch('/api/courses');
    if (!res.ok) throw new Error('Failed to fetch courses');
    return res.json();
  },

  async createCourse(data: { title: string; code: string; description: string; color: string }): Promise<{ course: Course }> {
    const res = await fetch('/api/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create course');
    }
    return res.json();
  },

  async updateCourse(courseId: string, data: Partial<Course>): Promise<{ course: Course }> {
    const res = await fetch(`/api/courses/${courseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update course');
    return res.json();
  },

  async deleteCourse(courseId: string): Promise<{ success: boolean; deletedCourseId: string }> {
    const res = await fetch(`/api/courses/${courseId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete course');
    return res.json();
  },

  async getFolders(courseId: string): Promise<{ folders: Folder[] }> {
    const res = await fetch(`/api/courses/${courseId}/folders`);
    if (!res.ok) throw new Error('Failed to fetch folders');
    return res.json();
  },

  async createFolder(courseId: string, data: { name: string; color?: string }): Promise<{ folder: Folder }> {
    const res = await fetch(`/api/courses/${courseId}/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create folder');
    return res.json();
  },

  async updateFolder(folderId: string, data: { name: string }): Promise<{ folder: Folder }> {
    const res = await fetch(`/api/folders/${folderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update folder');
    return res.json();
  },

  async deleteFolder(folderId: string, reassignFolderId?: string | null): Promise<{ success: boolean }> {
    const res = await fetch(`/api/folders/${folderId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reassignFolderId }),
    });
    if (!res.ok) throw new Error('Failed to delete folder');
    return res.json();
  },

  async getMaterials(courseId?: string, folderId?: string | null | 'all'): Promise<{ materials: Material[] }> {
    const params = new URLSearchParams();
    if (courseId) params.append('courseId', courseId);
    if (folderId !== undefined) params.append('folderId', String(folderId));
    const res = await fetch(`/api/materials?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch materials');
    return res.json();
  },

  async uploadMaterialText(
    courseId: string,
    folderId: string | null,
    filename: string,
    text: string,
    options?: {
      title?: string;
      category?: string;
      autoGenerateQuestions?: boolean;
      questionCount?: number;
      difficulty?: string;
    }
  ): Promise<{ material: Material; questions?: QuizQuestion[] }> {
    const res = await fetch('/api/materials/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseId,
        folderId,
        filename,
        text,
        title: options?.title,
        category: options?.category,
        autoGenerateQuestions: options?.autoGenerateQuestions,
        questionCount: options?.questionCount,
        difficulty: options?.difficulty,
      }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to upload material');
    }
    return res.json();
  },

  async uploadMaterialFile(
    courseId: string,
    folderId: string | null,
    file: File,
    options?: {
      title?: string;
      category?: string;
      autoGenerateQuestions?: boolean;
      questionCount?: number;
      difficulty?: string;
    }
  ): Promise<{ material: Material; questions?: QuizQuestion[] }> {
    const MAX_UPLOAD_BYTES = 30 * 1024 * 1024; // 30MB ceiling
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error(
        `File "${file.name}" (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds the 30MB upload limit. Please compress or split the document before uploading.`
      );
    }

    const lower = file.name.toLowerCase();
    const isTextFile =
      lower.endsWith('.txt') ||
      lower.endsWith('.md') ||
      lower.endsWith('.markdown') ||
      lower.endsWith('.json') ||
      lower.endsWith('.csv') ||
      lower.endsWith('.py') ||
      lower.endsWith('.ts') ||
      lower.endsWith('.js');

    if (isTextFile) {
      const text = await file.text();
      return this.uploadMaterialText(courseId, folderId, file.name, text, options);
    }

    // For binary documents (PDF, DOCX, PPTX, Images), read as Base64 to preserve binary integrity
    const base64Data = await fileToBase64(file);

    const res = await fetch('/api/materials/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseId,
        folderId,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        base64Data,
        title: options?.title,
        category: options?.category,
        autoGenerateQuestions: options?.autoGenerateQuestions,
        questionCount: options?.questionCount,
        difficulty: options?.difficulty,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      if (res.status === 413) {
        throw new Error(
          errData.error || `File "${file.name}" exceeds maximum upload size (30MB). Please select a smaller document.`
        );
      }
      throw new Error(errData.error || 'Failed to extract and index document');
    }
    return res.json();
  },

  async getMaterialQuestions(materialId: string): Promise<{ materialId: string; questions: QuizQuestion[] }> {
    const res = await fetch(`/api/materials/${materialId}/questions`);
    if (!res.ok) throw new Error('Failed to load saved question bank');
    return res.json();
  },

  async saveMaterialQuestions(materialId: string, questions: QuizQuestion[]): Promise<{ savedCount: number; totalSaved: number; questions: QuizQuestion[] }> {
    const res = await fetch(`/api/materials/${materialId}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to save questions');
    }
    return res.json();
  },

  async updateMaterial(materialId: string, updates: Partial<Material>): Promise<{ material: Material }> {
    const res = await fetch(`/api/materials/${materialId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update material');
    return res.json();
  },

  async moveMaterial(materialId: string, targetFolderId: string | null): Promise<{ material: Material }> {
    const res = await fetch(`/api/materials/${materialId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetFolderId }),
    });
    if (!res.ok) throw new Error('Failed to move material');
    return res.json();
  },

  async deleteMaterial(materialId: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/materials/${materialId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete material');
    return res.json();
  },

  async retryMaterial(materialId: string): Promise<{ material: Material }> {
    const res = await fetch(`/api/materials/${materialId}/retry`, {
      method: 'POST',
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to retry material');
    }
    return res.json();
  },

  async getMaterialChunks(materialId: string): Promise<{ chunks: any[] }> {
    const res = await fetch(`/api/materials/${materialId}/chunks`);
    if (!res.ok) throw new Error('Failed to fetch chunks');
    return res.json();
  },

  async getTutorMessages(courseId: string, folderId?: string | null | 'all'): Promise<{ messages: TutorMessage[] }> {
    const params = new URLSearchParams({ courseId });
    if (folderId !== undefined) params.append('folderId', String(folderId));
    const res = await fetch(`/api/tutor/messages?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch tutor messages');
    return res.json();
  },

  async sendTutorChat(data: {
    courseId: string;
    folderId?: string | null | 'all';
    message: string;
    tutorStyle?: 'direct' | 'socratic' | 'summary' | 'exam_prep';
  }): Promise<{ message: TutorMessage }> {
    const res = await fetch('/api/tutor/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to send message to tutor');
    return res.json();
  },

  async clearTutorChat(courseId: string, folderId?: string | null | 'all'): Promise<{ success: boolean }> {
    const res = await fetch('/api/tutor/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId, folderId }),
    });
    if (!res.ok) throw new Error('Failed to clear chat');
    return res.json();
  },

  async getPastPapers(courseId?: string, folderId?: string | null | 'all'): Promise<{ pastPapers: PastPaper[] }> {
    const params = new URLSearchParams();
    if (courseId) params.append('courseId', courseId);
    if (folderId !== undefined) params.append('folderId', String(folderId));
    const res = await fetch(`/api/past-papers?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch past papers');
    return res.json();
  },

  async uploadPastPaperFile(courseId: string, folderId: string | null, file: File): Promise<{ pastPaper: PastPaper }> {
    const MAX_UPLOAD_BYTES = 30 * 1024 * 1024; // 30MB ceiling
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error(
        `Past paper "${file.name}" (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds the 30MB upload limit. Please compress or split the document before uploading.`
      );
    }

    const lower = file.name.toLowerCase();
    const isTextFile = lower.endsWith('.txt') || lower.endsWith('.md');

    let bodyData: any;
    if (isTextFile) {
      const text = await file.text();
      bodyData = { courseId, folderId, filename: file.name, text };
    } else {
      const base64Data = await fileToBase64(file);
      bodyData = { courseId, folderId, filename: file.name, base64Data, mimeType: file.type };
    }

    const res = await fetch('/api/past-papers/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyData),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      if (res.status === 413) {
        throw new Error(
          errData.error || `Past paper "${file.name}" exceeds maximum upload size (30MB). Please select a smaller document.`
        );
      }
      throw new Error(errData.error || 'Failed to extract and parse past paper');
    }
    return res.json();
  },

  async deletePastPaper(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/past-papers/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete past paper');
    return res.json();
  },

  async updatePastPaper(id: string, updates: Partial<PastPaper>): Promise<{ pastPaper: PastPaper }> {
    const res = await fetch(`/api/past-papers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update past paper');
    return res.json();
  },

  async generateQuiz(options: {
    courseId: string;
    folderId?: string | null | 'all';
    mode?: 'actual_past_paper' | 'past_paper' | 'notes_based';
    selectedDocumentIds?: string[];
    pastPaperIds?: string[];
    crossCourseIds?: string[];
    questionCount?: number;
    alreadyGeneratedCount?: number;
    previousQuestions?: string[];
    questionTypes?: string[];
    questionStyle?: string;
    topic?: string;
    isMockExam?: boolean;
    batchIndex?: number;
  }): Promise<{ questions: QuizQuestion[]; hasMore?: boolean; batchIndex?: number; totalGenerated?: number; mode?: 'actual_past_paper' | 'past_paper' | 'notes_based' }> {
    const res = await fetch('/api/quiz/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to generate assessment questions');
    }
    return res.json();
  },

  async recordQuizAnswer(data: {
    courseId: string;
    isCorrect: boolean;
    topic?: string;
  }): Promise<{ progress: UserProgress }> {
    const res = await fetch('/api/quiz/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to record answer');
    return res.json();
  },

  async saveQuizResult(data: {
    courseId: string;
    folderId?: string | null;
    totalQuestions: number;
    correctAnswers: number;
    mistakes: any[];
    topic?: string;
  }): Promise<{ success: boolean; savedResult: SavedQuizResult; progress: UserProgress }> {
    const res = await fetch('/api/quiz/save-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to save quiz result');
    return res.json();
  },

  async getProgress(courseId: string): Promise<{ progress: UserProgress | null }> {
    const res = await fetch(`/api/progress?courseId=${courseId}`);
    if (!res.ok) throw new Error('Failed to fetch progress');
    return res.json();
  },

  async getCalendarEvents(): Promise<{ events: StudyCalendarEvent[] }> {
    const res = await fetch('/api/calendar');
    if (!res.ok) throw new Error('Failed to fetch calendar');
    return res.json();
  },

  async createCalendarEvent(data: Partial<StudyCalendarEvent>): Promise<{ event: StudyCalendarEvent }> {
    const res = await fetch('/api/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create calendar event');
    return res.json();
  },

  async updateCalendarEvent(id: string, updates: Partial<StudyCalendarEvent>): Promise<{ event: StudyCalendarEvent }> {
    const res = await fetch(`/api/calendar/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update event');
    return res.json();
  },

  async deleteCalendarEvent(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/calendar/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete event');
    return res.json();
  },

  async getStudyLogs(): Promise<{ logs: StudySessionLog[] }> {
    const res = await fetch('/api/study-logs');
    if (!res.ok) throw new Error('Failed to fetch study logs');
    return res.json();
  },

  async logStudySession(data: {
    courseId: string;
    durationMinutes: number;
    folderId?: string | null;
    notes?: string;
  }): Promise<{ log: StudySessionLog }> {
    const res = await fetch('/api/study-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to log study session');
    return res.json();
  },

  async getVectorSyncStatus(courseId: string, folderId?: string | null | 'all'): Promise<VectorSyncStatus> {
    const params = new URLSearchParams({ courseId });
    if (folderId !== undefined) params.append('folderId', String(folderId));
    const res = await fetch(`/api/rag/status?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to get vector sync status');
    return res.json();
  },

  async triggerVectorResync(courseId: string, folderId?: string | null | 'all'): Promise<{ success: boolean; count: number }> {
    const res = await fetch('/api/rag/resync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId, folderId }),
    });
    if (!res.ok) throw new Error('Failed to trigger resync');
    return res.json();
  },

  async testRetrieve(data: {
    query: string;
    courseId: string;
    folderId?: string | null | 'all';
    topK?: number;
    forceLexical?: boolean;
  }): Promise<RagRetrieveResponse> {
    const res = await fetch('/api/rag/retrieve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to retrieve chunks');
    return res.json();
  },

  async getCoverage(courseId: string, folderId?: string | null | 'all'): Promise<any> {
    const params = new URLSearchParams({ courseId });
    if (folderId !== undefined) params.append('folderId', String(folderId));
    const res = await fetch(`/api/rag/coverage?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch coverage');
    return res.json();
  },

  async runDiagnostics(): Promise<{
    allPassed: boolean;
    results: { testName: string; passed: boolean; details: string }[];
    environment: {
      geminiApiKeyPresent: boolean;
      embeddingModel: string;
      generationModel: string;
    };
  }> {
    const res = await fetch('/api/diagnostics/run', {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to run diagnostics');
    return res.json();
  },
};
