# চাকরির বাজার (Chakrir Bazar) — System Design Document

> **Scope:** Architecture, data flow, scaling strategy to 10,000 active users, cost model, and identified bottlenecks.

---

## 1. Executive Summary

চাকরির বাজার (Chakrir Bazar) is a stateless, serverless-first Next.js application that aggregates live job data from 7 external APIs, applies a local TF-IDF RAG engine over a user's parsed CV, and feeds retrieved context into Google Gemini 2.5 Flash for grounded career intelligence. All user state is currently persisted in `localStorage`; the scaling path replaces this with Supabase (Postgres + pgvector).

---

## 2. High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                           │
│                                                                    │
│   React 19 + Next.js App Router + React Context (AppState)        │
│                                                                    │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│   │Dashboard │  │AI Chat   │  │Job Search│  │Tracker + Roadmap │ │
│   │+ Nudges  │  │(RAG)     │  │(7 APIs)  │  │Kanban + Calendar │ │
│   └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
└────────────────────────────┬───────────────────────────────────────┘
                             │  HTTPS / fetch()
                             ▼
┌────────────────────────────────────────────────────────────────────┐
│                 Next.js Serverless API Layer (Vercel Edge)         │
│                                                                    │
│  /api/parse-cv     /api/analyze-cv    /api/generate-roadmap        │
│  /api/chat         /api/jobs                                       │
└──────┬──────────────────┬──────────────────────┬───────────────────┘
       │                  │                      │
       ▼                  ▼                      ▼
┌─────────────┐  ┌─────────────────┐  ┌──────────────────────────┐
│ File Parser │  │  Gemini 2.5     │  │   Job Aggregator         │
│             │  │  Flash API      │  │                          │
│ pdf-parse   │  │                 │  │  Serper  → Google Jobs   │
│ mammoth     │  │  /chat          │  │  Adzuna  → Global jobs   │
│             │  │  /analyze-cv    │  │  Remotive→ Remote jobs   │
│ → chunks    │  │  /generate-     │  │  Jobicy  → Remote jobs   │
│ → TF-IDF   │  │    roadmap      │  │  The Muse→ Culture jobs  │
│   vectors   │  │                 │  │  Reed    → UK jobs       │
└─────────────┘  └─────────────────┘  │  Upwork  → Freelance    │
                                       └──────────────────────────┘
```

---

## 3. Data Flow — CV Upload to AI Response

This is the most critical user path. Every downstream feature depends on it.

```
User uploads PDF/DOCX/TXT
         │
         ▼
/api/parse-cv (Next.js serverless)
         │
         ├─ PDF  → pdf-parse → raw text string
         ├─ DOCX → mammoth   → raw text string
         └─ TXT  → file.text() → raw text string
         │
         ▼
chunkCV(text)
  Split by section headers: Summary / Experience /
  Education / Skills / Projects / Certifications
  → CVChunk[]  { section: string, content: string }
         │
         ▼
embedChunks(rawChunks)  [src/lib/tfidf.ts]
  1. tokenize() — lowercase, strip punctuation, remove stopwords
  2. buildVocabulary() — compute IDF across all chunk contents
  3. getTFIDFVector() — per-chunk sparse TF-IDF float[]
  → CVChunk[] with .embedding: number[]
         │
         ▼
Return to client → stored in AppState.profile.cvChunks
         │
         ▼
On every chat message:
  /api/chat receives { message, cvChunks, chatHistory }
         │
         ▼
  1. buildVocabulary(allChunkContents)   — rebuild IDF
  2. getTFIDFVector(queryTokens)         — embed query
  3. cosineSimilarity(query, eachChunk)  — rank all chunks
  4. top-3 chunks by score              — selected context
         │
         ▼
  systemPrompt = CAREER_PILOT_PROMPT + top3ChunkText
  Gemini 2.5 Flash chat.sendMessage(userMessage)
         │
         ▼
  Grounded AI response returned to client
```

---

## 4. Data Flow — Job Search

```
User types: "Find me ML internships in Dhaka open this month"
         │
         ▼
/api/jobs POST { query, location, cvText, targetRole }
         │
         ▼
NLP Pre-parse (if query > 2 words or contains "in/near/open"):
  Gemini 2.5 Flash prompt → extracts:
  { roleKeywords: "ML Internship", location: "Dhaka" }
         │
         ▼
