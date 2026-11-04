import { generateGroundedContent } from './ai.js';
import { extractContent } from './materialProcessing.js';
import { PastPaperQuestionStructure, QuestionType } from './types.js';

const VALID_QUESTION_TYPES: QuestionType[] = [
  'multiple_choice',
  'true_false',
  'fill_in_blank',
  'short_answer',
  'short_essay',
];

function normalizePaperText(value: string): string {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function questionIdentity(question: PastPaperQuestionStructure): string {
  return [
    question.sourcePage || 0,
    normalizePaperText(question.section || ''),
    normalizePaperText(question.questionNumber || ''),
  ].join('|');
}

/**
 * Combines deterministic and AI-assisted extraction without losing repeated
 * exam items. A repeated prompt with a different number/section/page is a
 * distinct printed question, not a duplicate to be discarded.
 */
export function mergePastPaperQuestions(
  primary: PastPaperQuestionStructure[],
  supplemental: PastPaperQuestionStructure[],
): PastPaperQuestionStructure[] {
  const merged = new Map<string, PastPaperQuestionStructure>();
  for (const question of primary) merged.set(questionIdentity(question), question);
  for (const question of supplemental) {
    const key = questionIdentity(question);
    if (!merged.has(key)) merged.set(key, question);
  }
  return [...merged.values()].sort((left, right) => {
    const pageDifference = (left.sourcePage || 0) - (right.sourcePage || 0);
    if (pageDifference !== 0) return pageDifference;
    return String(left.questionNumber).localeCompare(String(right.questionNumber), undefined, { numeric: true, sensitivity: 'base' });
  });
}

function inferQuestionType(prompt: string, options?: string[]): QuestionType {
  if (options && options.length >= 2) return 'multiple_choice';
  if (/\btrue\s*(?:or|\/)\s*false\b/i.test(prompt)) return 'true_false';
  if (/\b(fill in|complete the sentence|supply the missing word)\b/i.test(prompt)) return 'fill_in_blank';
  if (/\b(discuss|explain|evaluate|compare|contrast|analyse|analyze|justify|illustrate)\b/i.test(prompt)) {
    return 'short_essay';
  }
  return 'short_answer';
}

function parseJsonArray(responseText: string): any[] {
  const cleaned = String(responseText || '')
    .trim()
    .replace(/^\u0060\u0060\u0060(?:json)?\s*/i, '')
    .replace(/\u0060\u0060\u0060\s*$/i, '');
  const parsed = JSON.parse(cleaned);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.questions)) return parsed.questions;
  return [];
}

/**
 * Normalizes AI-extracted question structures but accepts them only when the
 * original question wording is demonstrably present in the uploaded paper.
 * The AI may organize OCR text; it must never invent or rewrite an exam item.
 */
export function normalizeAIExtractedPastPaperQuestions(
  payload: unknown,
  sourceText: string
): PastPaperQuestionStructure[] {
  let rows: any[] = [];
  try {
    rows = typeof payload === 'string' ? parseJsonArray(payload) : Array.isArray(payload)
      ? payload
      : payload && typeof payload === 'object' && Array.isArray((payload as any).questions)
        ? (payload as any).questions
        : [];
  } catch {
    return [];
  }

  const normalizedSource = normalizePaperText(sourceText);
  if (!normalizedSource) return [];

  const output: PastPaperQuestionStructure[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const prompt = String(row.prompt || row.question || '').trim();
    const sourceQuote = String(row.sourceQuote || row.sourceText || '').trim();
    const normalizedPrompt = normalizePaperText(prompt);
    const normalizedQuote = normalizePaperText(sourceQuote);
    const questionNumber = String(row.questionNumber || row.number || output.length + 1).trim();
    const section = String(row.section || 'General Section').trim();
    const markValue = Number(row.allocatedMarks ?? row.marks);
    const pageValue = Number(row.sourcePage ?? row.page);
    const sourcePage = Number.isFinite(pageValue) && pageValue > 0 ? Math.floor(pageValue) : undefined;
    const identity = [sourcePage || 0, normalizePaperText(section), normalizePaperText(questionNumber)].join('|');

    if (prompt.length < 8 || !normalizedPrompt || !normalizedQuote) continue;
    // Exact normalized source matching prevents generated or paraphrased prompts.
    if (!normalizedSource.includes(normalizedQuote) || !normalizedQuote.includes(normalizedPrompt)) continue;
    if (seen.has(identity)) continue;

    const rawOptions = Array.isArray(row.options)
      ? row.options.map((option: unknown) => String(option || '').trim()).filter(Boolean)
      : [];
    const verifiedOptions = rawOptions.length >= 2 && rawOptions.length <= 6 &&
      rawOptions.every((option: string) => normalizePaperText(sourceQuote).includes(normalizePaperText(option)))
      ? rawOptions
      : undefined;

    const typeValue = String(row.type || '').toLowerCase() as QuestionType;
    const type = verifiedOptions
      ? 'multiple_choice'
      : VALID_QUESTION_TYPES.includes(typeValue)
        ? typeValue
        : inferQuestionType(prompt);

    output.push({
      questionNumber,
      section,
      type,
      prompt,
      options: verifiedOptions,
      allocatedMarks: Number.isFinite(markValue) && markValue > 0 ? Math.min(100, Math.floor(markValue)) : (type === 'short_essay' ? 5 : 2),
      markingGuide: 'Award marks for a correct answer that addresses the original examination prompt.',
      sourcePage,
    });
    seen.add(identity);
  }

  return output;
}

