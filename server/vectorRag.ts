import { cosineSimilarity, generateDeterministicEmbedding, generateEmbedding } from './ai.js';
import { db } from './db.js';
import { DocumentChunk, RagRetrieveResponse, RetrievalResult } from './types.js';

export interface RetrieveOptions {
  courseId: string;
  folderId?: string | null | 'all';
  ownerId?: string;
  query: string;
  topK?: number;
  forceLexical?: boolean;
  selectedDocumentIds?: string[];
}

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were',
  'will', 'with', 'what', 'when', 'where', 'which', 'who', 'why', 'how', 'does',
  'this', 'these', 'those', 'explain', 'describe', 'tell', 'show', 'summarize'
]);

export async function retrieveChunks(options: RetrieveOptions): Promise<RagRetrieveResponse> {
  const {
    courseId,
    folderId = 'all',
    ownerId,
    query,
    topK = 5,
    forceLexical = false,
    selectedDocumentIds,
  } = options;

  // 1. Strict Scope Filtering
  let candidateChunks = db.data.chunks.filter((c) => c.courseId === courseId);

  if (selectedDocumentIds && selectedDocumentIds.length > 0) {
    candidateChunks = candidateChunks.filter((c) => selectedDocumentIds.includes(c.documentId));
  }

  if (ownerId) {
    candidateChunks = candidateChunks.filter((c) => c.ownerId === ownerId);
  }

  if (folderId !== 'all') {
    if (folderId === null || folderId === 'null') {
      candidateChunks = candidateChunks.filter((c) => c.folderId === null);
    } else {
      candidateChunks = candidateChunks.filter((c) => c.folderId === folderId);
    }
  }

  const totalChunksInScope = candidateChunks.length;

  if (totalChunksInScope === 0) {
    return {
      results: [],
      matchType: 'hybrid',
      retrievalMethod: 'hybrid_fusion',
      usedFallback: false,
      totalChunksInScope: 0,
    };
  }

  // 2. Prepare Lexical Tokens from Query (Strictly Content-Focused)
  const cleanQuery = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const queryTokens = cleanQuery
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  
  // Full phrase for exact match detection
  const normalizedQuery = cleanQuery.replace(/\s+/g, ' ').trim();

  // 3. Dense Vector Embeddings
  const hasEmbeddings = candidateChunks.some((c) => c.embedding && c.embedding.length > 0);
  let queryEmbedding: number[] | null = null;
  let usedVector = false;

  if (!forceLexical && hasEmbeddings) {
    queryEmbedding = await generateEmbedding(query);
    if (!queryEmbedding) {
      queryEmbedding = generateDeterministicEmbedding(query);
    }
    if (queryEmbedding) {
      usedVector = true;
    }
  }

  // 4. Score Each Chunk Using Hybrid Fusion (Verbatim Text Passages, Never Topic Labels)
  const scored: RetrievalResult[] = candidateChunks.map((chunk) => {
    const chunkTextLower = chunk.text.toLowerCase();
    
    // A. Vector Semantic Score
    let vectorSim = 0;
    if (usedVector && queryEmbedding && chunk.embedding) {
      vectorSim = cosineSimilarity(queryEmbedding, chunk.embedding);
    }

    // B. Content Lexical Score (BM25-style frequency saturation & exact matching)
    let lexicalHits = 0;
    const matchedKeywords: string[] = [];
    for (const token of queryTokens) {
      if (chunkTextLower.includes(token)) {
        lexicalHits++;
        matchedKeywords.push(token);
      }
    }

    const tokenRatio = queryTokens.length > 0 ? lexicalHits / queryTokens.length : 0;
    // Exact phrase match bonus
    const hasExactPhrase = normalizedQuery.length > 10 && chunkTextLower.includes(normalizedQuery);
    const exactPhraseBonus = hasExactPhrase ? 0.35 : 0;

    const lexicalScore = Math.min(1.0, tokenRatio * 0.8 + (lexicalHits > 0 ? 0.15 : 0) + exactPhraseBonus);

    // C. Hybrid Score Synthesis
    let combinedScore = 0;
    if (usedVector && !forceLexical) {
      // 60% semantic embedding + 40% keyword precision
      combinedScore = vectorSim * 0.6 + lexicalScore * 0.4;
      if (hasExactPhrase) combinedScore = Math.min(1.0, combinedScore + 0.15);
    } else {
      combinedScore = lexicalScore;
    }

    // D. Extract the Most Relevant Verbatim Sentence from the Chunk Passage
    const sentences = chunk.text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 10);
    let bestSentence = sentences[0] || chunk.text.slice(0, 200);
    let bestSentenceHits = 0;

    for (const sentence of sentences) {
      const sLower = sentence.toLowerCase();
      let sHits = 0;
      for (const token of queryTokens) {
        if (sLower.includes(token)) sHits++;
      }
      if (sHits > bestSentenceHits) {
        bestSentenceHits = sHits;
        bestSentence = sentence.trim();
      }
    }

    const relevantExcerpt = bestSentence.slice(0, 240);

    return {
      chunk,
      score: Math.round(combinedScore * 100) / 100,
      matchType: usedVector && !forceLexical ? 'hybrid' : 'lexical',
      retrievalMethod: usedVector && !forceLexical ? 'hybrid_fusion' : 'lexical_fallback',
      relevantExcerpt: relevantExcerpt || chunk.sourceExcerpt,
      matchedKeywords,
    };
  });

  // Sort descending by relevance score
  scored.sort((a, b) => b.score - a.score);
  const topResults = scored.slice(0, topK);

  return {
    results: topResults,
    matchType: usedVector && !forceLexical ? 'hybrid' : 'lexical',
    retrievalMethod: usedVector && !forceLexical ? 'hybrid_fusion' : 'lexical_fallback',
    usedFallback: !usedVector || forceLexical,
    fallbackReason: forceLexical ? 'forced_lexical' : !usedVector ? 'no_embeddings_available' : undefined,
    matchedKeywords: queryTokens,
    totalChunksInScope,
  };
}
