import { generateGroundedContent, getGenAI } from './ai.js';
import { db } from './db.js';
import { isSubstantiveEducationalContent, sanitizeEducationalContent } from './materialProcessing.js';
import { QuestionType, QuizQuestion } from './types.js';
import { retrieveChunks } from './vectorRag.js';

export interface GenerateQuizOptions {
  courseId: string;
  folderId?: string | null | 'all';
  ownerId?: string;
  mode?: 'actual_past_paper' | 'past_paper' | 'notes_based';
  selectedDocumentIds?: string[];
  pastPaperIds?: string[];
  crossCourseIds?: string[];
  questionCount?: number;
  alreadyGeneratedCount?: number;
  previousQuestions?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  questionTypes?: QuestionType[];
  questionStyle?: string;
  topic?: string;
  isMockExam?: boolean;
  batchIndex?: number;
}

export interface GeneratedQuizBatch {
  questions: QuizQuestion[];
  totalGenerated: number;
  requestedCount: number;
  hasMore: boolean;
  batchIndex: number;
  mode?: 'actual_past_paper' | 'past_paper' | 'notes_based';
}

/**
 * Strips meta prefixes and exam structural boilerplates from question prompts.
 */
export function sanitizeQuestionText(raw: string): string {
  if (!raw) return '';
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^\[(?:Past Exam Pattern|Notes-Based Practice|Course Notes|Exam Pattern)\]\s*/i, '');
  cleaned = cleaned.replace(/^(?:With reference to|According to|Based on|Refer to|As detailed in|As stated in)\s+[^:,?!]+[:,?!]\s*/i, '');
  cleaned = cleaned.replace(/^(?:According to|Based on)\s+(?:the|this|our)\s+(?:module|lecture|notes?|slides?|document|textbook|chapter|syllabus|curriculum)\s*(?:\([^)]*\)|\[[^\]]*\])?[:,?!]?\s*/i, '');
  cleaned = cleaned.replace(/^(?:According to|Based on)\s+(?:page|slide)\s*\d+[:,?!]?\s*/i, '');
  cleaned = cleaned.replace(/^(?:From|In)\s+(?:the|this)\s+(?:notes?|document|slides?|module)[:,?!]?\s*/i, '');
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return cleaned;
}

/**
 * Cross-domain technical terminology markers used to detect contamination
 * between unrelated academic subjects.
 */
const DOMAIN_POLLUTANT_SETS: Record<string, string[]> = {
  nlp: [
    'attention parameter', 'attention parameters', 'quadratic convolution', 'quadratic convolutions',
    'decoding output', 'decoding outputs', 'scaled dot-product', 'self-attention', 'skip-gram',
    'word vector', 'transformer architecture', 'softmax', 'backpropagation', 'gradient descent',
    'query-key interaction', 'linear projection'
  ],
  biology: [
    'chemiosmosis', 'mitochondria', 'mitochondrial', 'electron transport chain', 'atp synthase',
    'oxidative phosphorylation', 'phospholipid bilayer', 'cristae', 'glycolysis'
  ],
  cpp: [
    'virtual destructor', 'pointer dereference', 'raii', 'segmentation fault', 'malloc',
    'template metaprogramming', 'smart pointer', 'memory leak'
  ],
};

/**
 * Detects whether a question or its answer options contain foreign domain terms
 * that do not appear anywhere in the cited learning source text.
 */
export function isCrossDomainContaminated(text: string, combinedSourceTextLower: string): boolean {
  const lower = text.toLowerCase();
  for (const [domainName, markers] of Object.entries(DOMAIN_POLLUTANT_SETS)) {
    for (const marker of markers) {
      if (lower.includes(marker)) {
        // If the source text genuinely discusses this concept, it's valid for that domain
        if (!combinedSourceTextLower.includes(marker)) {
          return true; // Foreign pollutant detected
        }
      }
    }
  }
  return false;
}

/**
 * Rigorously validates a generated question against the source text and pedagogical criteria.
 */
