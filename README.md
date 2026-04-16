# AmalGus Smart Glass Discovery

> An intelligent, AI-powered B2B marketplace allowing users to discover the perfect glass products through natural language queries.

> **To run:** `npm install` → add `.env` → `npm run dev`

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 (via Vite) |
| Styling | Tailwind CSS v4 |
| Semantic Embeddings | `@xenova/transformers` — `Xenova/all-MiniLM-L6-v2` (384-dim, browser WASM) |
| AI Re-ranking | Groq API — `llama-3.3-70b-versatile` |
| Icons | Lucide React |

## 🚀 How to Run Locally

1. **Clone or Download the Repository**
2. **Install Dependencies**
   ```bash
   npm install
   ```
3. **Configure Environment Variables**
   Create a `.env` file in the root directory (or use the provided `.env.example` as a template) and add your Groq API key:
   ```env
   VITE_GROQ_API_KEY=your_groq_api_key_here
   ```
4. **Start the Development Server**
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:5173`.

## 🧠 How the Matching Works (3-Stage Pipeline)

The application uses a **3-stage hybrid pipeline** for accurate, efficient product discovery:

```
User Query
    │
    ▼
┌─────────────────────────────────┐
│ Stage 1: Hard Filters            │
│ Category, Certification, Price,  │
│ Min/Max Thickness → exact match  │
└─────────────────────────────────┘
    │ e.g. 15 products → 9 remain
    ▼
┌─────────────────────────────────┐
│ Stage 2: Vector Search           │
│ Embed query via                  │
│ Xenova/all-MiniLM-L6-v2 (WASM)  │
│ Cosine similarity vs products    │
│ → Top 8 semantic candidates     │
└─────────────────────────────────┘
    │ e.g. 9 products → top 8
    ▼
┌─────────────────────────────────┐
│ Stage 3: LLM Re-ranking          │
│ Top 8 + query sent to Groq       │
│ llama-3.3-70b-versatile assigns: │
│  • matchScore (0-100)            │
│  • matchReason (2-3 sentences)   │
│  • highlightedAttributes         │
└─────────────────────────────────┘
    │
    ▼
 Top 4-5 ranked results displayed
```

**Why 3 stages?** Hard filters eliminate incompatible products cheaply. Vector search finds semantically related products even when keywords don't match exactly (e.g., "soundproofing glass" → matches acoustic laminated). The LLM adds human-readable reasoning and a precise match score — things embeddings can't easily provide.

**Product embeddings** are pre-computed on app load using `Xenova/all-MiniLM-L6-v2` running entirely in the browser via ONNX Runtime Web (no server needed). They are cached in a `useRef` and reused for every subsequent query in the same session.

## 🤖 AI Tools Used

* **Architecture & Planning**: Claude 
* **Code Generation & Execution**: Google's Antigravity / Cursor

## ⚖️ Key Trade-offs

| Trade-off | Decision | Reason |
|---|---|---|
| No Vector DB | LLM handles semantic matching directly | Dataset is small (15 products); vector infra adds overhead with no benefit at this scale |
| Mock data only | 15 hyper-realistic Indian market products | No live supplier API is available for prototype |
| No auth / backend | Direct Groq call from frontend | Prototype velocity; production would proxy through a secure server |
| Hard filter before LLM | Narrow dataset pre-LLM | Reduces tokens, improves LLM focus and response quality |

## ✨ Bonus Features

* **Intelligent Query Suggestions**: Once a user types 10+ characters, a smart dropdown detects string matches against common building use-cases to suggest refined queries—requiring *zero* supplemental API calls.
* **Match Explainer Badges**: AI responses are translated visually. Each matched product receives a corner ribbon derived dynamically from the AI's logic (e.g. classifying it as a `"Best Overall"`, `"Budget Match"`, `"Use Case Match"`, or `"Spec Match"`).

## 💡 Example Queries to Try

We recommend typing these directly into the search bar:
* *"6mm tempered glass for office partitions, polished edges, clear"*
* *"Thick acoustic glass for extreme noise reduction in a high traffic home"*
* *"Affordable double glazed unit for a commercial building project"*
* *"Blue tinted facade glass with UV protection"*
* *"Heavy duty shop storefront glass requiring maximum safety certifications"*
