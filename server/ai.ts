import { GoogleGenAI } from '@google/genai';

let aiInstance: GoogleGenAI | null = null;

export function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiInstance;
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const ai = getGenAI();
  if (!ai) return null;

  try {
    const cleanText = text.slice(0, 8000).trim();
    if (!cleanText) return null;

    const response = await Promise.race([
      ai.models.embedContent({
        model: 'gemini-embedding-2-preview',
        contents: cleanText,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Embedding request timeout')), 4000)
      ),
    ]);
    
    // In @google/genai SDK, embeddings are returned in response.embeddings[0].values
    const values = response?.embeddings?.[0]?.values || (response as any)?.embedding?.values;
    if (values && Array.isArray(values) && values.length > 0) {
      return values;
    }
    return null;
  } catch (err) {
    console.warn('[Gemini AI] embedContent failed/timed out, using deterministic embedding fallback:', err);
    return null;
  }
}

export function generateDeterministicEmbedding(text: string, dimensions = 3072): number[] {
  // Enhanced deterministic local feature representation matching 3072 dimensions
  const vec = new Array(dimensions).fill(0);
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);

  if (words.length === 0) {
    vec[0] = 1;
    return vec;
  }

  // Word unigrams and bigrams for lexical/semantic coverage
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let h1 = 5381;
    for (let j = 0; j < word.length; j++) {
      h1 = ((h1 << 5) + h1) ^ word.charCodeAt(j);
    }
    const idx1 = Math.abs(h1) % dimensions;
    vec[idx1] += 1.0;

    // Word bigram
    if (i < words.length - 1) {
      const bigram = `${word}_${words[i + 1]}`;
      let h2 = 5381;
      for (let j = 0; j < bigram.length; j++) {
        h2 = ((h2 << 5) + h2) ^ bigram.charCodeAt(j);
      }
      const idx2 = Math.abs(h2) % dimensions;
      vec[idx2] += 1.5;
    }
  }

  // L2 normalize
  let norm = 0;
  for (let i = 0; i < dimensions; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) {
      vec[i] /= norm;
    }
  }

  return vec;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0) return 0;

  // If dimensions match exactly (standard path)
  if (a.length === b.length) {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    if (denom === 0) return 0;
    return Math.max(0, Math.min(1, dot / denom));
  }

  // Handle mismatched dimensions (e.g. legacy 768 vs 3072) by comparing on common prefix
  const minLen = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < minLen; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return Math.max(0, Math.min(1, dot / denom));
}

export async function generateGroundedContent(options: {
  prompt: string;
  responseMimeType?: string;
  temperature?: number;
}): Promise<string | null> {
  const ai = getGenAI();
  if (!ai) return null;

  // Use gemini-3.8-flash as primary recommended model, with gemini-3.1-flash-lite as fallback
  const candidateModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];

  for (const model of candidateModels) {
    // Attempt with retry on temporary demand spikes (503 / 429)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) {
          // Brief backoff before retry
          await new Promise((r) => setTimeout(r, 800));
        }

        // Gemini 3.8 Flash uses the model's default sampling behaviour.
        // Google’s current migration guidance removes temperature/top-p/top-k
        // from Gemini 3.8 requests; retain temperature only for the fallback model.
        const generationConfig = {
          responseMimeType: options.responseMimeType,
          ...(model === 'gemini-3.8-flash'
            ? {}
            : { temperature: options.temperature ?? 0.2 }),
        };

        const response = await Promise.race([
          ai.models.generateContent({
            model,
            contents: options.prompt,
            config: generationConfig,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout calling ${model}`)), 15000)
          ),
        ]);

        let text = response?.text;
        if (text && text.trim().length > 0) {
          text = text.trim();
          // Strip accidental markdown fences if JSON was requested
          if (options.responseMimeType === 'application/json' && text.startsWith('```')) {
            text = text.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
          }
          return text;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const isTransient = msg.includes('503') || msg.includes('429') || msg.includes('high demand') || msg.includes('ResourceExhausted');
        console.warn(`[Gemini AI] Model ${model} (attempt ${attempt + 1}) note:`, msg.slice(0, 120));
        if (!isTransient && attempt === 0) {
          // Non-transient error, break to next model
          break;
        }
      }
    }
  }

  return null;
}