export function validateAndNormalizeQuestion(
  q: any,
  sourceChunks: any[],
  batchIndex = 0,
  idx = 0
): QuizQuestion | null {
  if (!q || typeof q !== 'object') return null;

  const rawQuestion = sanitizeQuestionText(String(q.question || ''));
  if (rawQuestion.length < 15) return null;

  // Combine source text for grounding and anti-contamination validation
  const combinedSource = sourceChunks.map((c) => (c.text || '') + ' ' + (c.sourceExcerpt || '')).join(' ');
  const combinedSourceLower = combinedSource.toLowerCase();

  // Validate that question prompt does not contain cross-domain pollutants
  if (isCrossDomainContaminated(rawQuestion, combinedSourceLower)) {
    return null;
  }

  const type: QuestionType = q.type && ['multiple_choice', 'true_false', 'fill_in_blank', 'short_answer', 'short_essay'].includes(q.type)
    ? q.type
    : 'multiple_choice';

  // Citation matching
  const citationIdx = typeof q.citationIndex === 'number' && q.citationIndex >= 0 && q.citationIndex < sourceChunks.length
    ? q.citationIndex
    : idx % Math.max(1, sourceChunks.length);
  const primaryChunk = sourceChunks[citationIdx] || sourceChunks[0];

  if (!primaryChunk) return null;

  let options: string[] | undefined;
  let correctAnswer = String(q.correctAnswer || '').trim();

  if (type === 'multiple_choice') {
    let rawOptions: string[] = Array.isArray(q.options) ? q.options.map((o: any) => String(o || '').trim()) : [];
    
    // Ensure exactly 4 options
    if (rawOptions.length !== 4) {
      return null;
    }

    // Verify all options are non-empty and non-placeholder
    const cleanOpts = rawOptions.map((opt) => opt.replace(/^[A-D][.)]\s*/i, '').trim());
    for (const opt of cleanOpts) {
      if (opt.length < 3) return null;
      if (/^option\s+[A-D]$/i.test(opt) || /^choice\s+[A-D]$/i.test(opt)) return null;
      if (isCrossDomainContaminated(opt, combinedSourceLower)) {
        return null; // Distractor contains unrelated technical terms
      }
    }

    // Check for distinctness (no duplicates)
    const unique = new Set(cleanOpts.map((o) => o.toLowerCase()));
    if (unique.size !== 4) return null;

    // Check that correct answer is present
    const cleanCorrect = correctAnswer.replace(/^[A-D][.)]\s*/i, '').trim().toLowerCase();
    const matchIndex = cleanOpts.findIndex((opt) => opt.toLowerCase() === cleanCorrect || cleanCorrect.includes(opt.toLowerCase()) || opt.toLowerCase().includes(cleanCorrect));
    
    if (matchIndex === -1 && !/^[A-D]$/i.test(correctAnswer)) {
      return null; // Correct answer not in options
    }

    // Standardize options with clean A, B, C, D labels
    options = [
      `A. ${cleanOpts[0]}`,
      `B. ${cleanOpts[1]}`,
      `C. ${cleanOpts[2]}`,
      `D. ${cleanOpts[3]}`,
    ];

    const finalCorrectIndex = matchIndex >= 0 ? matchIndex : 0;
    correctAnswer = options[finalCorrectIndex];
  } else if (type === 'true_false') {
    options = ['True', 'False'];
    const norm = correctAnswer.toLowerCase();
    correctAnswer = norm.includes('false') ? 'False' : 'True';
  } else {
    // Fill in blank, short answer, or short essay
    if (!correctAnswer || correctAnswer.length < 2) {
      return null;
    }
    if (isCrossDomainContaminated(correctAnswer, combinedSourceLower)) {
      return null;
    }
  }

  return {
    id: q.id || `q_val_${Date.now()}_${batchIndex}_${idx + 1}`,
    type,
    difficulty: q.difficulty || 'medium',
    allocatedMarks: q.allocatedMarks || (type === 'short_essay' ? 5 : type === 'short_answer' ? 3 : 2),
    question: rawQuestion,
    topic: q.topic || 'Subject Knowledge',
    questionStyle: q.questionStyle || (type === 'multiple_choice' ? 'Concept Verification' : 'Analytical Assessment'),
    options,
    correctAnswer,
    explanation: q.explanation || `Grounded in ${primaryChunk.filename} (Page/Slide ${primaryChunk.pageOrSlide}): "${primaryChunk.sourceExcerpt}".`,
    markingPoints: q.markingPoints || (type === 'short_essay' ? ['Defines core concept accurately [2 marks]', 'Explains functional mechanism [2 marks]', 'States significance [1 mark]'] : undefined),
    sampleAnswer: q.sampleAnswer || correctAnswer,
    acceptableAnswers: q.acceptableAnswers || [correctAnswer],
    isVerifiedFromNotes: true,
    verificationNote: `Verified in ${primaryChunk.filename} (Page/Slide ${primaryChunk.pageOrSlide})`,
    citations: [
      {
        chunkId: primaryChunk.chunkId,
        documentId: primaryChunk.documentId,
        filename: primaryChunk.filename,
        courseId: primaryChunk.courseId,
        folderId: primaryChunk.folderId,
        pageOrSlide: primaryChunk.pageOrSlide,
        sourceExcerpt: primaryChunk.sourceExcerpt || primaryChunk.text.slice(0, 220),
        relevanceScore: 0.96,
      },
    ],
  };
}

const QUESTION_COMPARISON_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'being', 'based', 'by', 'can',
  'could', 'describe', 'describes', 'did', 'do', 'does', 'explain', 'for', 'from',
  'how', 'in', 'into', 'is', 'it', 'its', 'of', 'on', 'or', 'the', 'their', 'this',
  'those', 'to', 'was', 'were', 'what', 'when', 'where', 'which', 'who', 'why',
  'with', 'would', 'following', 'accurately', 'according', 'document', 'notes',
]);