Promise.all([  ← all 7 sources fired in parallel
  searchSerper(role, location),   // Google Jobs index
  searchAdzuna(role, location),   // Global job board
  searchRemotive(role),           // Remote-specific
  searchJobicy(role),             // Remote-specific
  searchTheMuse(role, location),  // Culture-focused
  searchReed(role, location),     // UK market
  searchUpwork(role),             // Freelance/contract
])
         │
         ▼
For each job result → computeFitScore():
  techSkills[] intersection with cvText keywords
  → skillScore   (45% weight)
  → expScore     (30% weight) — role title word match
  → eduScore     (15% weight) — degree keyword detection
  → locationScore(10% weight) — remote/keyword/fallback
  → total (0–99), matchReasons[], gaps[]
         │
         ▼
Deduplication by title+company hash (Set<string>)
Sort by fitScore DESC
Return structured JobResult[] to client
```

---

## 5. Component Responsibilities

| Component | Responsibility | Key Dependencies |
|---|---|---|
| `src/lib/tfidf.ts` | Tokenization, IDF computation, TF-IDF vectors, cosine similarity | None (pure TS) |
| `src/lib/store.tsx` | Global AppState, reducer, localStorage persistence | React Context |
| `src/lib/types.ts` | All shared TypeScript interfaces | None |
| `src/lib/prompts.ts` | System prompt construction, CV context injection | None |
| `/api/parse-cv` | File ingestion, chunking, embedding | pdf-parse, mammoth, tfidf.ts |
| `/api/chat` | RAG retrieval + Gemini chat | tfidf.ts, Gemini SDK |
| `/api/jobs` | NLP parse + 7-source aggregation + fit scoring | Gemini SDK, 7 external APIs |
| `/api/analyze-cv` | Standalone AI CV review (score/strengths/gaps) | Gemini SDK |
| `/api/generate-roadmap` | Structured month/week/topic roadmap generation | Gemini SDK |

---

## 6. Scaling to 10,000 Active Users

### Current State (MVP)
- State lives in `localStorage` — single device, no auth, no cross-session persistence.
- TF-IDF embeddings rebuilt on every chat message — CPU bound but negligible at single-user scale.
- No caching layer — every job search hits all 7 APIs directly.

### Target State (10k Users)

#### 6.1 Authentication & Persistence Layer

Replace `localStorage` with **Supabase** (managed Postgres + Auth):

```sql
-- Users (Supabase Auth handles this)

-- CV chunks with pgvector embeddings
CREATE TABLE cv_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users NOT NULL,
  section     TEXT NOT NULL,
  content     TEXT NOT NULL,
  embedding   vector(384),   -- swap TF-IDF for text-embedding-3-small
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON cv_chunks USING hnsw (embedding vector_cosine_ops);

-- Applications (Kanban state)
CREATE TABLE applications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users NOT NULL,
  company      TEXT,
  role         TEXT,
  status       TEXT CHECK (status IN ('saved','applied','interviewing','offer','rejected')),
  applied_date TIMESTAMPTZ,
  notes        TEXT,
  url          TEXT,
  source       TEXT,
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- Goals
CREATE TABLE goals (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID REFERENCES auth.users NOT NULL,
  text     TEXT NOT NULL,
  deadline DATE,
  done     BOOLEAN DEFAULT FALSE
);