function buildAIExtractionPrompt(sourceText: string): string {
  return `You are extracting the actual questions from a student's uploaded past examination paper.
Your task is transcription and structure extraction, NOT question generation.

Return a JSON array. Each item must contain:
questionNumber, section, type, prompt, options, allocatedMarks, sourcePage, sourceQuote.

Rules:
- Copy the question wording exactly as it appears in the source. Do not paraphrase, summarize, correct grammar, or invent missing words.
- Extract every clearly identifiable main question and sub-question in the order it appears.
- Keep each sub-question as its own item when it has its own answer requirement or marks.
- Keep MCQ answer options separate in their original order and wording.
- Include marks only when visible in the source.
- The supplied text is labelled with [Page N] markers. Set sourcePage for every extracted question to the page where that question begins; do not leave it blank when the marker is available.
- Include marks only when visible in the source.
- sourceQuote MUST be one contiguous verbatim excerpt from the supplied text containing the complete question prompt and any options returned for it. It is used to verify that the item really exists in the paper.
- If a line is unreadable or a question cannot be confidently separated from instructions, omit it rather than guessing.
- Do not solve or answer any question.
- Return [] if there are no actual questions.
- Return valid JSON only, without Markdown fences or commentary.

PAST PAPER TEXT:
${sourceText}`;
}

function makeExtractionBatches(
  segments: Array<{ text: string; pageOrSlide: number }>,
  maxChars = 12000
): Array<{ sourceText: string; pageNumbers: number[] }> {
  const batches: Array<{ sourceText: string; pageNumbers: number[] }> = [];
  let currentText = '';
  let currentPages: number[] = [];

  const flush = () => {
    if (currentText.trim()) {
      batches.push({ sourceText: currentText.trim(), pageNumbers: [...new Set(currentPages)] });
    }
    currentText = '';
    currentPages = [];
  };

  for (const segment of segments) {
    const lines = String(segment.text || '').split(/\r?\n/);
    let pageBuffer = '';
    for (const line of lines) {
      if (pageBuffer.length + line.length + 1 > maxChars && pageBuffer.trim()) {
        const pageText = `[Page ${segment.pageOrSlide}]\n${pageBuffer.trim()}`;
        if (currentText.length + pageText.length > maxChars) flush();
        currentText += (currentText ? '\n\n' : '') + pageText;
        currentPages.push(segment.pageOrSlide);
        flush();
        pageBuffer = '';
      }
      pageBuffer += (pageBuffer ? '\n' : '') + line;
    }
    if (pageBuffer.trim()) {
      const pageText = `[Page ${segment.pageOrSlide}]\n${pageBuffer.trim()}`;
      if (currentText.length + pageText.length > maxChars) flush();
      currentText += (currentText ? '\n\n' : '') + pageText;
      currentPages.push(segment.pageOrSlide);
    }
  }
  flush();
  return batches;
}

