# NexVision Brain — Tech Stack Reference

> **Audience:** Internal team reference.  
> **Purpose:** Understand every component, its cost, how much headroom you have on free tiers, and how to monitor daily usage in the UI.

---

## Table of Contents

1. [Architecture at a Glance](#1-architecture-at-a-glance)
2. [Component Breakdown](#2-component-breakdown)
   - [Qwen / DashScope (LLM + Embeddings)](#21-qwen--dashscope---alibaba-cloud)
   - [Pinecone (Vector Database)](#22-pinecone-vector-database)
   - [LlamaParse (Document Parser)](#23-llamaparse-document-parser)
   - [LlamaIndex (RAG Orchestration)](#24-llamaindex-rag-orchestration)
   - [FastAPI (Backend)](#25-fastapi-backend)
   - [React + Vite + TypeScript (Frontend)](#26-react--vite--typescript-frontend)
   - [Tailwind CSS + shadcn/ui (Styling)](#27-tailwind-css--shadcnui-styling)
   - [LangChain / LangSmith (Tracing)](#28-langchain--langsmith-tracing)
3. [How the RAG Pipeline Works — Step by Step](#3-how-the-rag-pipeline-works--step-by-step)
4. [Small Company Usage Scenario](#4-small-company-usage-scenario)
5. [Free-Tier Limit Summary Table](#5-free-tier-limit-summary-table)
6. [Daily Budget Estimates](#6-daily-budget-estimates)
7. [Frontend Daily-Limit Progress Bar](#7-frontend-daily-limit-progress-bar)

---

## 1. Architecture at a Glance

```
┌─────────────────────────────┐        ┌─────────────────────────────┐
│        FRONTEND             │        │          BACKEND             │
│  React + Vite (port 3000)   │◄──────►│  FastAPI (port 8000)         │
│                             │  HTTP  │                             │
│  • Upload Documents         │        │  • /files/upload            │
│  • Chat Interface           │        │  • /chat                    │
│  • Knowledge Base Panel     │        │  • /files (list/delete)     │
│  • [NEW] Usage Progress Bar │        │  • /usage  ← new            │
└─────────────────────────────┘        └──────────┬──────────────────┘
                                                   │
                  ┌────────────────────────────────┼─────────────────────────────┐
                  │                                │                             │
           ┌──────▼──────┐                 ┌───────▼──────┐            ┌────────▼───────┐
           │  LlamaParse │                 │    Pinecone  │            │ Qwen / DashScope│
           │  (Cloud API)│                 │  Serverless  │            │  (Cloud API)   │
           │  Parse PDF/ │                 │  Vector DB   │            │  • qwen-max LLM│
           │  DOCX/PPTX  │                 │  nexvision-  │            │  • text-embed- │
           └─────────────┘                 │  rag index   │            │    ing-v3      │
                                           └──────────────┘            └────────────────┘
```

---

## 2. Component Breakdown

### 2.1 Qwen / DashScope — Alibaba Cloud

| | |
|---|---|
| **What it is** | Alibaba Cloud's AI model service (international region) |
| **What we use** | `qwen-max` for chat reasoning + `text-embedding-v3` for document embeddings |
| **API endpoint** | `https://dashscope-intl.aliyuncs.com` |
| **Config key** | `DASHSCOPE_API_KEY` in `.env` |

**How it works in our app:**

- **LLM (qwen-max):** Receives a system prompt + retrieved document chunks + the user's question, returns a structured JSON answer with `answer`, `summary`, `recommended_action`, `confidence`, `missing_info`.
- **Embeddings (text-embedding-v3):** Converts every document chunk (and every user question) into a 1024-dimensional number vector. These vectors allow mathematical similarity comparison — "what chunks are most relevant to this question?"

**Free tier:**

- New DashScope accounts receive free trial credits (approx. $10–30 USD equivalent, varies by region/promotion).
- After credits: `qwen-max` costs ~$0.003/1K input tokens, ~$0.012/1K output tokens. `text-embedding-v3` costs ~$0.00007/1K tokens.
- No hard rate limit on free tier — it burns credits until they run out.

**Will free tier work for a small company?**

Yes, easily for the first 1–3 months. Typical burn rate at 20 questions/day is under $0.50/month after free credits are exhausted.

---

### 2.2 Pinecone (Vector Database)

| | |
|---|---|
| **What it is** | Managed cloud vector database — stores and searches embeddings |
| **Plan used** | Serverless (auto-scaling, no always-on pods) |
| **Index name** | `nexvision-rag` (auto-created on first upload) |
| **Config key** | `PINECONE_API_KEY` in `.env` |
| **Dimensions** | 1024 (matches text-embedding-v3) |
| **Metric** | Cosine similarity |

**How it works in our app:**

When you upload a document, each text chunk gets an embedding vector upserted into Pinecone with metadata (`file_id`, `file_name`). When you ask a question, the question is also embedded and the top-5 most similar chunks are fetched. Those chunks become the "context" the AI uses to answer.

**Free tier (Starter Plan):**

- 1 project, 1 index
- **2 GB storage** included
- **Serverless reads/writes:** A small free allocation; the Serverless model charges per read/write unit above the free monthly allocation
- Actual hard limit: Pinecone gives ~$0 cost for the first tier; overages are billed at ~$0.08/GB stored/month + $2/million reads

**Will free tier work for a small company?**

Yes. 2 GB storage at 1024 dimensions × 4 bytes/float = ~4,096 bytes per vector. You can store **~500,000 vectors for free**. For a small company uploading 10 documents (100 pages total = ~200 chunks), you are at **0.04% of the free storage limit**.

---

### 2.3 LlamaParse (Document Parser)

| | |
|---|---|
| **What it is** | LlamaIndex's cloud PDF/DOCX/PPTX parsing service |
| **Supported formats** | PDF, DOCX, PPTX, XLSX, HTML, EPUB, and more |
| **Config key** | `LLAMA_CLOUD_API_KEY` in `.env` |
| **Fallback** | If LlamaParse fails, the app falls back to `pypdf` + `python-docx` locally (no API call) |

**How it works in our app:**

When you upload a file, the backend sends it to LlamaParse's API which intelligently parses layout, tables, headers, and multi-column text. It returns clean markdown text which is then chunked and embedded.

**Free tier:**

- **1,000 pages per day** — resets at midnight UTC
- No monthly cap on free plan
- Paid: $0.003 per page beyond the 1,000/day limit

**Will free tier work for a small company?**

Very easily. 1,000 pages/day means you could upload roughly a 1,000-page document every single day — far beyond any realistic small business need.

---

### 2.4 LlamaIndex (RAG Orchestration)

| | |
|---|---|
| **What it is** | Open-source Python framework that wires together LLM + embeddings + vector store |
| **Cost** | Free (Apache 2.0 license) |
| **Key modules** | `llama-index-core`, `llama-index-llms-openai-like`, `llama-index-embeddings-dashscope`, `llama-index-vector-stores-pinecone`, `llama-index-readers-file` |

**How it works in our app:**

LlamaIndex handles:
1. Chunking documents with `SentenceSplitter` (1024 token chunks, 120 overlap)
2. Calling the embedding API per chunk
3. Managing the `VectorStoreIndex` that talks to Pinecone
4. Running retrieval queries and providing nodes to the LLM
5. Managing `ChatMemoryBuffer` per session (3,000 token window)

**Cost:** $0 forever.

---

### 2.5 FastAPI (Backend)

| | |
|---|---|
| **What it is** | Python async web framework for building REST APIs |
| **Cost** | Free (MIT license) |
| **Runs on** | `http://127.0.0.1:8000` (locally) |

**How it works in our app:**

The backend is the central controller. It receives file uploads, triggers background ingestion (parse → embed → store), routes chat requests to the RAG engine, manages file metadata in a local JSON file store, and enforces CORS so only the frontend can call it.

**Cost:** $0 to run locally. If hosted on a cloud VM later, a small VPS (e.g., DigitalOcean $6/month) is sufficient.

---

### 2.6 React + Vite + TypeScript (Frontend)

| | |
|---|---|
| **What it is** | Modern frontend stack for building the UI |
| **Cost** | Free (MIT license) |
| **Runs on** | `http://localhost:3000` |

**How it works in our app:**

The UI is a single-page app with:
- A sidebar (Knowledge Base files + Reset button)
- A chat panel (message history, send, reasoning drawer)
- A file upload panel (drag & drop, status polling)
- [Planned] A usage dashboard with progress bars

Vite provides hot-module-replacement during development and optimized production builds.

---

### 2.7 Tailwind CSS + shadcn/ui (Styling)

| | |
|---|---|
| **What it is** | Utility-first CSS + pre-built accessible component library |
| **Cost** | Free (MIT license) |

Used for all UI components: buttons, cards, dialogs, tabs, progress bars, badges, etc.

---

### 2.8 LangChain / LangSmith (Tracing)

| | |
|---|---|
| **What it is** | Optional observability platform to trace and debug LLM calls |
| **Currently** | Disabled (`LANGCHAIN_TRACING_V2=false` in `.env`) |
| **Free tier** | 5,000 traces/month |

Not active in MVP. Can be enabled later for debugging without any cost.

---

## 3. How the RAG Pipeline Works — Step by Step

### Document Upload (Ingestion)

```
User uploads file
       │
       ▼
FastAPI receives file → saves to disk → updates status: "processing"
       │
       ▼ (background task)
LlamaParse API (or pypdf/docx fallback)
       │   Returns clean text
       ▼
SentenceSplitter
       │   Splits into chunks (≤1024 tokens, 120 overlap)
       ▼
DashScope text-embedding-v3
       │   Each chunk → 1024-dim float vector
       ▼
Pinecone upsert
       │   Vectors stored with metadata: {file_id, file_name, chunk_index}
       ▼
Status updated: "indexed" ✓
```

### Chat Question

```
User types question
       │
       ▼
FastAPI /chat endpoint
       │
       ▼
DashScope text-embedding-v3
       │   Question → 1024-dim vector
       ▼
Pinecone similarity search (top-5 chunks)
       │   Returns most relevant document excerpts
       ▼
Build context string + inject into prompt
       │
       ▼
Qwen-max LLM (JSON mode)
       │   Returns structured JSON:
       │   { answer, summary, recommended_action,
       │     missing_info, confidence }
       ▼
Strip any stray markdown → return to frontend
       │
       ▼
Session memory updated (remembers conversation)
       │
       ▼
Frontend renders answer + cited sources
```

---

## 4. Small Company Usage Scenario

**Assumptions:**
- 5–10 employees using the system
- 20 chat questions per day (across all users)
- 10 documents uploaded per month, average 20 pages each
- Average document chunk size: ~500 tokens
- Average question: ~100 input tokens + ~400 output tokens from LLM
- 22 working days per month

### Monthly Usage Computation

| Service | Calculation | Monthly Total |
|---------|------------|---------------|
| **LlamaParse pages parsed** | 10 docs × 20 pages = 200 pages/month | 200 pages |
| **Embedding tokens (ingestion)** | 10 docs × 20 pages × 2 chunks/page × 500 tokens = 200K tokens | 200K tokens |
| **Embedding tokens (queries)** | 20 questions/day × 22 days × 100 tokens = 44K tokens | 44K tokens |
| **Total embedding tokens** | 200K + 44K | **244K tokens/month** |
| **LLM input tokens** | 20 q/day × 22 days × (5 chunks × 200 tokens context + 100 q tokens) = 484K | 484K tokens |
| **LLM output tokens** | 20 × 22 × 400 tokens/answer | 176K tokens |
| **Pinecone vectors stored** | 10 docs × 20 pages × 2 chunks = 400 new vectors/month | 400 vectors |
| **Pinecone query reads** | 20 q/day × 22 days = 440 queries × top-5 = 2,200 reads | 2,200 reads |

### Cost After Free Credits

| Service | Monthly Usage | After Free Tier | Est. Monthly Cost |
|---------|--------------|-----------------|-------------------|
| Qwen-max LLM | 484K input + 176K output | ~$1.45 input + ~$2.11 output | **~$3.56** |
| text-embedding-v3 | 244K tokens | $0.017 | **~$0.02** |
| LlamaParse | 200 pages | Well within 1,000/day free | **$0.00** |
| Pinecone | 400 new vectors, 2,200 reads | Within free allocation | **$0.00** |
| Backend hosting | Local or $6/mo VPS | — | **$0–$6** |
| **TOTAL** | | | **~$3.58–$9.58/month** |

> At this usage level, the free trial credits (approx. $10–30) from DashScope cover **several months** before any payment is needed.

---

## 5. Free-Tier Limit Summary Table

| Component | Free Limit | Our Monthly Usage | % of Free Limit | Risk |
|-----------|------------|-------------------|-----------------|------|
| LlamaParse | 1,000 pages/day (30,000/month) | 200 pages/month | **0.7%** | None |
| Pinecone storage | 2 GB | ~1.6 MB/month | **0.08%** | None |
| Pinecone reads | Free allocation included | 2,200/month | Negligible | None |
| DashScope (all) | Trial credits ~$10–30 | ~$3.60/month equiv. | Varies | Low (3–8 months free) |
| LangSmith | 5,000 traces/month | 0 (disabled) | 0% | None |
| FastAPI/React | No limit (open source) | — | — | None |

---

## 6. Daily Budget Estimates

> Self-imposed daily soft limits for a small team.

| Metric | Conservative Daily Limit | Our Expected Daily Usage | Headroom |
|--------|-------------------------|--------------------------|----------|
| LlamaParse pages | 1,000 (hard API limit) | ~7 pages/day avg | 99% free |
| Chat questions | 50 (soft self-limit) | ~20/day | 60% free |
| LLM tokens (in+out) | 40,000 (soft budget) | ~16,000/day | 60% free |
| Embedding tokens | 5,000 (soft budget) | ~2,000/day | 60% free |
| New vectors stored | 100 (soft budget) | ~18/day avg | 82% free |

---

## 7. Frontend Daily-Limit Progress Bar

**Yes, this is fully possible.** Here is the plan:

### How it works

1. The backend tracks daily usage in memory (resets at midnight local time).
2. A new `/usage` GET endpoint returns current daily totals and configured limits.
3. The frontend sidebar shows a collapsible **"API Usage Today"** section with color-coded progress bars.

### What the `/usage` response looks like

```json
{
  "reset_at": "2026-05-06T00:00:00",
  "metrics": [
    {
      "label": "Chat Questions",
      "used": 8,
      "limit": 50,
      "unit": "questions"
    },
    {
      "label": "LlamaParse Pages",
      "used": 12,
      "limit": 1000,
      "unit": "pages"
    },
    {
      "label": "LLM Tokens",
      "used": 6400,
      "limit": 40000,
      "unit": "tokens"
    },
    {
      "label": "Embedding Tokens",
      "used": 800,
      "limit": 5000,
      "unit": "tokens"
    }
  ]
}
```

### Progress bar color rules

| % Used | Bar Color | Meaning |
|--------|-----------|---------|
| 0–60% | Green | Normal |
| 60–85% | Yellow / Amber | Watch it |
| 85–100% | Red | Near limit |

### Implementation scope

- **Backend:** Add a `DailyUsageCounter` class (thread-safe dict, resets on date change). Increment counters inside `rag.py` on each chat/embed call and in the ingestion path. Expose `/usage` endpoint.
- **Frontend:** New `UsagePanel` component in the sidebar. Polls `/usage` every 60 seconds. Uses shadcn `Progress` component with conditional Tailwind color classes.

> To implement this: ask and it will be built immediately.

---

## Quick Reference — Where Each Key Is Set

| Key | Service | Where to Rotate |
|-----|---------|-----------------|
| `DASHSCOPE_API_KEY` | Qwen / Alibaba DashScope | https://dashscope-intl.aliyuncs.com → Account → API Keys |
| `PINECONE_API_KEY` | Pinecone | https://app.pinecone.io → API Keys |
| `LLAMA_CLOUD_API_KEY` | LlamaParse | https://cloud.llamaindex.ai → API Keys |
| `LANGCHAIN_API_KEY` | LangSmith | https://smith.langchain.com → Settings → API Keys |

> All keys are stored only in `backend/.env` which is gitignored. **Never commit this file.**
