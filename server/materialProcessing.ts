import { PDFParse } from 'pdf-parse';
import JSZip from 'jszip';
import { getGenAI, generateDeterministicEmbedding, generateEmbedding } from './ai.js';
import { db } from './db.js';
import { DocumentChunk, Material } from './types.js';

export interface ExtractedSegment {
  text: string;
  pageOrSlide: number;
}

export interface ExtractedDocumentContent {
  fullText: string;
  segments: ExtractedSegment[];
  pageCount: number;
}

export function formatExtractionError(err: unknown, defaultMessage: string): string {
  if (err instanceof Error) {
    try {
      const parsed = JSON.parse(err.message);
      if (parsed?.error?.message) {
        return parsed.error.message;
      }
    } catch {
      // Not JSON
    }
    return err.message;
  }
  return String(err) || defaultMessage;
}

/**
 * Robust extraction pipeline supporting PDF, DOCX, PPTX, Images (OCR via Gemini Vision), and Text/Markdown.
 */
export async function extractContent(
  filename: string,
  mimeType: string,
  buffer?: Buffer,
  textPayload?: string,
  precomputedBase64?: string
): Promise<ExtractedDocumentContent> {
  const lower = filename.toLowerCase();

  // 1. Text / Markdown / Plain text payload
  if (textPayload && (!buffer || buffer.length === 0)) {
    return parseTextIntoSegments(textPayload);
  }

  if (!buffer || buffer.length === 0) {
    if (textPayload) return parseTextIntoSegments(textPayload);
    throw new Error('No file buffer or text payload provided');
  }

  // 2. PDF Extraction
  if (lower.endsWith('.pdf') || mimeType === 'application/pdf') {
    try {
      // Validate PDF magic bytes (%PDF-) to prevent sending corrupt non-PDF streams to OCR
      const headerIndex = buffer.indexOf('%PDF-');
      if (headerIndex === -1 || headerIndex > 1024) {
        throw new Error('Invalid or corrupted PDF file. The file does not contain a standard PDF header (%PDF-).');
      }

      let rawPdfText = '';
      const segments: ExtractedSegment[] = [];
      let pageCount = 1;

      try {
        const parser = new (PDFParse as any)({ data: buffer });
        const parsed = await parser.getText();
        await parser.destroy();
        rawPdfText = parsed?.text || '';
        if (parsed?.pages && Array.isArray(parsed.pages) && parsed.pages.length > 0) {
          pageCount = parsed.total || parsed.pages.length || 1;
          for (const p of parsed.pages) {
            const pText = (p.text || '').trim();
            if (pText.length > 10) {
              segments.push({ text: pText, pageOrSlide: p.num || 1 });
            }
          }
        }
      } catch (pdfErr) {
        console.warn('[PDF] Parser exception:', pdfErr);
      }

      // Check if PDF contained actual digital text
      if (rawPdfText.trim().length >= 40) {
        const validSegments = segments.length > 0 ? segments : [{ text: rawPdfText.trim(), pageOrSlide: 1 }];
        return {
          fullText: rawPdfText.trim(),
          segments: validSegments,
          pageCount: Math.max(pageCount, validSegments.length),
        };
      }

      // If text is suspiciously short (< 40 chars), it's a scanned PDF. Fallback to Gemini OCR if key available
      const ai = getGenAI();
      if (ai) {
        console.log(`[OCR] Scanned PDF detected for ${filename}. Executing Gemini multimodal OCR...`);
        try {
          const base64Data = precomputedBase64 || buffer.toString('base64');
          const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: [
              {
                inlineData: {
                  mimeType: 'application/pdf',
                  data: base64Data,
                },
              },
              {
                text: 'Perform complete, verbatim OCR on this scanned PDF document. Extract all textual passages, formulas, tables, definitions, and notes verbatim. Precede each page with [Page N]. Do not summarize.',
              },
            ],
          });

          const ocrText = response.text || '';
          if (ocrText.trim().length > 20) {
            return parseTextIntoSegments(ocrText);
          }
        } catch (ocrErr) {
          console.warn('[PDF OCR] Vision extraction failed:', ocrErr);
          throw new Error('Unable to OCR scanned PDF. The document may be corrupted, password-protected, or unsupported.');
        }
      }

      // If no OCR available, throw a clear explanatory error
      throw new Error('PDF contains scanned images with no embedded text layer. Please configure GEMINI_API_KEY for vision OCR.');
    } catch (err: unknown) {
      const msg = formatExtractionError(err, 'Failed to extract text from PDF.');
      throw new Error(`PDF extraction error: ${msg}`);
    }
  }

  // 3. PowerPoint Presentation (.pptx, .ppsx, .ppt)
  if (lower.endsWith('.ppt') && !lower.endsWith('.pptx')) {
    try {
      const ai = getGenAI();
      if (ai) {
        try {
          const base64Data = precomputedBase64 || buffer.toString('base64');
          const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: [
              {
                inlineData: {
                  mimeType: 'application/vnd.ms-powerpoint',
                  data: base64Data,
                },
              },
              {
                text: 'Extract all textual lecture content, slide titles, bullet points, formulas, and notes from this PowerPoint presentation verbatim. Format each slide starting with [Slide N].',
              },
            ],
          });
          const text = response.text || '';
          if (text.trim().length > 20) {
            return parseTextIntoSegments(text);
          }
        } catch (e) {
          console.warn('[PPT] Gemini extraction fallback for legacy .ppt:', e);
        }
      }

      // Binary stream extraction for text runs
      const extractedRuns: string[] = [];
      const utf16Str = buffer.toString('utf16le');
      const matches16 = utf16Str.match(/[\w\s.,;:!?'"()\-]{8,}/g);
      if (matches16) extractedRuns.push(...matches16);

      const latin1Str = buffer.toString('latin1');
      const matchesLatin1 = latin1Str.match(/[A-Za-z0-9\s.,;:!?'"()\-]{10,}/g);
      if (matchesLatin1) extractedRuns.push(...matchesLatin1);

      const filtered = extractedRuns
        .map((s) => s.trim())
        .filter((s) => s.length > 12 && !s.includes('PowerPoint Document') && !s.includes('Current User'))
        .slice(0, 150);

      if (filtered.length > 0) {
        const fullText = filtered.join('\n\n');
        return parseTextIntoSegments(fullText);
      }
      throw new Error('Could not parse legacy binary .ppt. Please convert to modern .pptx or PDF.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`PowerPoint (.ppt) extraction error: ${msg}`);
    }
  }

  if (lower.endsWith('.pptx') || lower.endsWith('.ppsx') || lower.endsWith('.pptm') || mimeType.includes('presentation')) {
    try {
      const zip = await JSZip.loadAsync(buffer);
      // Find all slide XML files
      const slideFileNames = Object.keys(zip.files).filter((k) =>
        /^ppt\/slides\/slide\d+\.xml$/i.test(k)
      );

      // Sort numerically by slide number
      slideFileNames.sort((a, b) => {
        const numA = parseInt(a.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
        const numB = parseInt(b.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
        return numA - numB;
      });

      const segments: ExtractedSegment[] = [];

      for (const sf of slideFileNames) {
        const slideNum = parseInt(sf.match(/slide(\d+)\.xml/i)?.[1] || '1', 10);
        const xml = await zip.file(sf)?.async('text');
        if (!xml) continue;

        // Extract all text inside <a:t>...</a:t>
        const matches = Array.from(xml.matchAll(/<a:t[^>]*>([^<]+)<\/a:t>/g), (m) => m[1]);
        const slideText = matches.join(' ').replace(/\s+/g, ' ').trim();

        if (slideText.length > 5) {
          segments.push({
            text: `[Slide ${slideNum}] ${slideText}`,
            pageOrSlide: slideNum,
          });
        }
      }

      if (segments.length > 0) {
        const fullText = segments.map((s) => s.text).join('\n\n');
        return {
          fullText,
          segments,
          pageCount: segments.length,
        };
      }

      throw new Error('No readable slide text found in PowerPoint presentation.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`PowerPoint extraction error: ${msg}`);
    }
  }

  // 4. Word Document (.docx, .docm)
  if (lower.endsWith('.docx') || lower.endsWith('.docm') || mimeType.includes('wordprocessingml')) {
    try {
      const zip = await JSZip.loadAsync(buffer);
      const docXml = await zip.file('word/document.xml')?.async('text');
      if (!docXml) throw new Error('word/document.xml not found in archive');

      // Split by paragraphs </w:p>
      const rawParagraphs = docXml.split(/<\/w:p>/gi);
      const segments: ExtractedSegment[] = [];
      let currentPage = 1;
      let pageTextAcc = '';

      for (const p of rawParagraphs) {
        // Check for page break elements
        if (p.includes('w:type="page"') || p.includes('<w:lastRenderedPageBreak/>')) {
          if (pageTextAcc.trim().length > 20) {
            segments.push({ text: pageTextAcc.trim(), pageOrSlide: currentPage });
            pageTextAcc = '';
          }
          currentPage++;
        }

        const tRuns = Array.from(p.matchAll(/<w:t[^>]*>([^<]+)<\/w:t>/g), (m) => m[1]);
        const paragraphText = tRuns.join('').trim();
        if (paragraphText) {
          pageTextAcc += (pageTextAcc ? '\n' : '') + paragraphText;
        }

        // If a page has accumulated > 1200 characters without explicit break, split logically
        if (pageTextAcc.length > 1200) {
          segments.push({ text: pageTextAcc.trim(), pageOrSlide: currentPage++ });
          pageTextAcc = '';
        }
      }

      if (pageTextAcc.trim().length > 0) {
        segments.push({ text: pageTextAcc.trim(), pageOrSlide: currentPage });
      }

      if (segments.length > 0) {
        const fullText = segments.map((s) => s.text).join('\n\n');
        return {
          fullText,
          segments,
          pageCount: segments.length,
        };
      }

      throw new Error('No readable text paragraphs found in Word document.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Word document extraction error: ${msg}`);
    }
  }

  // 5. Images & Scans (OCR via Gemini Vision)
  if (
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.webp') ||
    mimeType.startsWith('image/')
  ) {
    const ai = getGenAI();
    if (!ai) {
      throw new Error('Image & scan OCR requires GEMINI_API_KEY. Please provide an API key in Settings > Secrets or upload text/PDF/Word/PPTX files.');
    }

    try {
      console.log(`[OCR] Executing Gemini vision OCR for ${filename}...`);
      const base64Data = precomputedBase64 || buffer.toString('base64');
      const resolvedMime = mimeType && mimeType.startsWith('image/') ? mimeType : 'image/png';

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            inlineData: {
              mimeType: resolvedMime,
              data: base64Data,
            },
          },
          {
            text: 'Perform complete, high-fidelity OCR on this study material image or scan. Transcribe all text, formulas, diagrams, labels, and notes verbatim. Do not summarize or invent text.',
          },
        ],
      });

      const ocrText = response.text || '';
      if (!ocrText.trim()) {
        throw new Error('OCR completed but no readable text was detected in the image.');
      }

      return parseTextIntoSegments(ocrText);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Image OCR error: ${msg}`);
    }
  }

  // 6. Default Plain Text / Markdown / Code / JSON / CSV
  const utf8Text = buffer.toString('utf-8');
  return parseTextIntoSegments(utf8Text);
}

/**
 * Strips non-educational metadata, timestamps, copyright disclaimers, file paths,
 * watermark notices, and presentation template noise from document text.
 */
/**
 * Strips non-educational metadata, timestamps, copyright disclaimers, file paths,
 * author metadata, and presentation template noise from document text.
 */
export function sanitizeEducationalContent(rawText: string): string {
  if (!rawText) return '';
  let cleaned = rawText;

  // 1. Remove copyright disclaimers and legal notices
  cleaned = cleaned.replace(/(?:copyright|©|\(c\))\s*(?:\d{4}|[^\n.,;]+?)(?:all\s+rights\s+reserved|reproduction\s+prohibited|proprietary|confidential)?/gi, '');
  cleaned = cleaned.replace(/all\s+rights\s+reserved[.,]?(?:\s*no\s+part\s+of\s+this\s+publication[^\n]+)?/gi, '');

  // 2. Remove document metadata headers: Author, Title, Prepared by, Lecturer
  cleaned = cleaned.replace(/^(?:author|by|written\s+by|lecturer|professor|instructor|prepared\s+by|edited\s+by)[:\s]+[^\n]+/gim, '');
  cleaned = cleaned.replace(/^(?:title|subject|module|unit|chapter\s+\d+)[:\s]+[^\n]+/gim, '');

  // 3. Remove file path references, URLs, and upload/download audit logs
  cleaned = cleaned.replace(/(?:downloaded|uploaded|accessed|printed|generated)\s+(?:on|at|by)\s+[^\n.,;]+/gi, '');
  cleaned = cleaned.replace(/(?:[a-zA-Z]:\\|\/)[^\s\n]+\.(?:pdf|docx|pptx|txt|html|png|jpg)/gi, '');
  cleaned = cleaned.replace(/https?:\/\/[^\s\n]+/gi, '');

  // 4. Remove slide/page templates and presentation noise
  cleaned = cleaned.replace(/click\s+to\s+(?:add|edit)\s+(?:title|text|subtitle|notes)/gi, '');
  cleaned = cleaned.replace(/master\s+slide|slide\s+master|presentation\s+title/gi, '');
  cleaned = cleaned.replace(/page\s+\d+\s+of\s+\d+/gi, '');
  cleaned = cleaned.replace(/(?:confidential\s+and\s+proprietary|for\s+internal\s+use\s+only)/gi, '');

  // 5. Remove standalone timestamp patterns (e.g. 2024-10-12 14:23:45)
  cleaned = cleaned.replace(/\b\d{4}[-/.]\d{2}[-/.]\d{2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:AM|PM|UTC|GMT))?)?\b/gi, '');

  // 6. Clean excess whitespace and filter lines
  const lines = cleaned
    .split('\n')
    .map((l) => l.trim())
    .filter((line) => {
      if (line.length === 0) return false;
      if (/^\d+$/.test(line)) return false;
      if (/^(?:page|slide)\s+\d+$/i.test(line)) return false;
      // Filter out isolated slide template labels
      if (/^(?:slidemaster|template|v\d+\.\d+|presentation)$/i.test(line)) return false;
      return true;
    });

  return lines.join('\n').trim();
}

/**
 * Recognizes essential educational verbs that indicate real conceptual statements,
 * definitions, principles, or processes rather than isolated titles or labels.
 */
const SUBSTANTIVE_VERB_REGEX = /\b(is|are|was|were|has|have|had|be|been|refers?|defined?|means?|consists?|composed|includes?|contains?|causes?|operates?|functions?|acts?|serves?|pumps?|passes?|drives?|generates?|creates?|produces?|binds?|forms?|transports?|releases?|converts?|yields?|moves?|leads?|established|developed|discovered|proposed|investigated|pioneered|formulated|argued|rejected|demonstrated|synthesizes?|catalyzes?|regulates?|enables?|transfers?|requires?|allocates?|manages?|known\s+as|studied|analyzes?|explores?)\b/i;

/**
 * Checks whether text contains substantive educational content (real concepts/definitions/facts)
 * rather than just a document title, filename, metadata, or trivial whitespace.
 * Never treats a document title alone as sufficient educational evidence.
 */
export function isSubstantiveEducationalContent(text: string): boolean {
  const sanitized = sanitizeEducationalContent(text);
  if (sanitized.length < 35) return false;
  const words = sanitized.split(/\s+/).filter((w) => w.length > 1);
  if (words.length < 6) return false;

  // Must contain at least one educational predicate/verb
  return SUBSTANTIVE_VERB_REGEX.test(sanitized);
}

/**
 * Splits plain text / markdown into structured segments with pageOrSlide numbering.
 */
function parseTextIntoSegments(text: string): ExtractedDocumentContent {
  const cleanText = text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
  if (!cleanText) {
    return { fullText: '', segments: [], pageCount: 0 };
  }

  const rawSegments: ExtractedSegment[] = [];

  // 1. Check for explicit slide/page indicators like [Slide N], [Page N], or ---
  if (cleanText.includes('---') || /\[(?:Slide|Page)\s+\d+\]/i.test(cleanText) || /Page\s+\d+:/i.test(cleanText)) {
    const rawParts = cleanText.split(/(?:---|\[(?:Slide|Page)\s+(\d+)\]|Page\s+(\d+):?)/gi);
    let pageNum = 1;

    for (let i = 0; i < rawParts.length; i++) {
      const part = rawParts[i];
      if (!part) continue;

      // If it's a captured number
      if (/^\d+$/.test(part.trim())) {
        pageNum = parseInt(part.trim(), 10);
        continue;
      }

      const trimmed = part.trim();
      if (trimmed.length > 25) {
        rawSegments.push({ text: trimmed, pageOrSlide: pageNum++ });
      }
    }
  }

  // 2. Paragraph segmentation
  if (rawSegments.length === 0) {
    const paragraphs = cleanText.split(/\n\s*\n/);
    let currentChunk = '';
    let page = 1;

    for (const para of paragraphs) {
      const p = para.trim();
      if (!p) continue;

      if ((currentChunk + '\n\n' + p).length > 800) {
        if (currentChunk.trim()) {
          rawSegments.push({ text: currentChunk.trim(), pageOrSlide: page });
          if (rawSegments.length % 2 === 0) page++;
        }
        currentChunk = p;
      } else {
        currentChunk = currentChunk ? currentChunk + '\n\n' + p : p;
      }
    }
    if (currentChunk.trim()) {
      rawSegments.push({ text: currentChunk.trim(), pageOrSlide: page });
    }
  }

  if (rawSegments.length === 0) {
    rawSegments.push({ text: cleanText.slice(0, 1500), pageOrSlide: 1 });
  }

  // Sanitize each segment: exclude noise, metadata, and non-substantive fragments
  const sanitizedSegments: ExtractedSegment[] = [];
  for (const seg of rawSegments) {
    const sanitized = sanitizeEducationalContent(seg.text);
    if (isSubstantiveEducationalContent(sanitized)) {
      sanitizedSegments.push({
        text: sanitized,
        pageOrSlide: seg.pageOrSlide,
      });
    }
  }

  // Return only sanitized segments that contain substantive educational content
  return {
    fullText: cleanText,
    segments: sanitizedSegments,
    pageCount: Math.max(1, sanitizedSegments.length),
  };
}

/**
 * Indexes material passages, generating dense vector embeddings and recording chunks.
 */
export async function processAndIndexMaterial(
  material: Material,
  extracted: ExtractedDocumentContent
): Promise<DocumentChunk[]> {
  const { fullText, segments } = extracted;

  // Filter segments for substantive educational content
  const substantiveSegments = segments.filter((s) => isSubstantiveEducationalContent(s.text));

  if (substantiveSegments.length === 0 || !fullText.trim()) {
    material.status = 'error';
    material.statusMessage = 'Failed: No substantive educational text passages could be extracted from this document (only titles or metadata found).';
    material.chunkCount = 0;
    material.hasEmbeddings = false;
    material.updatedAt = new Date().toISOString();
    db.data.chunks = db.data.chunks.filter((c) => c.documentId !== material.id);
    db.save();
    return [];
  }

  material.status = 'indexing_vectors';
  material.statusMessage = 'Indexing vector embeddings…';
  db.save();

  const chunks: DocumentChunk[] = [];

  for (let i = 0; i < substantiveSegments.length; i++) {
    const seg = substantiveSegments[i];
    const chunkId = `chk_${material.id}_${i + 1}`;
    const tokenEstimate = Math.round(seg.text.length / 4);

    // Extract high-yield excerpt for citations
    const sentences = seg.text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 15);
    const sourceExcerpt = (sentences[0] || seg.text).slice(0, 220);

    // Try real Gemini embedding first, otherwise fallback to deterministic 768-dim vector
    let embedding = await generateEmbedding(seg.text);
    if (!embedding) {
      embedding = generateDeterministicEmbedding(seg.text);
    }

    const chunkObj: DocumentChunk = {
      chunkId,
      documentId: material.id,
      filename: material.filename,
      courseId: material.courseId,
      folderId: material.folderId,
      ownerId: material.ownerId,
      pageOrSlide: seg.pageOrSlide,
      chunkIndex: i,
      text: seg.text,
      sourceExcerpt,
      embedding,
      tokenEstimate,
    };

    chunks.push(chunkObj);
  }

  // Replace existing chunks for this material
  db.data.chunks = db.data.chunks.filter((c) => c.documentId !== material.id);
  db.data.chunks.push(...chunks);

  // Update material record
  material.chunkCount = chunks.length;
  material.extractedTextLength = fullText.length;
  material.hasEmbeddings = chunks.length > 0;
  material.status = 'ready';
  material.statusMessage = `Vector Indexed (${chunks.length} chunks)`;
  material.updatedAt = new Date().toISOString();

  db.save();
  return chunks;
}
