import { extractContent } from './materialProcessing.js';
import { PastPaper, PastPaperQuestionStructure, QuestionType } from './types.js';

export async function processPastPaperFile(
  filename: string,
  mimeType: string,
  buffer?: Buffer,
  textPayload?: string,
  precomputedBase64?: string
): Promise<{ text: string; questions: PastPaperQuestionStructure[]; pageCount: number; year?: string; term?: string }> {
  // Extract text using the multi-format pipeline (PDF, DOCX, PPTX, Images, Text)
  const extracted = await extractContent(filename, mimeType, buffer, textPayload, precomputedBase64);
  const text = extracted.fullText;

  const { questions, year, term } = parsePastPaperText(text, filename);

  return {
    text,
    questions,
    pageCount: extracted.pageCount,
    year,
    term,
  };
}

export function parsePastPaperText(
  text: string,
  filename: string
): { questions: PastPaperQuestionStructure[]; year?: string; term?: string } {
  const questions: PastPaperQuestionStructure[] = [];

  // Year detection
  const yearMatch = text.match(/\b(20[12]\d)\b/);
  const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();

  // Term detection
  let term = 'Final Examination';
  if (/midterm/i.test(text) || /mid-term/i.test(text)) term = 'Midterm Examination';
  else if (/spring/i.test(text)) term = 'Spring Examination';
  else if (/fall/i.test(text)) term = 'Fall Examination';
  else if (/summer/i.test(text)) term = 'Summer Assessment';

  const lines = text.split('\n');
  let currentQ: Partial<PastPaperQuestionStructure> | null = null;
  let currentSection = 'General Section';
  let page = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (/page\s+(\d+)/i.test(line) || /\[page\s+(\d+)\]/i.test(line)) {
      const pMatch = line.match(/(?:page\s+|\[page\s+)(\d+)/i);
      if (pMatch) page = parseInt(pMatch[1], 10);
      else page++;
      continue;
    }

    if (/^(?:section|part)\s+([a-z0-9]+)[:\s-]*(.*)/i.test(line)) {
      currentSection = line;
      continue;
    }

    // Match question headers e.g. "Question 1", "1.", "1(a)", "Q1:"
    const qMatch = line.match(/^(?:question\s+(\d+[a-z]?)|(\d+[a-z]?)\.|\(?([0-9]+[a-z]?)\)|Q(\d+):?)[:.)]?\s*(.*)/i);

    if (qMatch) {
      if (currentQ && currentQ.prompt) {
        questions.push(finalizeQuestion(currentQ));
      }

      const qNum = qMatch[1] || qMatch[2] || qMatch[3] || qMatch[4] || `${questions.length + 1}`;
      const rest = qMatch[5] || '';

      currentQ = {
        questionNumber: qNum,
        section: currentSection,
        prompt: rest,
        sourcePage: page,
      };
    } else if (currentQ) {
      const markMatch = line.match(/\[(\d+)\s*(?:marks?|pts?)\]|\((\d+)\s*(?:marks?|pts?)\)/i);
      if (markMatch) {
        currentQ.allocatedMarks = parseInt(markMatch[1] || markMatch[2], 10);
      }
      currentQ.prompt = (currentQ.prompt ? currentQ.prompt + ' ' : '') + line;
    }
  }

  if (currentQ && currentQ.prompt) {
    questions.push(finalizeQuestion(currentQ));
  }

  // Do not invent questions from ordinary paragraphs. If numbering is not recognised,
  // return zero extracted questions so the UI can ask for a clearer/text-readable paper.

  return { questions, year, term };
}

function finalizeQuestion(q: Partial<PastPaperQuestionStructure>): PastPaperQuestionStructure {
  let type: QuestionType = 'short_answer';
  const prompt = (q.prompt || '').trim();

  if (/explain|discuss|describe|contrast|compare|evaluate|analyze/i.test(prompt) || (q.allocatedMarks && q.allocatedMarks >= 4)) {
    type = 'short_essay';
  } else if (/which of the following|options:|a\)|b\)/i.test(prompt)) {
    type = 'multiple_choice';
  } else if (/true\s+or\s+false/i.test(prompt)) {
    type = 'true_false';
  } else if (/fill\s+in|complete the sentence/i.test(prompt)) {
    type = 'fill_in_blank';
  }

  // Extract original multiple-choice options when they are embedded in the extracted text.
  // Keep the stem and option text intact, but render choices as separate selectable options.
  let cleanPrompt = prompt;
  let options: string[] | undefined;
  const optionStart = prompt.search(/(?:^|\s)\(?A\)?[.)]\s+/i);
  if (optionStart >= 0) {
    const optionTail = prompt.slice(optionStart).trim();
    const optionMatches = [...optionTail.matchAll(/(?:^|\s)\(?([A-D])\)?[.)]\s*/gi)];
    if (optionMatches.length >= 2) {
      const parsedOptions = optionMatches.map((match, index) => {
        const start = (match.index || 0) + match[0].length;
        const end = index + 1 < optionMatches.length ? (optionMatches[index + 1].index || optionTail.length) : optionTail.length;
        return optionTail.slice(start, end).trim();
      }).filter(Boolean);
      if (parsedOptions.length >= 2 && parsedOptions.length <= 4) {
        options = parsedOptions;
        cleanPrompt = prompt.slice(0, optionStart).trim() || prompt;
        type = 'multiple_choice';
      }
    }
  }

  return {
    questionNumber: q.questionNumber || '1',
    section: q.section || 'General Questions',
    type,
    prompt: cleanPrompt,
    options,
    allocatedMarks: q.allocatedMarks || (type === 'short_essay' ? 5 : 2),
    markingGuide: q.markingGuide || 'Award full marks for clear conceptual mastery.',
    sourcePage: q.sourcePage || 1,
  };
}