-- Roadmap progress
CREATE TABLE roadmap_topics (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID REFERENCES auth.users NOT NULL,
  topic_id  TEXT NOT NULL,  -- matches generated roadmap IDs
  completed BOOLEAN DEFAULT FALSE
);
```

#### 6.2 Caching Layer (Redis via Upstash)

Job search results are expensive (7 API calls per query) and largely identical for the same query string. Cache with 6-hour TTL:

```
Cache key: sha256(`${roleKeywords}:${location}`)
TTL: 6 hours
Hit rate at 10k users: ~60–70% (many users search similar roles)
```

This reduces external API calls from 70,000/day → ~25,000/day at 10k users doing 1 search/day.

#### 6.3 Connection Pooling

Vercel serverless functions spin up new instances per request. At 10k users:
- Without pooling: ~500 concurrent DB connections → Postgres OOM
- With **PgBouncer** (built into Supabase): pool of 15–20 connections serves all

#### 6.4 File Processing

Heavy PDFs (>5MB) can exhaust serverless function memory (1024MB default). Fix:
- Move `/api/parse-cv` to a dedicated Vercel Function with `maxDuration: 60` and `memory: 3008`
- Or offload to a background queue (Inngest / Trigger.dev) for async processing

### Scaling Summary

| Component | Current (1 user) | At 10k Users |
|---|---|---|
| State | localStorage | Supabase Postgres |
| Embeddings | In-memory TF-IDF | pgvector (text-embedding-3-small) |
| Job search | 7 live API calls | Redis cache (6h TTL) + fallback |
| Auth | None | Supabase Auth (Google OAuth) |
| DB connections | None | PgBouncer connection pooling |
| File processing | Synchronous serverless | Async queue for large files |
| Hosting | Vercel Hobby | Vercel Pro ($20/mo) |

---

## 7. Cost Estimation — 10,000 Active Users/Month

**Assumptions:** Each user uploads CV once/month, does 15 job searches, sends 40 chat messages, generates 1 roadmap.

### LLM Costs (Gemini 2.5 Flash)

| Operation | Tokens/User | Rate | Cost/User/Month |
|---|---|---|---|
| Chat (40 msg × 2,500 input tokens) | 100,000 input | $0.075/1M | $0.0075 |
| Chat (40 msg × 400 output tokens) | 16,000 output | $0.30/1M | $0.0048 |
| NLP query parse (15 searches × 300 tokens) | 4,500 input | $0.075/1M | $0.00034 |
| Roadmap generation (1 × 3,000 tokens) | 3,000 input | $0.075/1M | $0.000225 |
| CV analysis (1 × 2,000 tokens) | 2,000 input | $0.075/1M | $0.00015 |
| **LLM Total** | | | **~$0.013/user** |

### External Search APIs

| API | Usage/User/Month | Cost |
|---|---|---|
| Serper.dev | 15 calls | $0.015 (at $50/50k plan) |
| Adzuna | 15 calls | Free tier covers up to 5k/month |
| Remotive, Jobicy, The Muse | 15 calls each | Free (no key required) |
| **Search Total** | | **~$0.015/user** |

### Infrastructure

| Service | Plan | Monthly Cost | Per-User at 10k |
|---|---|---|---|
| Vercel (hosting) | Pro | $20 | $0.002 |
| Supabase (Postgres) | Pro | $25 | $0.0025 |
| Upstash Redis (cache) | Pay-per-use | ~$10 | $0.001 |
| **Infra Total** | | **~$55/month base** | **~$0.0055/user** |

### Total Cost Summary

| Category | Cost/User/Month |
|---|---|
| LLM (Gemini 2.5 Flash) | $0.013 |
| Job search APIs | $0.015 |
| Infrastructure | $0.006 |
| **Total** | **~$0.034/user/month** |

**10,000 active users ≈ $340/month total operating cost.**

---

## 8. Key Bottlenecks & Mitigations

| Bottleneck | Risk | Mitigation |
|---|---|---|
| **Gemini API rate limits** | 2.5 Flash has 10 RPM on free tier; 1,000 RPM on paid | Upgrade to paid tier at launch; add exponential backoff in API routes |
| **Serper rate limits** | 2,500 free searches; paid plan needed at scale | Redis cache reduces effective API calls by ~65% |
| **TF-IDF on large CVs** | Vocabulary grows with CV length; O(n²) chunk comparison | Cap chunks at 20; at 10k users switch to pgvector with precomputed embeddings |
| **localStorage data loss** | User clears browser → loses all CV + applications | Supabase persistence resolves this; show warning banner on first load |
| **Cold start latency** | Vercel serverless cold starts add 800ms–2s | Use Vercel Edge Functions for lightweight routes; keep parse-cv on Node runtime |
| **7-API parallel calls** | One slow API (e.g. The Muse) blocks Promise.all response | Add `Promise.race` timeout wrapper per API (3s timeout); failing APIs return [] silently |

---

## 9. Security Considerations

- All API keys stored server-side in environment variables — never exposed to client
- CV text stored in client memory only (localStorage) — not sent to any third party except Gemini
- Gemini receives CV text as context — ensure users are informed via Privacy Policy
- No user authentication in MVP — add Supabase Auth before any public launch
- Rate limiting on API routes recommended at scale (use `@vercel/edge-config` or middleware)

---

## 10. Future Architecture (Post-Hackathon)

```
Current MVP:                    Production:
localStorage    →    Supabase Postgres + pgvector
TF-IDF RAG      →    text-embedding-3-small + HNSW index
No auth         →    Supabase Auth (Google + GitHub OAuth)
No cache        →    Upstash Redis (job search cache)
7 APIs inline   →    Background job queue (Trigger.dev)
Single tenant   →    Multi-tenant with RLS policies
```