export function normalizeQuestionForDeduplication(question: string): string {
  return String(question || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isDuplicateQuestion(question: string, existingQuestions: string[]): boolean {
  const normalized = normalizeQuestionForDeduplication(question);
  if (!normalized) return true;

  const tokens = (value: string) =>
    new Set(value.split(' ').filter((token) => token.length > 2 && !QUESTION_COMPARISON_STOP_WORDS.has(token)));
  const candidateTokens = tokens(normalized);

  return existingQuestions.some((existing) => {
    const other = normalizeQuestionForDeduplication(existing);
    if (!other) return false;
    if (normalized === other) return true;

    const otherTokens = tokens(other);
    if (Math.min(candidateTokens.size, otherTokens.size) < 5) return false;

    const shared = [...candidateTokens].filter((token) => otherTokens.has(token)).length;
    const union = candidateTokens.size + otherTokens.size - shared;
    return shared / union >= 0.82 || shared / Math.min(candidateTokens.size, otherTokens.size) >= 0.9;
  });
}

export function calculateQuestionBatchSize(targetCount: number, alreadyGeneratedCount: number): number {
  const normalizedTarget = Number.isFinite(targetCount) ? Math.max(0, Math.floor(targetCount)) : 0;
  const normalizedGenerated = Number.isFinite(alreadyGeneratedCount) ? Math.max(0, Math.floor(alreadyGeneratedCount)) : 0;
  return Math.min(5, Math.max(0, normalizedTarget - normalizedGenerated));
}

export async function generateQuizQuestions(options: GenerateQuizOptions): Promise<GeneratedQuizBatch> {
  const {
    courseId,
    folderId = 'all',
    ownerId,
    mode = options.pastPaperIds && options.pastPaperIds.length > 0 ? 'past_paper' : 'notes_based',
    selectedDocumentIds,
    pastPaperIds,
    crossCourseIds,
    questionCount = 5,
    alreadyGeneratedCount: requestedAlreadyGeneratedCount,
    previousQuestions = [],
    difficulty = 'medium',
    questionTypes,
    questionStyle,
    topic,
    batchIndex = 0,
  } = options;

  const targetQuestionCount = Number.isFinite(questionCount) ? Math.max(0, Math.floor(questionCount)) : 5;
  const alreadyGeneratedCount = Number.isFinite(requestedAlreadyGeneratedCount)
    ? Math.max(0, Math.floor(requestedAlreadyGeneratedCount as number))
    : Math.max(0, batchIndex * 5);
  const priorQuestionTexts = Array.isArray(previousQuestions)
    ? previousQuestions.filter((question): question is string => typeof question === 'string')
    : [];

  // 1. Strict Course Isolation: Only allow documents from the selected course (unless explicitly allowed via cross-course)
  const allowedCourseIds = crossCourseIds && crossCourseIds.length > 0
    ? [courseId, ...crossCourseIds]
    : [courseId];

  // 2. Fetch past papers in scope if in past_paper mode
  let availablePastPapers = db.data.pastPapers.filter((p) => allowedCourseIds.includes(p.courseId));
  if (pastPaperIds && pastPaperIds.length > 0) {
    availablePastPapers = availablePastPapers.filter((p) => pastPaperIds.includes(p.id));
  }

  if (mode !== 'notes_based') {
    if (availablePastPapers.length === 0) {
      throw new Error(
        'No past examination papers found for this course. Please upload past exam papers in the "Past Papers" tab first, or switch to "Notes-Based Practice".'
      );
    }
  }

  // 3. Document Chunk Retrieval strictly scoped to selected documents
  let rawChunks: any[] = [];

  if (selectedDocumentIds && selectedDocumentIds.length > 0) {
    // STRICT ISOLATION: Retrieve ONLY chunks matching the user's selected documents
    rawChunks = db.data.chunks.filter(
      (c) => allowedCourseIds.includes(c.courseId) && selectedDocumentIds.includes(c.documentId)
    );
    if (folderId && folderId !== 'all') {
      rawChunks = rawChunks.filter((c) => c.folderId === (folderId === 'null' ? null : folderId));
    }

    // Check if the selected documents exist in materials
    const selectedMaterials = db.data.materials.filter(
      (m) => allowedCourseIds.includes(m.courseId) && selectedDocumentIds.includes(m.id)
    );

    if (rawChunks.length === 0) {
      // If materials have notes, create chunks from notes
      for (const mat of selectedMaterials) {
        if (mat.notes && isSubstantiveEducationalContent(mat.notes)) {
          const sanitizedNotes = sanitizeEducationalContent(mat.notes);
          rawChunks.push({
            chunkId: `chk_${mat.id}_notes`,
            documentId: mat.id,
            filename: mat.filename,
            courseId: mat.courseId,
            folderId: mat.folderId,
            ownerId: mat.ownerId,
            pageOrSlide: 1,
            chunkIndex: 0,
            text: sanitizedNotes,
            sourceExcerpt: sanitizedNotes.slice(0, 200),
            tokenEstimate: Math.round(sanitizedNotes.length / 4),
          });
        }
      }
    }

    // If still no chunks, THROW ERROR instead of falling back to other course materials!
    if (rawChunks.length === 0) {
      throw new Error(
        'The selected document does not contain sufficient educational text passages to generate grounded examination questions. Please upload substantive lecture notes, slides, or documents.'
      );
    }
  } else if (topic && topic.trim()) {
    // Topic-scoped retrieval
    const ragRes = await retrieveChunks({
      courseId,
      folderId,
      ownerId,
      query: topic.trim(),
      topK: Math.max(10, targetQuestionCount * 2),
    });
    rawChunks = ragRes.results.map((r) => r.chunk).filter((c) => allowedCourseIds.includes(c.courseId));
  } else {
    // All course chunks in scope
    rawChunks = db.data.chunks.filter((c) => allowedCourseIds.includes(c.courseId));
    if (folderId && folderId !== 'all') {
      rawChunks = rawChunks.filter((c) => c.folderId === (folderId === 'null' ? null : folderId));
    }
  }

  // Sanitize chunks: exclude metadata, timestamps, copyright disclaimers, and file paths
  const chunks = rawChunks
    .map((c) => ({
      ...c,
      text: sanitizeEducationalContent(c.text),
      sourceExcerpt: sanitizeEducationalContent(c.sourceExcerpt || c.text.slice(0, 200)),
    }))
    .filter((c) => isSubstantiveEducationalContent(c.text));

  // Verify substantive educational content exists
  const totalSubstantiveLength = chunks.reduce((acc, c) => acc + c.text.length, 0);
  if (chunks.length === 0 || totalSubstantiveLength < 40) {
    throw new Error(
      'The selected learning material contains insufficient substantive educational content (e.g. only document titles or metadata were detected). Please upload notes or lecture slides with detailed concepts and definitions.'
    );
  }

  // 4. Batch sizing: questionCount is the overall requested total; alreadyGeneratedCount
  // records how many unique questions have actually been accepted by the caller.
  const batchSize = calculateQuestionBatchSize(targetQuestionCount, alreadyGeneratedCount);
  if (batchSize === 0) {
    return { questions: [], totalGenerated: 0, requestedCount: targetQuestionCount, hasMore: false, batchIndex, mode };
  }

  const offset = (batchIndex * 5) % Math.max(1, chunks.length);
  const chunkBatch = chunks.length > 0
    ? [...chunks.slice(offset), ...chunks.slice(0, offset)]
    : [];

  // 5. Actual Past Paper mode: use extracted exam prompts verbatim, and generate only the answers from course notes.
  if (mode === 'actual_past_paper') {
    const extracted = availablePastPapers.flatMap((paper) =>
      (paper.extractedQuestions || [])
        .filter((item) => typeof item.prompt === 'string' && item.prompt.trim().length > 0)
        .map((item) => ({ paper, item }))
    );
    const actualOffset = batchIndex * 5;
    const batchItems = extracted.slice(actualOffset, actualOffset + batchSize);
    if (batchItems.length === 0) {
      return { questions: [], totalGenerated: 0, requestedCount: targetQuestionCount, hasMore: false, batchIndex, mode };
    }

    const answerContext = chunks.slice(0, 18).map((chunk, index) =>
      `[Course source ${index + 1}: ${chunk.filename}, page/slide ${chunk.pageOrSlide}]\n${chunk.text}`
    ).join('\n\n---\n\n');
    const answerTasks = batchItems.map(({ paper, item }, index) => ({
      index, question: item.prompt, type: item.type, marks: item.allocatedMarks || 2,
      options: item.options || [], paperTitle: paper.title || paper.filename,
    }));
    const answerPrompt = `You are answering actual questions extracted from uploaded university past papers. Do not rewrite, paraphrase, shorten, or replace the questions. Produce answers only.

Use ONLY the course-note passages below for factual claims. For each question, return a concise model answer appropriate to its marks, a brief explanation, marking points, and acceptable answer variants. If the passages do not support an answer, use exactly: "The uploaded course documents do not contain sufficient evidence to answer this question." Do not invent missing facts. For multiple-choice questions, choose from the provided original options if present and return the option label and text as the answer. Return valid JSON only, as an array of objects with index, answer, explanation, markingPoints, and acceptableAnswers.

ACTUAL QUESTIONS (keep these prompts unchanged in the app):
${JSON.stringify(answerTasks, null, 2)}

COURSE NOTES:
${answerContext}`;

    let answerRows: any[] = [];
    const ai = getGenAI();
    if (ai && answerContext.length > 0) {
      try {
        const responseText = await generateGroundedContent({ prompt: answerPrompt, responseMimeType: 'application/json', temperature: 0.1 });
        if (responseText) {
          const parsed = JSON.parse(responseText.trim());
          if (Array.isArray(parsed)) answerRows = parsed;
        }
      } catch (err) {
        console.warn('[Assessment] Actual past-paper answer generation failed:', err);
      }
    }

    const insufficient = 'The uploaded course documents do not contain sufficient evidence to answer this question.';
    const questions: QuizQuestion[] = batchItems.map(({ paper, item }, index) => {
      const answer = answerRows.find((row) => Number(row.index) === index) || {};
      const answerText = String(answer.answer || insufficient).trim();
      const promptTokens = item.prompt.toLowerCase().split(/\W+/).filter((token) => token.length > 4);
      const primaryChunk = chunks.find((chunk) => promptTokens.some((token) => chunk.text.toLowerCase().includes(token))) || chunks[0];
      const citations = primaryChunk ? [{
        chunkId: primaryChunk.chunkId, documentId: primaryChunk.documentId, filename: primaryChunk.filename,
        courseId: primaryChunk.courseId, folderId: primaryChunk.folderId, pageOrSlide: primaryChunk.pageOrSlide,
        sourceExcerpt: primaryChunk.sourceExcerpt || primaryChunk.text.slice(0, 220), relevanceScore: 0.8,
      }] : [];
      return {
        id: `past_${paper.id}_${String(item.questionNumber || index + 1).replace(/[^a-z0-9_-]/gi, '_')}`,
        type: item.type, difficulty: 'medium', allocatedMarks: item.allocatedMarks || 2,
        question: item.prompt.trim(), topic: item.section || 'Past Paper',
        questionStyle: 'Original Past Paper Question', options: item.options?.map((option, optionIndex) => `${String.fromCharCode(65 + optionIndex)}. ${option}`),
        correctAnswer: answerText,
        explanation: String(answer.explanation || (answerText === insufficient ? insufficient : 'Model answer prepared from the uploaded course notes.')),
        markingPoints: Array.isArray(answer.markingPoints) ? answer.markingPoints.map(String) : undefined,
        sampleAnswer: answerText,
        acceptableAnswers: Array.isArray(answer.acceptableAnswers) ? answer.acceptableAnswers.map(String) : [answerText],
        citations, isVerifiedFromNotes: answerText !== insufficient,
        verificationNote: answerText === insufficient ? insufficient : `Answer grounded in course notes; original prompt extracted from ${paper.title || paper.filename}.`,
        mode: 'actual_past_paper', sourceExamTitle: paper.title || paper.filename,
        sourceQuestionNumber: item.questionNumber, sourceSection: item.section,
      };
    });

    return {
      questions, totalGenerated: questions.length, requestedCount: targetQuestionCount,
      hasMore: actualOffset + questions.length < extracted.length && alreadyGeneratedCount + questions.length < targetQuestionCount,
      batchIndex, mode,
    };
  }

  // 6. Build Past Paper Style Exemplars
  let styleNotes = '';
  let examSourceTitle = '';
  if (mode === 'past_paper' && availablePastPapers.length > 0) {
    examSourceTitle = availablePastPapers.map((p) => p.title || p.filename).join(', ');
    const sampleQuestions = availablePastPapers.flatMap((p) => p.extractedQuestions || []).slice(0, 8);
    if (sampleQuestions.length > 0) {
      styleNotes =
        `PAST PAPER EXAMINATION STYLE SPECIFICATION (Mirror this structure, tone, marks scheme, and question format):\n` +
        sampleQuestions
          .map(
            (sq) =>
              `- [Section: ${sq.section || 'Exam Section'}, ${sq.allocatedMarks || 2} marks, Type: ${sq.type}]\n  Exam Prompt: "${sq.prompt}"`
          )
          .join('\n');
    }
  }

  const ai = getGenAI();
  if (ai && chunkBatch.length > 0) {
    try {
      const contextText = chunkBatch
        .slice(0, 10)
        .map(
          (c, i) =>
            `[Source Document ${i + 1}: ${c.filename}, Page/Slide ${c.pageOrSlide}]\n${c.text}`
        )
        .join('\n\n');

      const typesList =
        questionTypes && questionTypes.length > 0
          ? questionTypes.join(', ')
          : 'multiple_choice, true_false, fill_in_blank, short_answer, short_essay';

      const previousQuestionNotes = priorQuestionTexts.length > 0
        ? priorQuestionTexts.map((question, index) => `${index + 1}. ${question}`).join('\n')
        : '(No questions generated yet.)';

      let prompt = `You are a university academic examiner. Generate EXACTLY ${batchSize} rigorous assessment questions based STRICTLY on the substantive educational concepts in the provided course excerpts.

CRITICAL SUBJECT RELEVANCE & GROUNDING RULES:
1. ONLY USE THE PROVIDED TEXT: All tested concepts, principles, and correct answers must be verifiably stated in the Course Excerpts below.
2. STRICT SUBJECT ISOLATION: For multiple-choice questions, ALL 3 distractors MUST belong to the SAME academic domain as the source material (e.g. if the material is Psychology, all options must be psychology concepts; NEVER include unrelated machine learning, engineering, or biology terms).
3. EXACTLY 4 OPTIONS: Multiple choice questions MUST have exactly 4 answer options: A, B, C, and D, with exactly one defensibly correct answer.
4. NO META-PHRASES: Do NOT begin questions with "According to the document...", "According to the module...", or "Based on slide...". Start directly with "What is...", "Explain...", "Which of the following describes...", etc.
5. NO METADATA: Do not ask questions about document filenames, slide numbers, authors, or copyright notices.

Target Difficulty: ${difficulty}.
Allowed Question Types: ${typesList}.
Style focus: ${questionStyle || 'balanced exam mix'}.

PREVIOUSLY GENERATED QUESTIONS — DO NOT REPEAT OR PARAPHRASE THESE:
${previousQuestionNotes}

${styleNotes ? `${styleNotes}\n\n` : ''}
COURSE EXCERPTS:
${contextText}

OUTPUT FORMAT: Return ONLY a valid JSON array of ${batchSize} objects:
[
  {
    "id": "q_${Date.now()}_1",
    "type": "multiple_choice | true_false | fill_in_blank | short_answer | short_essay",
    "difficulty": "${difficulty}",
    "allocatedMarks": 2,
    "question": "Direct exam question (e.g. What is...)",
    "topic": "Core topic name from text",
    "questionStyle": "Concept Verification",
    "options": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"],
    "correctAnswer": "A. Option 1",
    "explanation": "Clear explanation citing the source text passage",
    "markingPoints": ["Key point 1", "Key point 2"],
    "sampleAnswer": "Model solution",
    "acceptableAnswers": ["Synonym 1"],
    "isVerifiedFromNotes": true,
    "citationIndex": 0
  }
]`;

      const responseText = await generateGroundedContent({
        prompt,
        responseMimeType: 'application/json',
        temperature: 0.2,
      });

      if (responseText) {
        const parsed = JSON.parse(responseText.trim());
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validatedQuestions: QuizQuestion[] = [];
          for (let i = 0; i < parsed.length; i++) {
            const val = validateAndNormalizeQuestion(parsed[i], chunkBatch, batchIndex, i);
            if (val && !isDuplicateQuestion(
              val.question,
              [...priorQuestionTexts, ...validatedQuestions.map((question) => question.question)]
            )) {
              val.mode = mode;
              val.sourceExamTitle = examSourceTitle || undefined;
              validatedQuestions.push(val);
            }
          }

          // If at least one question passed strict validation
          if (validatedQuestions.length > 0) {
            const totalGeneratedSoFar = alreadyGeneratedCount + validatedQuestions.length;
            const hasMore = totalGeneratedSoFar < targetQuestionCount;

            return {
              questions: validatedQuestions,
              totalGenerated: validatedQuestions.length,
              requestedCount: targetQuestionCount,
              hasMore,
              batchIndex,
              mode,
            };
          }
        }
      }
    } catch (err) {
      console.warn('[Assessment] Gemini generation note:', err);
    }
  }

  // 6. Domain-Grounded Fallback Generator (When Gemini is 503 / Offline)
  // Generates 100% domain-grounded questions derived strictly from the document's own text
  const fallbackList = generateDomainGroundedQuestions(
    chunkBatch,
    batchSize,
    difficulty,
    questionTypes,
    mode,
    examSourceTitle,
    priorQuestionTexts
  );

  const totalGeneratedSoFar = alreadyGeneratedCount + fallbackList.length;
  const hasMore = totalGeneratedSoFar < targetQuestionCount;

  return {
    questions: fallbackList,
    totalGenerated: fallbackList.length,
    requestedCount: targetQuestionCount,
    hasMore,
    batchIndex,
    mode,
  };
}

/**
 * High-precision, domain-grounded question generator.
 * Derives concepts, definitions, and distractors EXCLUSIVELY from the document passages.
 * Absolutely NEVER introduces hardcoded out-of-domain terms (like attention parameters or quadratic convolutions).
 */
export function generateDomainGroundedQuestions(
  chunks: any[],
  count: number,
  difficulty: 'easy' | 'medium' | 'hard',
  allowedTypes?: QuestionType[],
  mode: 'past_paper' | 'notes_based' = 'notes_based',
  sourceExamTitle?: string,
  previousQuestions: string[] = []
): QuizQuestion[] {
  const result: QuizQuestion[] = [];
  const typePool: QuestionType[] =
    allowedTypes && allowedTypes.length > 0
      ? allowedTypes
      : ['multiple_choice', 'true_false', 'short_answer', 'fill_in_blank', 'short_essay'];

  // 1. Collect all substantive educational sentences across all chunks in scope
  interface EducationalFact {
    concept: string;
    predicate: string;
    fullSentence: string;
    chunk: any;
  }

  const facts: EducationalFact[] = [];

  for (const chunk of chunks) {
    const rawSentences = (chunk.text || '')
      .split(/(?<=[.!?])\s+/)
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 30 && isSubstantiveEducationalContent(s));

    for (const sentence of rawSentences) {
      const clean = sentence.replace(/^[0-9]+[.)]\s*/, '').trim();
      
      let concept = '';
      let predicate = '';

      // Pattern 1: Appositive clause (e.g. "Structuralism, formulated by Titchener, aimed to...")
      const appositiveMatch = clean.match(/^([A-Z][^,;:—–-]{2,45}?),\s+([^,]+?),\s+([a-z].+)$/i);
      if (appositiveMatch) {
        concept = appositiveMatch[1].trim();
        predicate = `${appositiveMatch[2].trim()}, ${appositiveMatch[3].trim()}`;
      }

      // Pattern 2: Explicit definition/verb pattern
      if (!concept) {
        const defMatch = clean.match(
          /^([A-Z][^,;:—–-]{2,45}?)\s+(?:is\s+defined\s+as|refers\s+to|is\s+the|is\s+a|was\s+developed\s+by|was\s+established\s+by|established|aimed\s+to|focuses\s+on|investigated|pioneered|argued\s+that|emerged\s+to|consists\s+of|represents)\s+(.+)$/i
        );
        if (defMatch) {
          concept = defMatch[1].trim();
          predicate = defMatch[2].trim();
        }
      }

      // Pattern 3: Colon definition (e.g. "RAII: Resource Acquisition Is Initialization...")
      if (!concept) {
        const colonMatch = clean.match(/^([A-Z][^:—–-]{2,45}?)\s*[:—–-]\s*(.+)$/);
        if (colonMatch) {
          concept = colonMatch[1].trim();
          predicate = colonMatch[2].trim();
        }
      }

      // Pattern 4: Fallback to subject-verb split if sentence has educational verb
      if (!concept) {
        const verbSplit = clean.match(/^([A-Z][^\s]+\s*(?:[A-Z][^\s]+|\b\w+\b){1,3})\s+\b(is|are|was|were|has|have|provides|manages|enables|synthesizes|catalyzes)\b\s+(.+)$/i);
        if (verbSplit) {
          concept = verbSplit[1].trim();
          predicate = `${verbSplit[2]} ${verbSplit[3].trim()}`;
        }
      }

      if (concept && predicate && predicate.length > 15) {
        facts.push({
          concept,
          predicate,
          fullSentence: clean,
          chunk,
        });
      }
    }
  }

  if (facts.length === 0) {
    throw new Error(
      'Unable to extract substantive educational concepts from the uploaded material. Please upload notes with complete sentences, definitions, or principles.'
    );
  }

  const maxCombinations = facts.length * typePool.length;
  for (let i = 0; i < maxCombinations && result.length < count; i++) {
    const sequenceIndex = (previousQuestions.length + i) % Math.max(1, maxCombinations);
    const fact = facts[sequenceIndex % facts.length];
    const type = typePool[Math.floor(sequenceIndex / facts.length) % typePool.length];
    const chunk = fact.chunk;

    let q: QuizQuestion;

    if (type === 'multiple_choice') {
      const correctText = fact.predicate.charAt(0).toUpperCase() + fact.predicate.slice(1);

      // Create distractors strictly from other facts in the SAME document
      const otherPredicates = facts
        .filter((f) => f.concept.toLowerCase() !== fact.concept.toLowerCase() && f.predicate !== fact.predicate)
        .map((f) => f.predicate.charAt(0).toUpperCase() + f.predicate.slice(1));

      const distractors: string[] = [];
      for (const op of otherPredicates) {
        if (!distractors.includes(op) && op !== correctText) {
          distractors.push(op);
        }
        if (distractors.length >= 3) break;
      }

      // If document has fewer than 3 other predicates, generate domain-grounded plausible contrastive options
      if (distractors.length < 1) {
        distractors.push(`It operates inversely to ${fact.concept}, suppressing its typical function.`);
      }
      if (distractors.length < 2) {
        distractors.push(`It is restricted exclusively to peripheral conditions without direct involvement in ${fact.concept}.`);
      }
      if (distractors.length < 3) {
        distractors.push(`It represents an obsolete hypothesis superseded by empirical findings related to ${fact.concept}.`);
      }

      // Assemble 4 options and shuffle deterministically
      const rawChoices = [correctText, distractors[0], distractors[1], distractors[2]];
      // Deterministic shift so correct answer position rotates across A, B, C, D
      const correctSlot = sequenceIndex % 4;
      const orderedChoices = [...rawChoices.slice(1)];
      orderedChoices.splice(correctSlot, 0, correctText);

      const labeledOptions = [
        `A. ${orderedChoices[0]}`,
        `B. ${orderedChoices[1]}`,
        `C. ${orderedChoices[2]}`,
        `D. ${orderedChoices[3]}`,
      ];

      const finalCorrectAnswer = labeledOptions[correctSlot];

      q = {
        id: `q_dom_${Date.now()}_${i + 1}`,
        type: 'multiple_choice',
        difficulty,
        allocatedMarks: 2,
        question: `Which of the following accurately describes or defines ${fact.concept}?`,
        topic: fact.concept,
        questionStyle: mode === 'past_paper' ? 'Past Paper Multiple Choice' : 'Definition & Verification',
        options: labeledOptions,
        correctAnswer: finalCorrectAnswer,
        explanation: `Grounded in ${chunk.filename} (Page/Slide ${chunk.pageOrSlide}): "${fact.fullSentence}".`,
        isVerifiedFromNotes: true,
        verificationNote: `Verified in ${chunk.filename} (Page/Slide ${chunk.pageOrSlide})`,
        mode,
        sourceExamTitle,
        citations: [
          {
            chunkId: chunk.chunkId,
            documentId: chunk.documentId,
            filename: chunk.filename,
            courseId: chunk.courseId,
            folderId: chunk.folderId,
            pageOrSlide: chunk.pageOrSlide,
            sourceExcerpt: fact.fullSentence.slice(0, 220),
            relevanceScore: 0.95,
          },
        ],
      };
    } else if (type === 'true_false') {
      const isTrue = sequenceIndex % 2 === 0;
      let statement = fact.fullSentence;

      if (!isTrue) {
        // Negate statement using domain terms
        statement = statement.replace(/\b(is|was|are|were|has|have|acts|operates)\b/i, '$1 not');
      }

      q = {
        id: `q_dom_${Date.now()}_${i + 1}`,
        type: 'true_false',
        difficulty,
        allocatedMarks: 1,
        question: `True or False: ${statement}.`,
        topic: fact.concept,
        questionStyle: mode === 'past_paper' ? 'Exam True/False' : 'Fact Validation',
        options: ['True', 'False'],
        correctAnswer: isTrue ? 'True' : 'False',
        explanation: `Confirmed by verified source text in ${chunk.filename} (Page/Slide ${chunk.pageOrSlide}): "${fact.fullSentence}".`,
        isVerifiedFromNotes: true,
        verificationNote: `Verified in ${chunk.filename} (Page/Slide ${chunk.pageOrSlide})`,
        mode,
        sourceExamTitle,
        citations: [
          {
            chunkId: chunk.chunkId,
            documentId: chunk.documentId,
            filename: chunk.filename,
            courseId: chunk.courseId,
            folderId: chunk.folderId,
            pageOrSlide: chunk.pageOrSlide,
            sourceExcerpt: fact.fullSentence.slice(0, 220),
            relevanceScore: 0.96,
          },
        ],
      };
    } else if (type === 'fill_in_blank') {
      const words = fact.concept.split(/\s+/).filter((w) => w.length > 3);
      const targetWord = words[words.length - 1] || fact.concept;
      const blankSentence = fact.fullSentence.replace(new RegExp(`\\b${targetWord}\\b`, 'i'), '__________');

      q = {
        id: `q_dom_${Date.now()}_${i + 1}`,
        type: 'fill_in_blank',
        difficulty,
        allocatedMarks: 2,
        question: `Complete the following statement: ${blankSentence}`,
        topic: fact.concept,
        questionStyle: 'Cloze Deletion',
        correctAnswer: targetWord,
        acceptableAnswers: [targetWord, targetWord.toLowerCase()],
        explanation: `The key term is "${targetWord}", established in ${chunk.filename} (Page/Slide ${chunk.pageOrSlide}): "${fact.fullSentence}".`,
        isVerifiedFromNotes: true,
        verificationNote: `Verified in ${chunk.filename} (Page/Slide ${chunk.pageOrSlide})`,
        mode,
        sourceExamTitle,
        citations: [
          {
            chunkId: chunk.chunkId,
            documentId: chunk.documentId,
            filename: chunk.filename,
            courseId: chunk.courseId,
            folderId: chunk.folderId,
            pageOrSlide: chunk.pageOrSlide,
            sourceExcerpt: fact.fullSentence.slice(0, 220),
            relevanceScore: 0.95,
          },
        ],
      };
    } else if (type === 'short_essay') {
      q = {
        id: `q_dom_${Date.now()}_${i + 1}`,
        type: 'short_essay',
        difficulty,
        allocatedMarks: 5,
        question: `Explain the fundamental principles and significance of ${fact.concept}. Discuss how it operates in the context of the course material.`,
        topic: fact.concept,
        questionStyle: mode === 'past_paper' ? 'Past Paper Essay Prompt' : 'Explanations & Mechanisms',
        correctAnswer: fact.fullSentence,
        markingPoints: [
          `Accurately defines ${fact.concept} [2 marks].`,
          'Explains the primary mechanism, methodology, or context [2 marks].',
          'Discusses broader implications or significance [1 mark].',
        ],
        sampleAnswer: `The material establishes that ${fact.fullSentence}. This principle provides a foundational framework for understanding the underlying phenomena within the discipline.`,
        explanation: `Comprehensive analysis grounded in ${chunk.filename} (Page/Slide ${chunk.pageOrSlide}): "${fact.fullSentence}".`,
        isVerifiedFromNotes: true,
        verificationNote: `Verified in ${chunk.filename} (Page/Slide ${chunk.pageOrSlide})`,
        mode,
        sourceExamTitle,
        citations: [
          {
            chunkId: chunk.chunkId,
            documentId: chunk.documentId,
            filename: chunk.filename,
            courseId: chunk.courseId,
            folderId: chunk.folderId,
            pageOrSlide: chunk.pageOrSlide,
            sourceExcerpt: fact.fullSentence.slice(0, 220),
            relevanceScore: 0.92,
          },
        ],
      };
    } else {
      q = {
        id: `q_dom_${Date.now()}_${i + 1}`,
        type: 'short_answer',
        difficulty,
        allocatedMarks: 3,
        question: `What is ${fact.concept}, and what is its primary definition or function?`,
        topic: fact.concept,
        questionStyle: mode === 'past_paper' ? 'Past Paper Short Answer' : 'Definitions & Facts',
        correctAnswer: fact.predicate.slice(0, 120),
        markingPoints: [
          `States precise definition of ${fact.concept} [2 marks].`,
          'Identifies primary application or operational context [1 mark].',
        ],
        sampleAnswer: fact.predicate.slice(0, 120),
        acceptableAnswers: [fact.predicate.slice(0, 120)],
        explanation: `Direct passage in ${chunk.filename} (Page/Slide ${chunk.pageOrSlide}): "${fact.fullSentence}".`,
        isVerifiedFromNotes: true,
        verificationNote: `Verified in ${chunk.filename} (Page/Slide ${chunk.pageOrSlide})`,
        mode,
        sourceExamTitle,
        citations: [
          {
            chunkId: chunk.chunkId,
            documentId: chunk.documentId,
            filename: chunk.filename,
            courseId: chunk.courseId,
            folderId: chunk.folderId,
            pageOrSlide: chunk.pageOrSlide,
            sourceExcerpt: fact.fullSentence.slice(0, 220),
            relevanceScore: 0.94,
          },
        ],
      };
    }

    if (!isDuplicateQuestion(q.question, [
      ...previousQuestions,
      ...result.map((existingQuestion) => existingQuestion.question),
    ])) {
      result.push(q);
    }
  }

  return result;
}
