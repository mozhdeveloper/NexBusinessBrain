"""FastAPI entrypoint — exposes the NexVision RAG MVP API."""
from __future__ import annotations

import logging
import shutil
import uuid
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from . import file_store
from .config import get_settings
from .rag import get_engine
from .schemas import ChatRequest, ChatResponse, FileRecord
from .usage import get_counter

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("nexvision.api")

settings = get_settings()
app = FastAPI(title="NexVision Brain API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def warmup() -> None:
    try:
        get_engine()
        logger.info("RAG engine initialized")
    except Exception as exc:  # noqa: BLE001
        logger.exception("RAG engine failed to initialize: %s", exc)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/usage")
def usage() -> dict:
    return get_counter().snapshot()


# ─── Files ───────────────────────────────────────────────────────────────────


@app.get("/files", response_model=list[FileRecord])
def list_files() -> list[FileRecord]:
    return file_store.list_files()


@app.post("/files/upload", response_model=FileRecord)
def upload_file(background: BackgroundTasks, file: UploadFile = File(...)) -> FileRecord:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    safe_name = Path(file.filename).name

    # Validate extension
    allowed_ext = {".pdf", ".txt", ".md", ".docx", ".csv"}
    if Path(safe_name).suffix.lower() not in allowed_ext:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type. Allowed: {', '.join(sorted(allowed_ext))}",
        )

    # Ensure uploads dir exists (required on Vercel where /tmp may be empty)
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)

    # ── Duplicate check: auto-replace same-named file ─────────────────────
    existing = file_store.list_files()
    duplicate = next((f for f in existing if f.name == safe_name), None)
    if duplicate:
        logger.info("Auto-replacing duplicate file '%s' (old id=%s)", safe_name, duplicate.id)
        # Remove old vectors from Pinecone using stored node IDs
        try:
            get_engine().delete_file(duplicate.id, node_ids=duplicate.node_ids or None)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Vector delete for duplicate failed: %s", exc)
        # Remove old file from disk
        for p in settings.uploads_dir.glob(f"{duplicate.id}__*"):
            try:
                p.unlink()
            except Exception:
                pass
        file_store.delete_file_record(duplicate.id)

    file_id = f"f-{uuid.uuid4().hex[:10]}"
    dest = settings.uploads_dir / f"{file_id}__{safe_name}"

    with dest.open("wb") as fh:
        shutil.copyfileobj(file.file, fh)
    size_bytes = dest.stat().st_size

    # Reject files over 10 MB — large files cause Vercel background-task timeouts
    MAX_BYTES = 10 * 1024 * 1024
    if size_bytes > MAX_BYTES:
        dest.unlink(missing_ok=True)
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({file_store.format_size(size_bytes)}). Maximum is 10 MB.",
        )

    record = FileRecord(
        id=file_id,
        name=safe_name,
        status="processing",
        addedAt=file_store.now_iso(),
        size=file_store.format_size(size_bytes),
        ext=file_store.get_ext(safe_name),
    )
    file_store.upsert_file(record)

    background.add_task(_ingest_in_background, dest, file_id, safe_name)
    return record


def _ingest_in_background(path: Path, file_id: str, file_name: str) -> None:
    try:
        engine = get_engine()
        chunks, node_ids = engine.ingest_file(path, file_id, file_name)
        logger.info("Indexed %s with %d chunks (%d vectors)", file_name, chunks, len(node_ids))
        file_store.update_node_ids(file_id, node_ids)
        file_store.update_status(file_id, "indexed")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Ingestion failed for %s: %s", file_name, exc)
        file_store.update_status(file_id, "error", error=str(exc))


@app.delete("/files/{file_id}")
def delete_file(file_id: str) -> dict:
    record = file_store.delete_file_record(file_id)
    if not record:
        raise HTTPException(status_code=404, detail="File not found")

    # Remove from disk
    for p in settings.uploads_dir.glob(f"{file_id}__*"):
        try:
            p.unlink()
        except Exception:
            pass

    # Remove vectors from Pinecone using stored node IDs for reliability
    try:
        get_engine().delete_file(file_id, node_ids=record.node_ids or None)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Vector delete failed: %s", exc)

    return {"ok": True, "id": file_id}


# ─── Chat ────────────────────────────────────────────────────────────────────


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    try:
        engine = get_engine()
        # Scope retrieval to currently indexed files only.
        active_ids = [f.id for f in file_store.list_files() if f.status == "indexed"]

        # If no files are indexed, return a helpful response immediately —
        # no Pinecone query needed and we avoid accidentally retrieving
        # orphaned vectors left over from previous sessions.
        if not active_ids:
            return ChatResponse(
                answer="No documents are currently indexed in your Knowledge Base. "
                       "Please upload at least one file and wait for it to finish processing.",
                summary="No indexed documents found.",
                sources=[],
                recommended_action="Upload a PDF, DOCX, TXT, MD, or CSV file to the Knowledge Base.",
                missing_info="Knowledge Base is empty.",
                confidence=0.0,
                model_used=engine.settings.qwen_llm_model,
            )

        return engine.chat(
            req.question,
            session_id=req.session_id,
            history=req.conversation_history,
            file_ids=active_ids,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Chat failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Chat failed: {exc}")


# ─── Reset ───────────────────────────────────────────────────────────────────


@app.post("/reset")
def reset_all() -> dict:
    # Collect all stored vector IDs before clearing the file store so the
    # Pinecone reset can delete them by ID (serverless Pinecone does not
    # support delete_all=True, which would silently leave old vectors behind).
    all_files = file_store.list_files()
    all_node_ids = [nid for f in all_files for nid in (f.node_ids or [])]

    file_store.reset_all_records()
    get_counter().reset_all()
    try:
        get_engine().reset_index(node_ids=all_node_ids or None)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Vector reset failed: %s", exc)
    return {"ok": True}


@app.post("/chat/reset")
def reset_chat(session_id: str = "default") -> dict:
    try:
        get_engine().reset_memory(session_id)
    except Exception:
        pass
    return {"ok": True}
