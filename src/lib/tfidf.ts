// TF-IDF based Local Vector Space Embeddings for RAG
// This creates numerical vector embeddings for each chunk and computes cosine similarity.

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2);
}

export interface VocabularyInfo {
  vocab: string[];
  idf: Record<string, number>;
}

// Generate vocabulary and IDF for a collection of chunks
export function buildVocabulary(contents: string[]): VocabularyInfo {
  const allTokens = contents.map(c => tokenize(c));
  const vocabSet = new Set<string>();
  allTokens.forEach(tokens => tokens.forEach(t => vocabSet.add(t)));
  const vocab = Array.from(vocabSet);

  const idf: Record<string, number> = {};
  const N = contents.length;

  vocab.forEach(term => {
    const df = allTokens.filter(tokens => tokens.includes(term)).length;
    // Standard TF-IDF IDF formula
    idf[term] = Math.log(1 + (N - df + 0.5) / (df + 0.5));
  });

  return { vocab, idf };
}

// Create an embedding vector (number[]) for a single document
export function getTFIDFVector(tokens: string[], vocab: string[], idf: Record<string, number>): number[] {
  const tf: Record<string, number> = {};
  tokens.forEach(t => {
    tf[t] = (tf[t] || 0) + 1;
  });

  const vector = vocab.map(term => {
    const termTF = tf[term] || 0;
    const termIDF = idf[term] || 0;
    return termTF * termIDF;
  });

  // Normalize the vector (L2 norm) so cosine similarity is just the dot product
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (magnitude === 0) return new Array(vocab.length).fill(0);
  return vector.map(val => val / magnitude);
}

// Compute cosine similarity between two normalized vectors
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
  }
  return dotProduct;
}

// Precompute embeddings for all chunks
export function embedChunks(chunks: { section: string; content: string }[]): {
  chunks: { section: string; content: string; embedding: number[] }[];
  vocabInfo: VocabularyInfo;
} {
  const contents = chunks.map(c => c.content);
  const vocabInfo = buildVocabulary(contents);
  const embeddedChunks = chunks.map(chunk => {
    const tokens = tokenize(chunk.content);
    const embedding = getTFIDFVector(tokens, vocabInfo.vocab, vocabInfo.idf);
    return { ...chunk, embedding };
  });

  return { chunks: embeddedChunks, vocabInfo };
}
