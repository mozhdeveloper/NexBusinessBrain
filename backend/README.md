# NexVision Brain — RAG Backend (MVP)

FastAPI + LlamaIndex + Pinecone + LlamaParse + Qwen (DashScope).

## Setup (Windows / PowerShell)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Edit .env (already created from example with your keys)
# Then run:
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The first request creates the Pinecone index automatically (1024-dim cosine, serverless aws/us-east-1).

## Endpoints

| Method | Path                  | Purpose                                                     |
| ------ | --------------------- | ----------------------------------------------------------- |
| GET    | `/health`             | Liveness probe                                              |
| GET    | `/files`              | List uploaded files + status                                |
| POST   | `/files/upload`       | Multipart file upload — kicks off background ingestion      |
| DELETE | `/files/{file_id}`    | Delete file + its vectors                                   |
| POST   | `/chat`               | Ask a question — returns structured RAG answer + sources    |
| POST   | `/chat/reset`         | Clear chat memory for a session                             |
| POST   | `/reset`              | Wipe ALL files, vectors, and memory                         |

## Chat response shape

```json
{
  "answer": "Plain-text answer (no markdown).",
  "summary": "One-sentence reasoning trace.",
  "sources": [{"filename": "policy.pdf", "chunk_preview": "...", "score": 0.81}],
  "recommended_action": "What staff should do next.",
  "missing_info": "What context the docs lack, or null.",
  "confidence": 0.86,
  "model_used": "qwen-max"
}
```

## Models

- **LLM** — `qwen-max` via DashScope OpenAI-compatible endpoint (json_object mode).
- **Embeddings** — `text-embedding-v3` (1024 dim).
- **Parser** — LlamaParse for PDF/DOCX/PPTX/XLSX, with pypdf + python-docx fallback.
- **Vector store** — Pinecone serverless, metadata filter `file_id` for per-file delete.
- **Memory** — `ChatMemoryBuffer` (3k token window) keyed per `session_id`.

## Frontend

Set `USE_SIMULATION = false` in `src/services/api.ts` (already done) and start the React app pointing at `http://localhost:8000`.
