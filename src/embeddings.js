/**
 * Pure-JS TF-IDF semantic similarity engine.
 *
 * Drop-in replacement for the @xenova/transformers pipeline.
 * Zero external dependencies — no WASM, no network, no async model loading.
 * Initialization takes < 10ms for 15 products.
 *
 * Interface is intentionally compatible with the original embeddings.js
 * so matcher.js and App.jsx require minimal changes.
 */

// Domain stop words: filter out noise terms for the glass industry corpus
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'for', 'in', 'of', 'to', 'with', 'is', 'are',
  'it', 'its', 'this', 'that', 'be', 'as', 'at', 'by', 'from', 'on', 'up',
  'per', 'sqm', 'mm', 'cm', 'rs', 'inr', 'which', 'also', 'can', 'been',
]);

/** Tokenize and normalize a text string into clean terms */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s+]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/**
 * Build the TF-IDF corpus index from a list of document strings.
 * Returns a { idf } object that acts as the "pipeline" throughout this codebase.
 *
 * @param {string[]} documentTexts - Raw text for each product (from productToText)
 * @returns {Promise<{ idf: Object }>} TF-IDF index
 */
export async function getEmbeddingPipeline(documentTexts = []) {
  const N = documentTexts.length || 1;
  const allTokens = documentTexts.map(tokenize);

  const idf = {};
  const vocab = new Set(allTokens.flat());

  for (const term of vocab) {
    // Smoothed IDF: log((N+1)/(df+1)) + 1
    const df = allTokens.filter((tokens) => tokens.includes(term)).length;
    idf[term] = Math.log((N + 1) / (df + 1)) + 1;
  }

  return { idf };
}

/**
 * Serialize a product into a combined text string for TF-IDF embedding.
 * Covers all semantically relevant fields: name, category, specs, description.
 *
 * @param {Object} product
 * @returns {string}
 */
export function productToText(product) {
  return [
    product.name,
    product.category,
    product.description,
    `${product.thickness}mm`,
    `coating ${product.coating}`,
    `certification ${product.certification}`,
    `color ${product.color}`,
    `edge ${product.edgeFinish}`,
    `price ${product.pricePerSqm}`,
  ].join(' ');
}

/**
 * Compute a TF-IDF weighted sparse vector for a given text.
 * Uses an IDF floor (log 2) for out-of-vocabulary query terms.
 *
 * @param {{ idf: Object }} pipe  - Index returned from getEmbeddingPipeline
 * @param {string}          text  - Input text to vectorize
 * @returns {Promise<Object>}     Sparse vector: { term → tfidf_weight }
 */
export async function embedText(pipe, text) {
  const tokens = tokenize(text);
  const tf = {};
  for (const t of tokens) tf[t] = (tf[t] || 0) + 1;

  const maxFreq = Math.max(...Object.values(tf), 1);
  const vec = {};
  for (const t in tf) {
    // IDF floor of log(2) ≈ 0.693 for unseen query terms (gives them some weight)
    vec[t] = (tf[t] / maxFreq) * (pipe.idf[t] || Math.log(2));
  }
  return vec;
}

/**
 * Cosine similarity between two sparse TF-IDF vectors.
 *
 * @param {Object} a - Sparse vector { term → weight }
 * @param {Object} b - Sparse vector { term → weight }
 * @returns {number} Similarity in [0, 1]
 */
export function cosineSimilarity(a, b) {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (const t in a) {
    magA += a[t] * a[t];
    if (b[t]) dot += a[t] * b[t];
  }
  for (const t in b) {
    magB += b[t] * b[t];
  }

  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
