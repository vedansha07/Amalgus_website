import { products } from './products';
import { embedText, cosineSimilarity } from './embeddings';

/**
 * AmalGus Intelligent Matching Engine — 3-Stage Pipeline
 *
 * Stage 1 │ Hard Filters    — category, certification, price, thickness
 * Stage 2 │ Vector Search   — cosine similarity via @xenova/all-MiniLM-L6-v2 → top 8
 * Stage 3 │ LLM Re-ranking  — Groq llama-3.3-70b-versatile → matchScore, matchReason, highlightedAttributes
 *
 * @param {string}      query              — Buyer's natural language requirement
 * @param {Object}      filters            — Hard filter values from the UI sidebar
 * @param {Object|null} embeddingPipe      — @xenova/transformers pipeline (null = skip vector stage)
 * @param {Object|null} productEmbeddings  — Map of { productId: number[] }   (null = skip vector stage)
 * @param {string|null} apiKey             — Groq API key (falls back to VITE_GROQ_API_KEY)
 * @returns {Promise<Array>}               — Enriched, ranked product objects
 */
export async function findMatches(
  query,
  filters = {},
  embeddingPipe = null,
  productEmbeddings = null,
  apiKey = null
) {
  const resolvedApiKey = apiKey || import.meta.env.VITE_GROQ_API_KEY;

  if (!resolvedApiKey) {
    throw new Error(
      'Groq API key is missing. Please add VITE_GROQ_API_KEY to your .env file.'
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Stage 1: Hard Filters
  //   Narrow the full catalog using exact-match constraints from the sidebar.
  //   This reduces token usage and improves LLM focus in Stage 3.
  // ─────────────────────────────────────────────────────────────────────────
  const filteredProducts = products.filter((product) => {
    if (
      filters.category &&
      filters.category !== 'All' &&
      product.category !== filters.category
    )
      return false;

    if (
      filters.certification &&
      filters.certification !== 'All' &&
      product.certification !== filters.certification
    )
      return false;

    if (filters.maxPrice && product.pricePerSqm > filters.maxPrice)
      return false;

    // Explicit undefined check — avoids falsy-0 bug where minThickness=0 was skipping the guard
    if (
      filters.minThickness !== undefined &&
      filters.minThickness > 0 &&
      product.thickness < filters.minThickness
    )
      return false;

    if (
      filters.maxThickness !== undefined &&
      filters.maxThickness > 0 &&
      product.thickness > filters.maxThickness
    )
      return false;

    return true;
  });

  if (filteredProducts.length === 0) return [];

  // ─────────────────────────────────────────────────────────────────────────
  // Stage 2: Semantic Vector Search (optional — skipped on first load)
  //   Embeds the buyer query and computes cosine similarity against
  //   pre-computed product embeddings. Returns top 8 candidates for LLM.
  //   Falls back gracefully to all filtered products if embeddings unavailable.
  // ─────────────────────────────────────────────────────────────────────────
  let candidates = filteredProducts;

  if (embeddingPipe && productEmbeddings) {
    try {
      const queryEmbedding = await embedText(embeddingPipe, query);

      const scored = filteredProducts
        .filter((p) => productEmbeddings[p.id]) // only include products that have been embedded
        .map((p) => ({
          product: p,
          similarity: cosineSimilarity(queryEmbedding, productEmbeddings[p.id]),
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 8); // top 8 → sent to LLM for final re-ranking

      candidates = scored.map((s) => s.product);
      console.log(
        `[Matcher] Vector search selected top ${candidates.length} of ${filteredProducts.length} filtered products`
      );
    } catch (err) {
      console.warn(
        '[Matcher] Vector search failed — falling back to all filtered products:',
        err
      );
      candidates = filteredProducts;
    }
  } else {
    console.log('[Matcher] Embeddings not ready — skipping vector stage');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Stage 3: LLM Re-ranking via Groq
  //   Sends the semantically pre-ranked candidate list to the LLM with the
  //   buyer's original query. The LLM assigns a matchScore (0-100),
  //   writes a human-readable matchReason, and lists highlightedAttributes.
  // ─────────────────────────────────────────────────────────────────────────
  const payloadProducts = candidates.map(
    ({
      id,
      name,
      category,
      thickness,
      width,
      height,
      color,
      coating,
      certification,
      edgeFinish,
      pricePerSqm,
      supplier,
      description,
      inStock,
    }) => ({
      id,
      name,
      category,
      thickness,
      width,
      height,
      color,
      coating,
      certification,
      edgeFinish,
      pricePerSqm,
      supplier,
      description,
      inStock,
    })
  );

  const systemPrompt = `You are an expert glass industry product matching assistant for an Indian B2B/B2C marketplace. Given a buyer requirement and a list of glass products (already pre-filtered and semantically ranked), return a JSON array of the top 4-5 best matches. Each match must have: id (string), matchScore (integer 0-100), matchReason (2-3 sentences explaining why this product fits the buyer's needs), highlightedAttributes (array of 2-4 key matching attributes as short strings). Return ONLY valid JSON. No markdown, no explanation, no code fences.`;

  const userPrompt = `Buyer Query: "${query}"

Available Products (pre-ranked by semantic similarity — favor those listed earlier):
${JSON.stringify(payloadProducts, null, 2)}`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resolvedApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1, // Low temperature for factual, reproducible JSON
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Groq API Error: ${response.status} — ${
        errorData.error?.message || 'Unknown error'
      }`
    );
  }

  const data = await response.json();
  let content = data.choices[0].message.content.trim();

  // Strip markdown code fences if the model disobeys the system prompt
  content = content
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/\s*```$/, '')
    .trim();

  const matchesData = JSON.parse(content);

  if (!Array.isArray(matchesData)) {
    throw new Error(
      'Expected a JSON array from the LLM but received something else.'
    );
  }

  // Enrich each match with full product data and sort by LLM-assigned score
  const enriched = matchesData
    .map((match) => {
      const product = candidates.find((p) => p.id === match.id);
      if (!product) return null; // Guard against hallucinated IDs
      return {
        ...product,
        matchScore: match.matchScore,
        matchReason: match.matchReason,
        highlightedAttributes: match.highlightedAttributes || [],
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.matchScore - a.matchScore);

  return enriched;
}
