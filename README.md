# AmalGus Glass Marketplace Prototype

An intelligent, AI-powered B2B and B2C marketplace allowing users to discover specific glass products and related hardware through natural language queries.

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite |
| Styling | Tailwind CSS v4, Custom Design System |
| Vector Search | Pure-JS TF-IDF Semantic Indexing |
| AI Re-ranking | Groq API (llama-3.3-70b-versatile) |
| Icons | Lucide React |

## Setup Instructions

1. Install Dependencies
   ```bash
   npm install
   ```

2. Configure Environment Variables
   Create a `.env` file in the root directory and add a valid Groq API key:
   ```env
   VITE_GROQ_API_KEY=your_groq_api_key_here
   ```

3. Start the Development Server
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:5173`.

## Intelligent Matching Architecture

The application utilizes a high-performance 3-stage hybrid search pipeline to ensure both accuracy and speed in product discovery.

```
User Query
    |
    v
+---------------------------------+
| Stage 1: Hard Filters           |
| Category, Certification, Price, |
| Min/Max Thickness constraints   |
+---------------------------------+
    | (Reduces dataset)
    v
+---------------------------------+
| Stage 2: TF-IDF Vector Search   |
| Pure-JS term frequency analysis |
| Cosine similarity evaluation    |
| Outputs top candidates          |
+---------------------------------+
    | (Filters to top matches)
    v
+---------------------------------+
| Stage 3: LLM Re-ranking         |
| Groq LLM evaluates candidates   |
| Assigns exact matchScore        |
| Generates matchReason           |
| Extracts highlightedAttributes  |
+---------------------------------+
    |
    v
 Final Result Rendered in UI
```

### Purpose of the 3-Stage Pipeline
1. **Hard Filtering**: Instantly removes incompatible products, reducing context size for subsequent stages.
2. **Vector Search**: Identifies semantically related products based on domain-specific terminology overlapping, handling variations in phrasing without needing exact string matches. Implemented via pure-JS TF-IDF to avoid heavy WASM loads in the browser.
3. **LLM Re-ranking**: Adds sophisticated human-readable reasoning to the matches and provides a highly accurate percentage-based compatibility score.

## Key Design Decisions and Trade-offs

| Decision | Rationale |
|---|---|
| TF-IDF over Neural Embeddings | For a 15-product dataset, pure-JS TF-IDF initializes in under 10ms with zero external dependencies, resolving WebAssembly (WASM) compatibility issues present in typical browser ONNX setups. |
| Client-side Architecture | Driven by prototype velocity. The Groq API is called directly from the frontend. In a production environment, this would be proxied through a secure backend server. |
| Mock Dataset | Utilizes 15 hyper-realistic Indian market glass specifications, as live supplier API integratons fall outside the scope of the prototype phase. |

## Feature Set Highlight

- **Dynamic Query Suggestions**: Contextual autocomplete options surface once string character thresholds are met, mapped against common industry use-cases.
- **Explainable AI Matching**: Each product card renders a dynamically generated badge categorizing the nature of the match (e.g., Best Overall, Budget Match, Use Case Match) based on the LLM's rationale.
- **Editorial UI Elements**: Features dark-mode glassmorphic styling, variable fonts (Syne and Inter), and subtle micro-animations to convey a premium marketplace experience.

## Testing the Engine

To evaluate the pipeline, we recommend inputting complete requirement statements into the primary search interface. 

Examples:
- "6mm tempered glass for office partitions, polished edges, clear"
- "Thick acoustic glass for extreme noise reduction in a high traffic home"
- "Affordable double glazed unit for a commercial building project"
- "Heavy duty shop storefront glass requiring maximum safety certifications"
