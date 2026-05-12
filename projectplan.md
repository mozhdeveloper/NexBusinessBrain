# NexVision Reasoning RAG MVP

## Goal
Build a demo where a company can upload business data, then ask questions like:
“This customer wants a refund. Are they eligible and what should staff do?”

The system should answer with:
1. Direct answer
2. Short reasoning summary
3. Source documents used
4. Recommended next action
5. Missing information, if any

Use LlamaIndex + Vector DB because LlamaIndex is built for indexing private data into vector stores for retrieval, and Supabase/pgvector can store embeddings in Postgres.

---

## 1. Recommended Tech Stack

**Backend**
* Python FastAPI
* LlamaIndex
* Supabase pgvector or Pinecone
* OpenAI API
* PostgreSQL/Supabase for structured records
* File storage: local folder first, later Supabase Storage or S3

**Frontend**
* React / Next.js
* Simple dashboard only

**AI Models**
Use two model levels:
* **Fast model:** For simple Q&A.
* **Reasoning model:** For decision questions, policy checks, eligibility, recommendations, and multi-step cases. 
*(OpenAI’s reasoning models are intended for complex problem-solving and more reliable decision-making, while faster GPT models are better for cost and speed.)*

---

## 2. MVP Architecture
```text
User
  ↓
Frontend Chat UI
  ↓
FastAPI Backend
  ↓
Question Classifier
  ↓
Retriever / Tools
  ↓
LlamaIndex + Vector DB
  ↓
Reasoning Engine
  ↓
Final Answer with Sources + Next Action