async function extractQuestionsWithAI(
  segments: Array<{ text: string; pageOrSlide: number }>
): Promise<PastPaperQuestionStructure[]> {
  const batches = makeExtractionBatches(segments);
  const extracted: PastPaperQuestionStructure[] = [];

  // Limit concurrency to avoid overwhelming the model on multi-page exam papers.
  for (let offset = 0; offset < batches.length; offset += 2) {
    const responses = await Promise.all(batches.slice(offset, offset + 2).map(async (batch) => {
      try {
        const response = await generateGroundedContent({
          prompt: buildAIExtractionPrompt(batch.sourceText),
          responseMimeType: 'application/json',
          temperature: 0.1,
        });
        if (!response) return [];
        const rows = normalizeAIExtractedPastPaperQuestions(response, batch.sourceText);
        return rows.map((row) => ({
          ...row,
          sourcePage: row.sourcePage || batch.pageNumbers[0] || 1,
        }));
      } catch (error) {
        console.warn('[Past Papers] AI-assisted question extraction failed:', error);
        return [];
      }
    }));
    extracted.push(...responses.flat());
  }

  const seen = new Set<string>();
  return extracted.filter((question) => {
    const key = questionIdentity(question);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function processPastPaperFile(
  filename: string,
  mimeType: string,
  buffer?: Buffer,
  textPayload?: string,
  precomputedBase64?: string
): Promise<{ text: string; questions: PastPaperQuestionStructure[]; pageCount: number; year?: string; term?: string }> {
  // Reuse the same PDF, Word, PowerPoint, image and OCR pipeline as course materials.
  const extracted = await extractContent(filename, mimeType, buffer, textPayload, precomputedBase64);
  const text = extracted.fullText;
  const segments = extracted.segments.length > 0
    ? extracted.segments
    : [{ text, pageOrSlide: 1 }];
  const pageAwareText = segments
    .map((segment) => `[Page ${segment.pageOrSlide}]\n${segment.text}`)
    .join('\n\n');

  const metadata = parsePastPaperText(pageAwareText || text, filename);
  // Deterministic parsing is the baseline. AI-assisted extraction also reviews
  // every extracted page/slide so it can recover clearly printed sub-questions
  // the lightweight parser may not recognize. Its sourceQuote is checked
  // against the uploaded text before any supplemental item is accepted.
  let questions = metadata.questions;
  if (pageAwareText.trim().length >= 40) {
    const aiQuestions = await extractQuestionsWithAI(segments);
    questions = mergePastPaperQuestions(metadata.questions, aiQuestions);
  }

  return {
    text,
    questions,
    pageCount: extracted.pageCount,
    year: metadata.year,
    term: metadata.term,
  };
}

export function parsePastPaperText(
  text: string,
  filename: string
): { questions: PastPaperQuestionStructure[]; year?: string; term?: string } {
  const questions: PastPaperQuestionStructure[] = [];

  const yearMatch = text.match(/\b(20[12]\d)\b/);
  const year = yearMatch ? yearMatch[1] : undefined;

  let term = 'Final Examination';
  if (/mid\s*-?term/i.test(text)) term = 'Midterm Examination';
  else if (/spring/i.test(text)) term = 'Spring Examination';
  else if (/fall|autumn/i.test(text)) term = 'Fall Examination';
  else if (/summer/i.test(text)) term = 'Summer Assessment';

  const lines = text.split(/\r?\n/);
  let currentQ: Partial<PastPaperQuestionStructure> | null = null;
  let currentSection = 'General Section';
  let page = 1;

  const finishCurrent = () => {
    if (currentQ && String(currentQ.prompt || '').trim()) {
      questions.push(finalizeQuestion(currentQ));
    }
    currentQ = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const pageMatch = line.match(/^\[?page\s+(\d+)\]?$/i) || line.match(/^\[slide\s+(\d+)\]$/i);
    if (pageMatch) {
      page = parseInt(pageMatch[1], 10);
      continue;
    }

    if (/^(?:section|part)\s+([a-z0-9]+)[:\s-]*(.*)/i.test(line)) {
      finishCurrent();
      currentSection = line;
      continue;
    }

    const prefixedMatch = line.match(/^(?:question\s*(?:no\.?\s*)?|q\.?\s*)(\d+\s*(?:\([a-zivx]+\))?)\s*[:.)-]?\s*(.*)$/i);
    const numberedMatch = line.match(/^(\d+\s*\([a-zivx]+\)|\d+[a-z]?)[.)]\s*(.*)$/i);
    const subQuestionMatch = line.match(/^(\d+\s*\([a-zivx]+\))\s+(.+)$/i);
    const qMatch = prefixedMatch || numberedMatch || subQuestionMatch;

    if (qMatch) {
      finishCurrent();
      const qNum = qMatch[1].replace(/\s+/g, '');
      const prompt = qMatch[2] || qMatch[3] || '';
      currentQ = {
        questionNumber: qNum,
        section: currentSection,
        prompt,
        sourcePage: page,
      };
    } else if (currentQ) {
      const markMatch = line.match(/\[(\d+)\s*(?:marks?|pts?)\]|\((\d+)\s*(?:marks?|pts?)\)/i);
      if (markMatch) currentQ.allocatedMarks = parseInt(markMatch[1] || markMatch[2], 10);
      currentQ.prompt = (currentQ.prompt ? currentQ.prompt + ' ' : '') + line;
    }
  }

  finishCurrent();

  return { questions: deduplicateExtractedQuestions(questions), year, term };
}

function deduplicateExtractedQuestions(
  questions: PastPaperQuestionStructure[]
): PastPaperQuestionStructure[] {
  const seen = new Set<string>();
  return questions.filter((question) => {
    const key = questionIdentity(question);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function finalizeQuestion(q: Partial<PastPaperQuestionStructure>): PastPaperQuestionStructure {
  let type: QuestionType = 'short_answer';
  const prompt = (q.prompt || '').replace(/\s+/g, ' ').trim();
  const inlineMarks = prompt.match(/\[(\d+)\s*(?:marks?|pts?)\]|\((\d+)\s*(?:marks?|pts?)\)/i);
  const allocatedMarks = q.allocatedMarks || (inlineMarks ? parseInt(inlineMarks[1] || inlineMarks[2], 10) : undefined);

  if (/\b(explain|discuss|describe|contrast|compare|evaluate|analyse|analyze)\b/i.test(prompt) || (allocatedMarks && allocatedMarks >= 4)) {
    type = 'short_essay';
  } else if (/\btrue\s*(?:or|\/)\s*false\b/i.test(prompt)) {
    type = 'true_false';
  } else if (/\b(fill\s+in|complete the sentence)\b/i.test(prompt)) {
    type = 'fill_in_blank';
  }

  let cleanPrompt = prompt;
  let options: string[] | undefined;
  const optionPattern = /(?:^|\s)(?:\(([A-D])\)|([A-D])[.)])\s+/gi;
  const optionMatches = [...prompt.matchAll(optionPattern)];
  if (optionMatches.length >= 2) {
    const optionTailStart = optionMatches[0].index || 0;
    const optionTail = prompt.slice(optionTailStart).trim();
    const nestedMatches = [...optionTail.matchAll(/(?:^|\s)(?:\(([A-D])\)|([A-D])[.)])\s+/gi)];
    const parsedOptions = nestedMatches.map((match, index) => {
      const start = (match.index || 0) + match[0].length;
      const end = index + 1 < nestedMatches.length
        ? (nestedMatches[index + 1].index || optionTail.length)
        : optionTail.length;
      return optionTail.slice(start, end).trim();
    }).filter(Boolean);

    if (parsedOptions.length >= 2 && parsedOptions.length <= 6) {
      options = parsedOptions;
      cleanPrompt = prompt.slice(0, optionTailStart).trim() || prompt;
      type = 'multiple_choice';
    }
  }

  return {
    questionNumber: q.questionNumber || '1',
    section: q.section || 'General Questions',
    type,
    prompt: cleanPrompt,
    options,
    allocatedMarks: allocatedMarks || (type === 'short_essay' ? 5 : 2),
    markingGuide: 'Award marks for a correct answer that addresses the original examination prompt.',
    sourcePage: q.sourcePage || 1,
  };
}
